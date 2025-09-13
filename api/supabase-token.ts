import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf.toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function signHS256(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encHeader = base64url(JSON.stringify(header))
  const encPayload = base64url(JSON.stringify(payload))
  const data = `${encHeader}.${encPayload}`
  const signature = crypto.createHmac('sha256', secret).update(data).digest()
  const encSig = base64url(signature)
  return `${data}.${encSig}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).send('Method Not Allowed')
  }

  res.setHeader('Cache-Control', 'no-store')

  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    return res.status(500).json({ error: 'Missing SUPABASE_JWT_SECRET' })
  }

  // Attempt to verify Clerk session token using @clerk/backend if available
  let clerkId: string | null = null
  try {
    const authHeader = (req.headers['authorization'] as string) || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (bearer && process.env.CLERK_SECRET_KEY) {
      try {
        // Dynamic import to avoid hard dependency during local builds
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const backend = await import('@clerk/backend').catch(() => null)
        if (backend?.createClerkClient) {
          const clerkClient = backend.createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
          const sessionClaims = await clerkClient.verifyToken(bearer)
          // Prefer userId/sub if available
          clerkId = (sessionClaims?.sub || sessionClaims?.userId || sessionClaims?.id || '') as string
        }
      } catch {
        // Swallow and fall through to dev fallback
      }
    }
  } catch {
    // Ignore and try fallback
  }

  // Dev fallback: allow explicit header when not in production
  if (!clerkId && process.env.NODE_ENV !== 'production') {
    const debugId = (req.headers['x-debug-clerk-id'] as string) || ''
    if (debugId) clerkId = debugId
  }

  if (!clerkId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    role: 'authenticated',
    clerk_id: clerkId,
    iat: now,
    exp: now + 15 * 60, // 15 minutes
  }
  const token = signHS256(payload, secret)
  return res.status(200).json({ token })
}

