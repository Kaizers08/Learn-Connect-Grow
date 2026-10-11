import { withSupabase } from 'npm:@supabase/server'

/**
 * scan-learning-material
 *
 * ClamAV malware gate for mentor learning-material uploads.
 *
 * Designed for the Supabase free tier, where an Edge Function gets only
 * 256MB of memory and 2s of CPU per call, so the file is NEVER buffered here:
 * it is streamed straight from Storage into the scanner, and a clean file is
 * published with a server-side `move()` (a rename) instead of a re-upload.
 *
 * Storage layout (single bucket):
 *   learning-materials/quarantine/<mentor-id>/<file-name>   ← staged, NOT public
 *   learning-materials/<mentor-id>/<file-name>              ← published, public
 *
 * Request:
 *   POST /functions/v1/scan-learning-material
 *   Authorization: Bearer <mentor JWT>
 *   { "path": "<mentor-id>/<file-name>", "contentType": "application/pdf" }
 *
 * Verdicts:
 *   infected → staged object deleted, 422 with a generic message (the matched
 *              signature is logged server-side only, never returned)
 *   clean    → staged object renamed to its published path, public URL returned
 *   anything else (scanner down, timeout, invalid path) → error, nothing published
 */

const BUCKET = Deno.env.get('MATERIALS_BUCKET') ?? 'learning-materials'
const QUARANTINE_PREFIX = 'quarantine'

const SCANNER_URL = (Deno.env.get('CLAMAV_SCAN_URL') ?? '').replace(/\/+$/, '')
const SCAN_KEY = Deno.env.get('CLAMAV_SCAN_KEY') ?? ''
const SCAN_TIMEOUT_MS = Number(
  Deno.env.get('CLAMAV_SCAN_TIMEOUT_MS') ?? 120000
)
const SIGNED_URL_TTL = 300 // seconds — long enough to stream the file twice

const PROJECT_URL = Deno.env.get('SUPABASE_URL') ?? ''

/** `quarantine/<user-id>/<file-name>` — url-safe names only. */
const STAGED_PATH_RE = /^quarantine\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return json({ error: 'Use POST' }, 405)
    }

    try {
      const userId = ctx.userClaims?.id
      if (!userId) return json({ error: 'Unauthenticated' }, 401)

      if (!SCANNER_URL || !SCAN_KEY) {
        console.error('CLAMAV_SCAN_URL / CLAMAV_SCAN_KEY are not configured')
        return json({ error: 'Virus scanner is not configured' }, 503)
      }

      // ── Request payload ─────────────────────────────────────────────────
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

      // The path must be the caller's own staged file.
      const segments = path.split('/')
      if (
        !STAGED_PATH_RE.test(path) ||
        segments[1] !== userId ||
        segments.includes('..')
      ) {
        return json({ error: 'Invalid staged file path' }, 400)
      }

      const publishedPath = `${userId}/${segments[2]}`

      // ── Mentor check (approved mentors only) ────────────────────────────
      const { data: mentor } = await ctx.supabase
        .from('mentor_profiles')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle()

      if (!mentor) return json({ error: 'Mentor profile not found' }, 403)
      if (mentor.status === 'pending' || mentor.status === 'rejected') {
        return json({ error: 'Mentor account is not approved' }, 403)
      }

      // ── A short-lived signed URL so we can stream without buffering ─────
      const { data: signed, error: signError } = await ctx.supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL)

      if (signError || !signed?.signedUrl) {
        console.error('could not create a signed URL:', signError)
        return json({ error: 'Staged file not found' }, 404)
      }

      // ── Scan: hand the signed URL to the scanner ────────────────────────
      // The scanner streams the file into clamd itself, so no bytes are ever
      // held in this function. That keeps us far below the free-plan 256MB
      // memory ceiling even for a 50MB upload.
      let verdict: { clean?: boolean; virus?: string | null }
      try {
        const scanResponse = await fetch(`${SCANNER_URL}/scan`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-scan-key': SCAN_KEY
          },
          body: JSON.stringify({ url: signed.signedUrl }),
          signal: AbortSignal.timeout(SCAN_TIMEOUT_MS)
        })

        if (!scanResponse.ok) {
          const details = await scanResponse.text()
          throw new Error(
            `scanner responded ${scanResponse.status}: ${details}`
          )
        }

        verdict = await scanResponse.json()
      } catch (error) {
        // Scanner problem — never a pass. Keep the staged file so the mentor
        // can retry; the client deletes it when the user cancels.
        console.error('ClamAV scan failed:', error)
        return json(
          { error: 'Virus scanner unavailable, please try again later' },
          503
        )
      }

      // ── Infected: destroy the staged copy, never publish it ─────────────
      if (verdict.clean !== true) {
        await ctx.supabase.storage.from(BUCKET).remove([path])

        // The signature name is logged for operators only. It is deliberately
        // NOT returned to the caller: telling an uploader which signature
        // matched would help them craft a bypass, so the response stays generic.
        console.warn(
          `Blocked infected upload from mentor ${userId}: ${verdict.virus ?? 'unknown'}`
        )

        return json(
          {
            clean: false,
            error:
              'Malicious file detected. The upload was rejected and the file was removed.'
          },
          422
        )
      }

      // ── Clean: publish by renaming the staged object (no re-upload) ─────
      // move() needs UPDATE on the source and INSERT on the destination; the
      // storage policies grant both for the mentor's own folders.
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
        virus: null,
        path: publishedPath,
        publicUrl
      })
    } catch (error) {
      console.error('scan-learning-material failed:', error)
      return json({ error: 'Unexpected scanner error' }, 500)
    }
  })
}
