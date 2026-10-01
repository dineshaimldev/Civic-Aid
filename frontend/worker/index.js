/**
 * CivicAid — Cloudflare Worker API Proxy
 * Handles CORS and forwards requests to Anthropic API
 * Deploy: wrangler deploy
 * Free tier: 100,000 requests/day
 */

const ALLOWED_ORIGINS = [
  'https://civicaid.vercel.app',
  'https://civicaid.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
]

const CORS_HEADERS = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Request-ID',
  'Access-Control-Max-Age': '86400',
})

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const corsHeaders = CORS_HEADERS(origin)

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // Only allow POST to /api/chat
    const url = new URL(request.url)
    if (request.method !== 'POST' || url.pathname !== '/api/chat') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Validate body
    let body
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Enforce model and max_tokens to prevent abuse
    const safeBody = {
      model: 'claude-sonnet-4-6',
      max_tokens: Math.min(body.max_tokens || 1000, 1000),
      system: body.system,
      messages: body.messages,
    }

    // Forward to Anthropic
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(safeBody),
    })

    const data = await anthropicResponse.json()

    return new Response(JSON.stringify(data), {
      status: anthropicResponse.status,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': crypto.randomUUID(),
        ...corsHeaders,
      },
    })
  },
}
