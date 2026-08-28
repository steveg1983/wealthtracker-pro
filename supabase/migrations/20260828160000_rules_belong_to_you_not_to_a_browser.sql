-- ============================================================================
-- RULES BELONG TO YOU, NOT TO A BROWSER — import rules move into the account
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- Import rules have lived in `localStorage` under 'wealthtracker_import_rules'
-- since they were built. Three consequences, all of which the owner met on
-- 28 Aug when he asked what the feature actually does:
--
--   * a rule written on the desktop does not exist on the phone;
--   * clearing site data destroys them with no warning and no backup — they
--     are not in the account export either;
--   * and the SERVER cannot read them, which is why rules have never applied
--     to bank feeds. That is the one that matters most: "categorise
--     transactions as they come in" describes a feed far better than a file
--     someone chose to upload, and the feed was the one path they missed.
--
-- This table is the prerequisite for the feed work. A rule the server cannot
-- read is a rule the sync cannot honour.
--
-- ── SHAPE ───────────────────────────────────────────────────────────────────
--
-- conditions and actions stay JSONB rather than becoming child tables. They
-- are read and written whole, always together with their rule, never queried
-- across — and their shapes (ImportRuleCondition, ImportRuleAction) are
-- already versioned by the TypeScript that owns them. Normalising them would
-- buy a join and cost the one property that matters here: a rule is saved or
-- it is not.
--
-- `priority` is not unique. Two rules may share one, and the app's ordering
-- (priority, then created_at) settles it — a UNIQUE constraint here would make
-- the reorder buttons fail on a collision rather than simply doing what the
-- owner meant.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.import_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  enabled     boolean NOT NULL DEFAULT true,
  priority    integer NOT NULL DEFAULT 1,
  conditions  jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT import_rules_name_not_blank CHECK (length(trim(name)) > 0),
  -- A rule with no conditions would match EVERY transaction, and a rule with
  -- no actions would do nothing to any of them. Both are certainly mistakes,
  -- and the first is an expensive one.
  CONSTRAINT import_rules_has_conditions CHECK (jsonb_array_length(conditions) > 0),
  CONSTRAINT import_rules_has_actions    CHECK (jsonb_array_length(actions) > 0)
);

-- The read the app actually makes: every enabled rule for one person, in the
-- order they are applied.
CREATE INDEX IF NOT EXISTS import_rules_by_owner_priority
  ON public.import_rules (user_id, priority, created_at);

-- ── RLS — the investment_prices/custom_reports pattern exactly ──────────────

ALTER TABLE public.import_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_rules_select_own ON public.import_rules;
CREATE POLICY import_rules_select_own ON public.import_rules
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS import_rules_insert_own ON public.import_rules;
CREATE POLICY import_rules_insert_own ON public.import_rules
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS import_rules_update_own ON public.import_rules;
CREATE POLICY import_rules_update_own ON public.import_rules
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS import_rules_delete_own ON public.import_rules;
CREATE POLICY import_rules_delete_own ON public.import_rules
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

REVOKE ALL ON TABLE public.import_rules FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.import_rules TO authenticated;
GRANT ALL ON TABLE public.import_rules TO service_role;

COMMENT ON TABLE public.import_rules IS
  'Rules that categorise and transform transactions on import. In the account rather than a browser so they follow the user between devices AND so the sync can apply them to bank feeds.';
