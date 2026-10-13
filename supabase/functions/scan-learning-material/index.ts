import { withSupabase } from 'npm:@supabase/server'

/**
 * scan-learning-material
 *
 * Malware gate for mentor learning-material uploads, using the
 * VirusTotal Public API v3.
 *
 * Why the file is still staged in a private path first: an upload must never
 * become publicly downloadable before it has a verdict, so mentors write to
 * `quarantine/<id>/...` and this function either publishes or deletes it.
 *
 * Storage layout (single bucket):
 *   learning-materials/quarantine/<mentor-id>/<file-name>   staged, not public
 *   learning-materials/<mentor-id>/<file-name>              published, public
 *
 * Request:
 *   POST /functions/v1/scan-learning-material
 *   Authorization: Bearer <mentor JWT>
 *   { "path": "<mentor-id>/<file-name>", "contentType": "application/pdf" }
 *
 * Verdicts:
 *   infected -> staged object deleted, 422 with a generic message
 *   clean    -> staged object renamed to its published path, public URL returned
 *   anything else (API down, quota, timeout) -> error, nothing published
 */

const BUCKET = Deno.env.get('MATERIALS_BUCKET') ?? 'learning-materials'
const VT_API_KEY = Deno.env.get('VIRUSTOTAL_API_KEY') ?? ''
const VT_FILES_URL = 'https://www.virustotal.com/api/v3/files'
const VT_ANALYSES_URL = 'https://www.virustotal.com/api/v3/analyses'

// Public API limits: 4 requests/min and a 32MB upload cap.
const VT_MAX_BYTES = 32 * 1024 * 1024
// Poll every 5s. Free-tier VT queues submissions; an analysis can take
// 60-90s. We cap polling at 90s so the function stays within the
// 120s Edge Function hard timeout.
const POLL_INTERVAL_MS = 5000
const POLL_MAX_ATTEMPTS = 18
const SIGNED_URL_TTL = 300
const REQUEST_TIMEOUT_MS = 100000

const PROJECT_URL = Deno.env.get('SUPABASE_URL') ?? ''

/** `quarantine/<user-id>/<file-name>` - url-safe names only. */
const STAGED_PATH_RE = /^quarantine\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (req.method !== 'POST') {
      return json({ error: 'Use POST' }, 405)
    }

    try {
      const userId = ctx.userClaims?.id
      if (!userId) return json({ error: 'Unauthenticated' }, 401)

      if (!VT_API_KEY) {
        console.error('VIRUSTOTAL_API_KEY is not configured')
        return json({ error: 'File scanner is not configured' }, 503)
      }

      // ── Payload ────────────────────────────────────────────────────────────
      let payload: { path?: unknown; contentType?: unknown }
      try {
        payload = await req.json()
      } catch {
        return json({ error: 'Invalid JSON body' }, 400)
      }

      const path = typeof payload.path === 'string' ? payload.path : ''
      const contentType =
        typeof payload.contentType === 'string' && payload.contentType
          ? payload.contentType
          : 'application/octet-stream'

      const segments = path.split('/')
      if (
        !STAGED_PATH_RE.test(path) ||
        segments[1] !== userId ||
        segments.includes('..')
      ) {
        return json({ error: 'Invalid staged file path' }, 400)
      }

      const publishedPath = `${userId}/${segments[2]}`

      // ── Mentor check ───────────────────────────────────────────────────────
      const { data: mentor } = await ctx.supabase
        .from('mentor_profiles')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle()

      if (!mentor) return json({ error: 'Mentor profile not found' }, 403)

      // ── Read the staged file ───────────────────────────────────────────────
      const { data: signed, error: signError } = await ctx.supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL)

      if (signError || !signed?.signedUrl) {
        console.error('could not create a signed URL:', signError)
        return json({ error: 'Staged file not found' }, 404)
      }

      const download = await fetch(signed.signedUrl, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })
      if (!download.ok) {
        console.error('staged file fetch failed:', download.status)
        return json({ error: 'Staged file not found' }, 404)
      }

      // The public API caps uploads at 32MB; the client caps at 50MB, so this
      // guard is what actually protects the limit.
      const bytes = await download.arrayBuffer()
      if (bytes.byteLength > VT_MAX_BYTES) {
        await ctx.supabase.storage.from(BUCKET).remove([path])
        return json(
          {
            error: `File exceeds the ${Math.round(VT_MAX_BYTES / 1024 / 1024)}MB scan limit`
          },
          413
        )
      }

      const fileName = segments[2]
      const fileHash = await sha256Hex(bytes)

      // ── Step 1: Check by hash first (instant, no upload) ──────────────────
      let stats: {
        malicious?: number
        suspicious?: number
        harmless?: number
        undetected?: number
      } | null = null

      const hashRes = await fetch(`${VT_FILES_URL}/${fileHash}`, {
        headers: { 'x-apikey': VT_API_KEY },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })

      if (hashRes.ok) {
        const hashData = await hashRes.json()
        const lastStats = hashData?.data?.attributes?.last_analysis_stats
        if (lastStats) {
          stats = lastStats
          console.log(`Hash match — using cached VT verdict for ${fileHash}`)
        }
      }

      // ── Step 2: Hash not cached → upload + poll ───────────────────────────
      if (!stats) {
        let analysisId: string
        try {
          const form = new FormData()
          form.append(
            'file',
            new Blob([bytes], { type: contentType }),
            fileName
          )

          const submit = await fetch(VT_FILES_URL, {
            method: 'POST',
            headers: { 'x-apikey': VT_API_KEY },
            body: form,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
          })

          if (submit.status === 429) {
            // Public API: 4 requests/min. Fail closed - never treat as a pass.
            console.error('VirusTotal rate limit hit')
            return json(
              { error: 'Scanner is busy, please try again in a minute' },
              429
            )
          }

          if (!submit.ok) {
            const details = await submit.text()
            throw new Error(`submission failed ${submit.status}: ${details}`)
          }

          const submitted = await submit.json()
          analysisId = submitted?.data?.id
          if (!analysisId) throw new Error('no analysis id returned')
        } catch (error) {
          console.error('VirusTotal submission failed:', error)
          return json(
            { error: 'File scanner unavailable, please try again later' },
            503
          )
        }

        try {
          for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
            if (attempt > 0) await sleep(POLL_INTERVAL_MS)

            const poll = await fetch(`${VT_ANALYSES_URL}/${analysisId}`, {
              headers: { 'x-apikey': VT_API_KEY },
              signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
            })

            if (poll.status === 429) {
              return json(
                { error: 'Scanner is busy, please try again in a minute' },
                429
              )
            }

            if (!poll.ok) {
              const details = await poll.text()
              throw new Error(`poll failed ${poll.status}: ${details}`)
            }

            const report = await poll.json()
            const attributes = report?.data?.attributes

            if (attributes?.status === 'completed') {
              stats = attributes.stats ?? {}
              break
            }
          }
        } catch (error) {
          console.error('VirusTotal polling failed:', error)
          return json(
            { error: 'File scanner unavailable, please try again later' },
            503
          )
        }

        if (!stats) {
          return json(
            {
              error:
                'Scan did not finish in time. The file was not published - please retry.'
            },
            504
          )
        }
      }

      const detections = (stats.malicious ?? 0) + (stats.suspicious ?? 0)

      // ── Infected: destroy, never publish ───────────────────────────────────
      if (detections > 0) {
        await ctx.supabase.storage.from(BUCKET).remove([path])

        // The engine names are logged for operators only. Revealing them would
        // tell an uploader exactly which engines to appease.
        console.warn(
          `Blocked infected upload from mentor ${userId}: ${detections} detection(s) ` +
            `(malicious=${stats.malicious ?? 0}, suspicious=${stats.suspicious ?? 0})`
        )

        return json(
          {
            clean: false,
            detections,
            error:
              'Malicious file detected. The upload was rejected and the file was removed.'
          },
          422
        )
      }

      // ── Clean: publish by renaming the staged object ───────────────────────
      const { error: moveError } = await ctx.supabase.storage
        .from(BUCKET)
        .move(path, publishedPath)

      if (moveError) {
        console.error('publishing scanned file failed:', moveError)
        return json({ error: 'Failed to save the scanned file' }, 500)
      }

      const publicUrl = PROJECT_URL
        ? `${PROJECT_URL}/storage/v1/object/public/${BUCKET}/${publishedPath}`
        : publishedPath

      return json({
        clean: true,
        detections: 0,
        stats,
        path: publishedPath,
        publicUrl
      })
    } catch (error) {
      console.error('scan-learning-material failed:', error)
      return json({ error: 'Unexpected scanner error' }, 500)
    }
  })
}
