/**
 * Suggestion dismissals — the cloud half.
 *
 * A dismissal says "stop offering me this" and nothing else: no amount, no
 * category, no link, no balance. That is why this service is allowed to be as
 * small as it looks, and why it writes no financial audit entry (see the
 * migration's header for the reasoning).
 *
 * Every method THROWS on failure rather than returning a falsy value. A
 * dismissal that silently fails to save is the exact bug this whole feature
 * exists to fix — the user would answer "yes, never show me this again", see
 * the row vanish for the session, and meet it again tomorrow.
 */

import { supabase, handleSupabaseError } from './supabaseClient';
import { createScopedLogger } from '../../loggers/scopedLogger';
import type { DismissalKind, SuggestionDismissal } from '../../types';

const KINDS: readonly DismissalKind[] = [
  'transfer-pair', 'transfer-leg', 'stranded', 'duplicate',
  'payee-merchant', 'payee-line', 'payee-hidden',
  'recurring-confirmed', 'recurring-not',
];

const asText = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const asKind = (value: unknown): DismissalKind | null =>
  KINDS.find(kind => kind === value) ?? null;

const asTextArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

/**
 * A stored row as the app's type, or null when it is not readable.
 *
 * Unreadable rows are dropped rather than guessed at: a dismissal whose key
 * could not be read cannot hide anything, so the suggestion simply comes back —
 * which is the safe direction to fail in.
 */
function toDismissal(row: Record<string, unknown>): SuggestionDismissal | null {
  const id = asText(row.id);
  const kind = asKind(row.kind);
  const subjectKey = asText(row.subject_key);
  const dismissedAt = asText(row.dismissed_at);
  if (!id || !kind || !subjectKey || !dismissedAt) return null;
  return {
    id,
    kind,
    subjectKey,
    subjectIds: asTextArray(row.subject_ids),
    dismissedAt: new Date(dismissedAt),
  };
}

/** Postgres unique_violation — this suggestion was already dismissed. */
const UNIQUE_VIOLATION = '23505';

export class SuggestionDismissalService {
  private static logger = createScopedLogger('SuggestionDismissalService');

  /** Everything this user has told the sweeps to stop offering. */
  static async list(userId: string): Promise<SuggestionDismissal[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('suggestion_dismissals')
      .select('id, kind, subject_key, subject_ids, dismissed_at')
      .eq('user_id', userId)
      .order('dismissed_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to load suggestion dismissals', error);
      throw new Error(handleSupabaseError(error));
    }

    const rows: SuggestionDismissal[] = [];
    for (const row of data ?? []) {
      const dismissal = toDismissal(row);
      if (dismissal) rows.push(dismissal);
    }
    return rows;
  }

  /**
   * Record a refusal. Idempotent: refusing something already refused returns
   * the existing record rather than raising, so a double-click (or a second
   * device) cannot turn a decision into an error message.
   */
  static async dismiss(
    userId: string,
    kind: DismissalKind,
    subjectKey: string,
    subjectIds: string[]
  ): Promise<SuggestionDismissal> {
    if (!supabase) {
      throw new Error('Not connected — this refusal could not be saved.');
    }

    const { data, error } = await supabase
      .from('suggestion_dismissals')
      .insert({ user_id: userId, kind, subject_key: subjectKey, subject_ids: subjectIds })
      .select('id, kind, subject_key, subject_ids, dismissed_at')
      .single();

    if (error && error.code === UNIQUE_VIOLATION) {
      const existing = await this.find(userId, kind, subjectKey);
      if (existing) return existing;
    }
    if (error) {
      this.logger.error('Failed to save suggestion dismissal', error);
      throw new Error(handleSupabaseError(error));
    }

    const dismissal = data ? toDismissal(data) : null;
    if (!dismissal) {
      throw new Error('This refusal was saved but could not be read back — reload and check.');
    }
    return dismissal;
  }

  /** Undo a refusal: the suggestion is offered again from the next scan. */
  static async restore(userId: string, kind: DismissalKind, subjectKey: string): Promise<void> {
    if (!supabase) {
      throw new Error('Not connected — this could not be restored.');
    }

    const { error } = await supabase
      .from('suggestion_dismissals')
      .delete()
      .eq('user_id', userId)
      .eq('kind', kind)
      .eq('subject_key', subjectKey);

    if (error) {
      this.logger.error('Failed to restore dismissed suggestion', error);
      throw new Error(handleSupabaseError(error));
    }
  }

  private static async find(
    userId: string,
    kind: DismissalKind,
    subjectKey: string
  ): Promise<SuggestionDismissal | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('suggestion_dismissals')
      .select('id, kind, subject_key, subject_ids, dismissed_at')
      .eq('user_id', userId)
      .eq('kind', kind)
      .eq('subject_key', subjectKey)
      .maybeSingle();

    if (error || !data) return null;
    return toDismissal(data);
  }
}
