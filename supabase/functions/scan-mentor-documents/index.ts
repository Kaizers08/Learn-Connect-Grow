import { withSupabase } from 'npm:@supabase/server'

/**
 * scan-mentor-documents
 *
 * Sightengine moderation for mentor profile pictures and certifications.
 * Uses the genai model to detect AI-generated images, plus nudity-2.1 and
 * gore-2.0 for visual moderation.
 *
 * Verdicts:
 *   'trusted'  - image is real, clean
 *   'blocked'  - AI-generated, nudity, gore, or other violation
 *   'unscanned'- could not be analyzed (API down, etc.)
 *
 * Request:
 *   POST /functions/v1/scan-mentor-documents
 *   Authorization: Bearer <mentor JWT>
 *   { "url": "<public image url>", "type": "profile_picture" | "certification" }
 *
 * Response:
 *   { "status": "trusted" | "blocked" | "unscanned", "scores": {...} }
 */

const SE_API_USER = Deno.env.get('SIGHTENGINE_API_USER') ?? ''
const SE_API_SECRET = Deno.env.get('SIGHTENGINE_API_SECRET') ?? ''
const SE_CHECK_URL = 'https://api.sightengine.com/1.0/check.json'

// AI-generated threshold: above this, the image is considered AI-generated
const AI_GENERATED_THRESHOLD = 0.5
// Nudity threshold: above this, the image is considered inappropriate
const NUDITY_THRESHOLD = 0.5
// Gore threshold
const GORE_THRESHOLD = 0.5

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// CORS headers — Supabase Edge Functions don't set these by default for
// cross-origin calls from our Vercel frontend.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (req.method !== 'POST') {
      return json({ error: 'Use POST' }, 405)
    }

    try {
      const userId = ctx.userClaims?.id
      if (!userId) return json({ error: 'Unauthenticated' }, 401)

      if (!SE_API_USER || !SE_API_SECRET) {
        console.error('Sightengine credentials not configured')
        return json({ error: 'Content moderator is not configured' }, 503)
      }

      let payload: { url?: unknown; type?: unknown }
      try {
        payload = await req.json()
      } catch {
        return json({ error: 'Invalid JSON body' }, 400)
      }

      const url = typeof payload.url === 'string' ? payload.url : ''
      const docType = typeof payload.type === 'string' ? payload.type : 'profile_picture'

      if (!url) return json({ error: 'Image URL is required' }, 400)

      // Only allow scanning images from our own Supabase storage
      const projectUrl = Deno.env.get('SUPABASE_URL') ?? ''
      if (!url.startsWith(projectUrl)) {
        return json({ error: 'Image URL not allowed' }, 400)
      }

      // ── Query Sightengine ────────────────────────────────────────────────
      const params = new URLSearchParams({
        url,
        models: 'genai,nudity-2.1,gore-2.0',
        api_user: SE_API_USER,
        api_secret: SE_API_SECRET,
      })

      const seRes = await fetch(`${SE_CHECK_URL}?${params}`, {
        signal: AbortSignal.timeout(30000),
      })

      if (!seRes.ok) {
        const details = await seRes.text()
        console.error('Sightengine API error:', seRes.status, details)
        return json({ error: 'Content moderator unavailable' }, 503)
      }

      const data = await seRes.json()

      if (data.status !== 'success') {
        console.error('Sightengine returned failure:', data)
        return json({ status: 'unscanned', error: 'Moderation analysis failed' }, 200)
      }

      const type = data.type ?? {}
      const aiGenerated = type.ai_generated ?? 0
      const nudity = type.nudity ?? 0
      const gore = type.gore ?? 0

      // ── Determine verdict ────────────────────────────────────────────────
      let status: 'trusted' | 'blocked' | 'unscanned' = 'trusted'

      if (aiGenerated >= AI_GENERATED_THRESHOLD) {
        status = 'blocked'
        console.warn(
          `Blocked AI-generated ${docType} from mentor ${userId}: ` +
          `ai_generated=${aiGenerated}`
        )
      } else if (nudity >= NUDITY_THRESHOLD) {
        status = 'blocked'
        console.warn(
          `Blocked inappropriate ${docType} from mentor ${userId}: ` +
          `nudity=${nudity}`
        )
      } else if (gore >= GORE_THRESHOLD) {
        status = 'blocked'
        console.warn(
          `Blocked gory ${docType} from mentor ${userId}: ` +
          `gore=${gore}`
        )
      }

      return json({
        status,
        scores: {
          ai_generated: aiGenerated,
          nudity,
          gore,
        },
      })
    } catch (error) {
      console.error('scan-mentor-documents failed:', error)
      return json({ error: 'Unexpected moderator error' }, 500)
    }
  })
}