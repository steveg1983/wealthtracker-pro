-- Migration: ensure goals.auto_contribute exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'goals'
      AND column_name = 'auto_contribute'
  ) THEN
    ALTER TABLE public.goals
      ADD COLUMN auto_contribute BOOLEAN DEFAULT false;
  END IF;
END $$;
