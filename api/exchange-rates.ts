import type { VercelRequest, VercelResponse } from '@vercel/node'

// Simple serverless proxy with cache headers to fetch exchange rates.
// This centralizes FX data and enables observability/caching on the server.

const DEFAULT_BASE = 'GBP'
const UPSTREAM = 'https://api.exchangerate-api.com/v4/latest'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const base = (req.query.base as string || DEFAULT_BASE).toUpperCase()

  try {
    const upstreamUrl = `${UPSTREAM}/${encodeURIComponent(base)}`
    const response = await fetch(upstreamUrl)

    if (!response.ok) {
      return res.status(502).json({ error: 'Upstream rate provider failed' })
    }

    const json = await response.json()

    // Set cache headers for edge/platform caches
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.status(200).json(json)
  } catch (err: any) {
    console.error('Exchange rates handler error:', err?.message)
    res.status(500).json({ error: 'Internal error' })
  }
}

