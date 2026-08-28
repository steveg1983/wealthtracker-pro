/**
 * IS THIS A RULE, OR SOMETHING THAT WOULD MISBEHAVE AS ONE.
 *
 * Neutral by necessity: the carry-over that moves a browser's rules into an
 * account is written in the SHARED service, which a desktop build compiles, so
 * this check cannot live in the cloud store beside the table whose constraints
 * it mirrors. It lives here and both sides read it.
 *
 * The two shape rules are not fussiness. A rule with no conditions matches
 * EVERY transaction ever imported, and a rule with no actions does nothing to
 * any of them — the first is an expensive mistake and the second is a silent
 * one. The database refuses both; so does this, before a bad rule can travel.
 */
import type { ImportRule } from '../../types/importRules';

export function isWellFormed(rule: Partial<ImportRule>): boolean {
  return Boolean(
    rule.name?.trim() &&
    Array.isArray(rule.conditions) && rule.conditions.length > 0 &&
    Array.isArray(rule.actions) && rule.actions.length > 0
  );
}
