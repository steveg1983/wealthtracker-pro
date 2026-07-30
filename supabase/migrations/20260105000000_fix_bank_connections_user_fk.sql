-- Align bank_connections user_id with public.users for Clerk-based auth
ALTER TABLE bank_connections
  DROP CONSTRAINT IF EXISTS bank_connections_user_id_fkey;

ALTER TABLE bank_connections
  ADD CONSTRAINT bank_connections_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users(id)
  ON DELETE CASCADE;
