import type { VercelResponse } from '@vercel/node';
import type { ErrorResponse } from '../../src/types/banking-api.js';

/**
 * Standard error response for banking/API endpoints.
 *
 * SECURITY: `details` (raw Supabase/driver error objects, stack traces, etc.)
 * is logged SERVER-SIDE only and is NEVER serialised into the client payload.
 * Returning it leaks internal schema, constraint names, and row ids to callers.
 * The client always receives just `{ error, code }`.
 *
 * This replaces ~13 near-identical per-handler copies, several of which DID
 * spread `details` into the JSON response (audit 2026-06-12, finding #19).
 */
export const createErrorResponse = (
  res: VercelResponse,
  status: number,
  error: string,
  code: string,
  details?: unknown
): VercelResponse => {
  if (details !== undefined) {
    console.error(`[banking] ${code} (${status}): ${error}`, details);
  }
  const payload: ErrorResponse = { error, code };
  return res.status(status).json(payload);
};
