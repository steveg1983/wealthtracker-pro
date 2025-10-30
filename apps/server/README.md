# Server Application Placeholder

`apps/server` currently contains the legacy backend scaffold relocated from the root.
Future work:
- Audit existing code and determine applicability
- Introduce API service or worker processes as part of monorepo
- Consume shared modules (`@wealthtracker/core`, `@wealthtracker/utils`, `@wealthtracker/types`) for Supabase access, auto-sync glue, and Decimal utilities once backend implementation begins
- Wire into shared configuration packages when extracted
