import type { VercelRequest } from '@vercel/node';
import { verifyToken } from '@clerk/backend';
import { getRequiredEnv } from './env.js';
import { getServiceRoleSupabase } from './supabase.js';

export interface AuthContext {
  clerkUserId: string;
  userId: string;
}

export class AuthError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const getBearerToken = (req: VercelRequest): string | null => {
  const header = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization ?? '';
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length).trim() || null;
};

export const requireAuth = async (req: VercelRequest): Promise<AuthContext> => {
  const token = getBearerToken(req);
  if (!token) {
    throw new AuthError('Missing authentication token', 'missing_auth', 401);
  }

  const secretKey = getRequiredEnv('CLERK_SECRET_KEY');
  let clerkUserId: string | undefined;

  try {
    const payload = await verifyToken(token, { secretKey });
    clerkUserId = payload.sub;
  } catch {
    throw new AuthError('Invalid authentication token', 'invalid_auth', 401);
  }

  if (!clerkUserId) {
    throw new AuthError('Missing user identity', 'invalid_auth', 401);
  }

  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', clerkUserId)
    .single();

  if (error || !data?.id) {
    throw new AuthError('User profile not found', 'user_not_found', 403);
  }

  return {
    clerkUserId,
    userId: data.id
  };
};
