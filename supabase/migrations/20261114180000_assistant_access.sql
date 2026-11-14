-- The in-app assistant ("Ask"): who may use it, and what each question cost.
--
-- The owner's ruling (14 Nov 2026): the assistant is offered on the top tier
-- only, and it is SWITCHED ON PER ACCOUNT. So two facts decide it:
--
--   * assistant_access: a row per account it has been switched on for. A
--     person may ask when `enabled` is true AND either `complimentary` is true
--     (an account switched on by hand, such as the owner's own) or the
--     account holds an active Pro subscription. Nobody has a row until
--     someone writes one: there is no default-on.
--   * assistant_usage: one row per answered question, with the tokens it
--     used. It is how the monthly allowance is counted and how the bill can
--     be read back per person. It holds NO question and NO answer text: the
--     words a person typed about their money are not kept here.
--
-- Nobody but the server reads or writes either table. RLS is on with no
-- policy, and the browser roles hold no grant; the app learns whether Ask is
-- on for it from GET /api/assistant/status.

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_users: public.users does not exist.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply the migrations in order with `npm run db:migrate`.';
  END IF;
  IF to_regclass('public.assistant_access') IS NOT NULL OR to_regclass('public.assistant_usage') IS NOT NULL THEN
    RAISE EXCEPTION 'assistant_tables_already_exist: this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001',
            HINT = 'If something needs changing, write a new migration for it.';
  END IF;
END
$$;

CREATE TABLE public.assistant_access (
  user_id                 uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  enabled                 boolean NOT NULL DEFAULT true,
  -- Switched on without a Pro subscription (the owner's account, a reviewer).
  complimentary           boolean NOT NULL DEFAULT false,
  -- Questions per calendar month (UTC). Counted from assistant_usage.
  monthly_question_limit  integer NOT NULL DEFAULT 200,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT assistant_access_limit_sane CHECK (monthly_question_limit BETWEEN 0 AND 10000)
);

CREATE TABLE public.assistant_usage (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  model          text NOT NULL,
  input_tokens   integer NOT NULL DEFAULT 0,
  output_tokens  integer NOT NULL DEFAULT 0,
  -- How many times Claude read the ledger to answer.
  tool_calls     integer NOT NULL DEFAULT 0,

  CONSTRAINT assistant_usage_counts_sane CHECK (input_tokens >= 0 AND output_tokens >= 0 AND tool_calls >= 0)
);

CREATE INDEX assistant_usage_user_month_idx ON public.assistant_usage (user_id, created_at DESC);

COMMENT ON TABLE public.assistant_access IS
  'Accounts the in-app assistant (Ask) is switched on for. Allowed when enabled AND (complimentary OR an active Pro subscription). Server-only: RLS on, no policy, no grant to the browser roles.';
COMMENT ON TABLE public.assistant_usage IS
  'One row per question the in-app assistant answered: model and token counts, never the question or the answer. Counts the monthly allowance. Server-only.';

ALTER TABLE public.assistant_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.assistant_access FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.assistant_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.assistant_access TO service_role;
GRANT ALL ON TABLE public.assistant_usage TO service_role;
