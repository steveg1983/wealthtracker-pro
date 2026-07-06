import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken, createClerkClient } from '@clerk/backend';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { getRequiredEnv, getOptionalEnv } from '../_lib/env.js';
import { getStripe } from '../_lib/stripe.js';
import { applyRateLimit } from '../_lib/rate-limit.js';
import { captureServerError, withSentry } from '../_lib/sentry.js';

/**
 * Self-service account deletion — GDPR Art. 17 (right to erasure).
 *
 * Removes, in order:
 *   1. Stripe customer (cancels any active subscription so billing stops)
 *   2. All database rows: users row cascades every financial table
 *      (accounts, transactions, budgets, goals, categories, investments,
 *      banking tables — all FK ON DELETE CASCADE); plus the tables keyed
 *      outside that cascade (financial_audit_log, user_profiles,
 *      recurring_transactions, subscription rows by clerk id)
 *   3. The Clerk identity
 *
 * Auth is self-contained (verifyToken, not requireAuth): requireAuth 404s
 * when the users row is already gone, which would make a retry after a
 * partial failure impossible. Here a retry simply skips already-deleted
 * stages.
 *
 * Requires body { confirmation: "DELETE MY ACCOUNT" } — the UI makes the
 * user type it; the API enforces it.
 */

const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

interface DeleteAccountRequest {
  confirmation?: string;
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
  }

  if (await applyRateLimit(req, res, { name: 'account-delete', limit: 3, windowMs: 60_000 })) {
    return;
  }

  // ── Self-contained auth ────────────────────────────────────────────────
  const header = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token', code: 'missing_auth' });
  }

  let clerkUserId: string;
  try {
    const payload = await verifyToken(token, { secretKey: getRequiredEnv('CLERK_SECRET_KEY') });
    if (!payload.sub) throw new Error('no sub');
    clerkUserId = payload.sub;
  } catch {
    return res.status(401).json({ error: 'Invalid authentication token', code: 'invalid_auth' });
  }

  const body = (req.body ?? {}) as DeleteAccountRequest;
  if (body.confirmation !== CONFIRMATION_PHRASE) {
    return res.status(400).json({
      error: `Confirmation phrase required: "${CONFIRMATION_PHRASE}"`,
      code: 'confirmation_required'
    });
  }

  const supabase = getServiceRoleSupabase();
  const warnings: string[] = [];

  try {
    // Resolve the internal user row (may already be gone on a retry).
    const userResult = await supabase
      .from('users')
      .select('id, stripe_customer_id')
      .eq('clerk_id', clerkUserId)
      .maybeSingle();
    const userRow = userResult.data as { id: string; stripe_customer_id: string | null } | null;

    // ── 1. Stripe: stop billing ──────────────────────────────────────────
    if (userRow?.stripe_customer_id && getOptionalEnv('STRIPE_SECRET_KEY')) {
      try {
        // Deleting the customer cancels active subscriptions immediately.
        // Stripe retains invoices for its own legal record-keeping.
        await getStripe().customers.del(userRow.stripe_customer_id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'stripe error';
        if (!msg.includes('No such customer')) {
          console.error('[account-delete] Stripe customer deletion failed', { clerkUserId, msg });
          warnings.push('billing_cleanup_incomplete');
        }
      }
    }

    // ── 2. Database erasure ──────────────────────────────────────────────
    if (userRow) {
      // Tables NOT covered by the users-row cascade:
      const { error: auditErr } = await supabase
        .from('financial_audit_log')
        .delete()
        .eq('user_id', userRow.id);
      if (auditErr) warnings.push(`financial_audit_log: ${auditErr.message}`);
    }

    const { error: recurringErr } = await supabase
      .from('recurring_transactions')
      .delete()
      .eq('user_id', clerkUserId);
    if (recurringErr) warnings.push(`recurring_transactions: ${recurringErr.message}`);

    const { error: profileErr } = await supabase
      .from('user_profiles')
      .delete()
      .eq('clerk_user_id', clerkUserId);
    if (profileErr) warnings.push(`user_profiles: ${profileErr.message}`);

    // subscription_logs is deliberately NOT erased here: it stores only Stripe
    // event identifiers and {type, created} (see api/stripe/webhook.ts) — no
    // user_id, email, or other PII — and serves as the webhook idempotency
    // ledger. Like Stripe's own retained invoices, it falls outside the GDPR
    // erasure scope, so there is nothing user-identifiable to remove.

    if (userRow) {
      // The big one: ON DELETE CASCADE removes accounts, transactions,
      // budgets, goals, categories, investments, subscriptions, invoices,
      // payment methods, and the entire banking tree.
      const { error: userErr } = await supabase
        .from('users')
        .delete()
        .eq('id', userRow.id);
      if (userErr) {
        console.error('[account-delete] users row deletion failed', { clerkUserId, message: userErr.message });
        // GDPR erasure failure — must be seen and followed up.
        await captureServerError(new Error(`account erasure failed: ${userErr.message}`), {
          handler: 'account-delete',
          code: userErr.code
        });
        return res.status(500).json({
          error: 'Data deletion failed — please retry or contact support',
          code: 'deletion_failed'
        });
      }
    }

    // ── 3. Clerk identity ────────────────────────────────────────────────
    try {
      const clerk = createClerkClient({ secretKey: getRequiredEnv('CLERK_SECRET_KEY') });
      await clerk.users.deleteUser(clerkUserId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'clerk error';
      console.error('[account-delete] Clerk user deletion failed', { clerkUserId, msg });
      // Data is gone; identity removal failed. The token is still valid, so
      // the client can retry — this endpoint tolerates the missing users row.
      return res.status(500).json({
        error: 'Your data was deleted but identity removal failed — please retry',
        code: 'identity_deletion_failed'
      });
    }

    if (warnings.length > 0) {
      console.warn('[account-delete] Completed with warnings', { clerkUserId, warnings });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[account-delete] Unexpected error', error);
    await captureServerError(error, { handler: 'account-delete' });
    return res.status(500).json({ error: 'Account deletion failed', code: 'internal_error' });
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
