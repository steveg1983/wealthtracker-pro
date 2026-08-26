import type { VercelRequest } from '@vercel/node';
import { verifyToken } from '@clerk/backend';
import { getRequiredEnv, getOptionalEnv } from './env.js';
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

let hasWarnedAboutMissingAuthorizedParties = false;

/**
 * Origins whose Clerk session tokens this API will accept, from
 * CLERK_AUTHORIZED_PARTIES (comma-separated, e.g.
 * "https://app.example.com,http://localhost:5173").
 *
 * Without it, verifyToken ignores the token's `azp` claim, so ANY token minted
 * by this Clerk instance is accepted — including one issued to a different
 * front end sharing the instance. We cannot fail closed on an unset value
 * because existing deploys do not set it yet and every API route would go dark;
 * instead we warn on each cold start until it is configured.
 */
const getAuthorizedParties = (): string[] | undefined => {
  const parties = (getOptionalEnv('CLERK_AUTHORIZED_PARTIES') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (parties.length > 0) {
    return parties;
  }

  if (!hasWarnedAboutMissingAuthorizedParties) {
    hasWarnedAboutMissingAuthorizedParties = true;
    console.warn(
      '[auth] CLERK_AUTHORIZED_PARTIES is not set — the token `azp` claim is NOT being verified. ' +
        'Any token from this Clerk instance is accepted regardless of which origin requested it. ' +
        'Set it to the comma-separated list of front-end origins allowed to call this API.'
    );
  }
  return undefined;
};

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

  const authorizedParties = getAuthorizedParties();
  try {
    const payload = await verifyToken(token, { secretKey, authorizedParties });
    clerkUserId = payload.sub;
  } catch (error) {
    // SAY WHY, SERVER-SIDE. This catch used to discard the reason entirely, so
    // every failure — an expired token, the wrong Clerk instance, an origin
    // missing from the list below — arrived as the same four words with
    // nothing behind them.
    //
    // What that cost, measured: on 26 Aug 2026 every authenticated request in
    // production returned 401 for a day. CLERK_AUTHORIZED_PARTIES still named
    // only the old *.vercel.app host, so every token minted for the live
    // domain was refused, and with it went bank feeds, deleting a
    // transaction, billing and live quotes. Nothing in the logs said so: the
    // diagnosis needed the environment read by hand. One line here would have
    // named it.
    //
    // The ORIGIN MISMATCH is called out separately because it is the only one
    // of these that is a deployment mistake rather than a bad token, and it
    // takes down every route at once. The token itself is never logged.
    const reason = error instanceof Error ? error.message : 'unknown verification failure';
    const looksLikeOriginRejection = /authorized part|azp/i.test(reason);
    if (looksLikeOriginRejection) {
      console.error(
        '[auth] Token REJECTED ON ORIGIN, not on validity — this is a configuration error and it ' +
          'fails every authenticated route at once. Set CLERK_AUTHORIZED_PARTIES to the origins ' +
          'this app is actually served from and redeploy. Currently configured: ' +
          `${authorizedParties?.join(', ') ?? '(unset — azp not checked)'}. Reason: ${reason}`
      );
    } else {
      console.error(`[auth] Token verification failed: ${reason}`);
    }
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
