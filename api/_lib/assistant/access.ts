/**
 * Whether a person may ask the in-app assistant, and how much they have asked.
 *
 * The owner's ruling (14 Nov 2026): offered on the top tier only, and
 * switched on per account. So the answer needs both a row in
 * `assistant_access` (switched on) and a reason to honour it: the row is
 * `complimentary` (switched on by hand, such as the owner's own account) or
 * the account holds an active Pro subscription. A Pro subscriber with no row
 * is not switched on; a row with neither reason is a switch with nothing
 * behind it.
 *
 * The allowance is counted from `assistant_usage`, one row per answered
 * question, over the calendar month in UTC.
 *
 * The decision is a pure function of three facts so a spec can state each
 * case; the reader is the one place that asks the database for them.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Subscription statuses that still carry the plan, as /api/subscriptions/status reads them. */
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

export type AssistantRefusal = 'not_switched_on' | 'not_on_pro' | 'allowance_used';

export interface AssistantAccess {
  allowed: boolean;
  /** Why not, when not. */
  reason: AssistantRefusal | null;
  /** Questions answered this calendar month. */
  used: number;
  /** Questions allowed this calendar month; 0 when not switched on. */
  limit: number;
}

export interface AccessFacts {
  /** The account's row, or null when it was never switched on. */
  row: { enabled: boolean; complimentary: boolean; monthly_question_limit: number } | null;
  /** The newest subscription's tier and status, or null when there is none. */
  subscription: { tier: string; status: string } | null;
  used: number;
}

export function decideAccess(facts: AccessFacts): AssistantAccess {
  const { row, subscription, used } = facts;
  if (!row || !row.enabled) {
    return { allowed: false, reason: 'not_switched_on', used, limit: 0 };
  }
  const onPro = subscription !== null && subscription.tier === 'pro' && LIVE_STATUSES.has(subscription.status);
  if (!row.complimentary && !onPro) {
    return { allowed: false, reason: 'not_on_pro', used, limit: row.monthly_question_limit };
  }
  if (used >= row.monthly_question_limit) {
    return { allowed: false, reason: 'allowance_used', used, limit: row.monthly_question_limit };
  }
  return { allowed: true, reason: null, used, limit: row.monthly_question_limit };
}

/** The first instant of `now`'s calendar month, UTC. */
export const monthStart = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export class AccessLookupError extends Error {}

/** Read the three facts for one account and decide. Throws AccessLookupError when the database does not answer. */
export async function readAssistantAccess(supabase: SupabaseClient, userId: string, now: Date): Promise<AssistantAccess> {
  const [access, subscription, usage] = await Promise.all([
    supabase
      .from('assistant_access')
      .select('enabled, complimentary, monthly_question_limit')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('assistant_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', monthStart(now).toISOString()),
  ]);

  if (access.error) throw new AccessLookupError(`assistant_access: ${access.error.message}`);
  if (subscription.error) throw new AccessLookupError(`subscriptions: ${subscription.error.message}`);
  if (usage.error) throw new AccessLookupError(`assistant_usage: ${usage.error.message}`);

  const row = access.data as AccessFacts['row'];
  const sub = subscription.data as AccessFacts['subscription'];
  return decideAccess({ row: row ?? null, subscription: sub ?? null, used: usage.count ?? 0 });
}
