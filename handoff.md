# Handoff

Owner: Project Engineering Manager
Last updated: 2025-09-11

Use this lightweight snapshot when starting a new chat or passing work.

## Phase 1 Checklist (Targets • Owners)
- Type consolidation → Owner: Claude — Targets: `src/types/**/*`, dedupe types in `src/{contexts,services,hooks}/**/*`
- Enum→const migration → Owner: Claude — Targets: `src/**/*.{ts,tsx}`
- Zod DTO validators at boundaries → Owner: Lead specs → Claude impl — Targets: `src/services/**/*`, `src/lib/stripe-webhooks.ts`, adapters in `src/utils/validation/*`
- Date parsing/coercion at import boundaries → Owner: Claude — Targets: `src/services/import*`, `src/utils/*`
- Realtime payload type-guards → Owner: Claude — Targets: `src/services/realtime*`, `src/contexts/**/*`
- Offline/Push/Fuse types hardened → Owner: Claude — Targets: `src/services/{offline,push}*`, `src/utils/search/*`
- Async return type correctness → Owner: Claude — Targets: `src/services/**/*`, `src/hooks/**/*`
- Replace defensive casts with typed adapters → Owner: Claude — Targets: `src/{services,contexts,hooks}/**/*`

- Summary: Continue Phase 0 stabilization — fix TypeScript errors, enforce CI gates, and remove console.log/TODO debt. Ship small, verified PRs only.
- Summary: Phase 0.5 completed – cleared remaining TS blockers across dashboard layouts, predictive loading, push notifications, offline/reports services; build passes locally. Proceed to Claude’s consolidation phases with a green baseline.
 - Summary: CI guardrails updated — gitleaks enabled, tests added to quality-gates, tracked .env files removed. Pending verification of local build/lint/tests.

- Constraints:
  - Financial correctness: Decimal at boundaries; number for rendering only.
  - Small, surgical PRs; run build:check + lint + tests locally before handoff.

- Current Tasks (owner → in progress):
  - Fix remaining TypeScript errors systematically (category by category) — DONE for web package
  - Remove all console.log statements in app code (use logger)
  - Remove all TODO comments or convert to tracked issues
  - Enable gitleaks in CI — ADDED; rotate any exposed keys — PENDING
  - Remove tracked `.env.*` files — DONE
  - Add tests to CI quality gates — ADDED
  - Add zod validators at app boundaries (API/Supabase/Stripe)
  - Document error taxonomy and user-facing mappings
  - Add unit tests for money/parsers/formatters
  - Add integration test for auth + subscription

- Error Snapshot (auto-refresh with `npm run handoff:update`):
  <!-- ERROR_SNAPSHOT_START -->
  - Snapshot: 2025-09-13T00:00:00.000Z — local build green
  - TypeScript Errors: 0 (wealthtracker-web)
  - Key fixes shipped:
    - Dashboard V2: unified Layouts with react-grid-layout; fixed saveLayout contract
    - Analytics widgets: widened type to string to avoid union drift
    - Predictive loading: enum → const object; hook typed to PreloadPriority
    - Push notifications: defined NotificationAction; SW registration export; typed SW options
    - Offline services: typed unions and logger usage; queue store typing
    - Import services (OFX/QIF): correct Date parsing, addTransaction typings, field names
    - Realtime service: added type guards for payload.new/old; fixed dbUserId filter
    - Reports page: category percentage type aligned
  <!-- ERROR_SNAPSHOT_END -->

- Recent Changelog (2025-09-11):
  - Fixed 121 TypeScript errors (1,856 → 1,735)
  - Added missing properties to interfaces (creditLimit, hasTestData)
  - Fixed React component return types (null → Fragment)
  - Added missing logger imports
  - Fixed Decimal.js method calls

- Next Handoff:
  - Verify Phase 0 gates locally (`npm ci && npm run lint && npm run build:check && npm run test:ci`)
  - Mark CI required checks in repo settings (lint/type/build/tests/gitleaks)
  - Begin Phase 1 (Type Consolidation): unify duplicate types across services (dashboard, reports, financial plans)
  - Enum→const sweep where still present; literal unions at boundaries
  - Realtime/offline adapters with zod/guards at app boundaries
