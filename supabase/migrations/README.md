# Migrations — the rules

The migration history was reconciled against the live database on 2026-07-30:
every file in this directory is recorded as applied, `npm run db:migrate`
reports "Remote database is up to date", and it must stay that way. These
rules are what keep it true.

## The rules

1. **Every schema change goes through `npm run db:migrate`.** Never run
   schema SQL in the Supabase SQL editor — the editor records nothing, and
   unrecorded changes are exactly how the history once drifted 49 migrations
   apart from reality.

   ```sh
   npm run db:migration:new <short_name>   # writes the file here
   # edit the file, then:
   SUPABASE_DB_URL="$(grep -m1 '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)" npm run db:migrate
   ```

   (npm does not read `.env.local` on its own — the inline export is needed.)

2. **Never rename a file in this directory.** Filenames are the version
   ids the remote history records; renaming one desyncs local from remote
   and `db push` will try to replay it.

3. **Some early files are recorded as applied even though later migrations
   deliberately replaced what they created** (e.g. `20260309000000`,
   `20260310000400`, `20260310000600`, `20260311000000`, superseded by
   `20260610130000`). That is correct and intentional: history records what
   ran, not what survives. They must never be replayed — which rule 2 and a
   truthful history already guarantee.

4. **Never use `db push --include-all`.** Plain `npm run db:migrate` proposes
   only unrecorded migrations, which is the entire safety model.

5. **If the pooler refuses the connection with `EADDRNOTALLOWED … not in
   tenant allow_list`, that is the IP allowlist, not the password.** The
   dashboard's Network Restrictions hold specific IPs and home IPs are
   dynamic — add the current one and retry.
