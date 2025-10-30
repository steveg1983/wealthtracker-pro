BEGIN;

-- Align subscription_usage conflict target with UUID primary key usage.

ALTER TABLE public.subscription_usage
  DROP CONSTRAINT IF EXISTS subscription_usage_user_id_key;

DROP INDEX IF EXISTS idx_usage_user_id;

ALTER TABLE public.subscription_usage
  ADD CONSTRAINT subscription_usage_user_id_unique UNIQUE (user_id);

CREATE INDEX idx_subscription_usage_user_id ON public.subscription_usage USING btree (user_id);

COMMIT;
