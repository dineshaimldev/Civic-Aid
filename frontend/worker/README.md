# CivicAid Cloudflare Worker Proxy

This worker acts as a CORS proxy between the browser and Anthropic API.
It's free up to 100,000 requests/day on Cloudflare's free tier.

## Deploy in 3 steps

1. Install Wrangler CLI:
   npm install -g wrangler

2. Add your Anthropic API key as a secret:
   wrangler secret put ANTHROPIC_API_KEY
   (paste your key when prompted)

3. Deploy:
   wrangler deploy

4. Copy your worker URL (e.g. https://civicaid-proxy.your-name.workers.dev)
   and set it in the frontend:
   VITE_API_BASE_URL=https://civicaid-proxy.your-name.workers.dev

## Update ALLOWED_ORIGINS in index.js with your actual Vercel URL
