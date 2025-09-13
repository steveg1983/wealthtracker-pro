# CLAUDE_WORKFILE.md

Owner: Project Engineering Manager
Last updated: 2025-09-13

Purpose: Single source of truth for collaboration between assistants and humans. Contains non‑negotiable engineering rules, followed by the active handoff snapshot to coordinate ongoing work.

---

## 🚨 Non‑Negotiable Rules — Do Not Modify Or Delete
These rules are mandatory. Do not change, weaken, or remove them without explicit instruction from Steve (Project Owner). Violations result in immediate rejection.

### ⛔ RULE #1: NEVER BREAK THE BUILD
```bash
# BEFORE ANY CODE CHANGES:
npm run build:check  # MUST PASS
npm run lint         # MUST HAVE ZERO ERRORS
npm test             # MUST PASS

# AFTER YOUR CHANGES:
npm run build:check  # MUST STILL PASS
npm run lint         # MUST STILL HAVE ZERO ERRORS
npm test             # MUST STILL PASS

# IF ANY FAIL: DO NOT COMMIT, DO NOT PUSH, FIX IMMEDIATELY
```

### ⛔ RULE #2: NO PARTIAL CHANGES
- NEVER create .backup files — fix the original or don't touch it
- NEVER inject code mid-component — all types/imports go at the top
- NEVER leave work half-done — finish it or revert it
- NEVER commit commented-out code — delete it or keep it active

### ⛔ RULE #3: VERIFY BEFORE CLAIMING SUCCESS
- DO NOT say "I've fixed it" without running verification
- DO NOT say "should work" — prove it works with command output
- DO NOT make bulk changes — one file at a time with verification
- ALWAYS show the output of build/lint/test commands

### ⛔ RULE #4: NO TYPE SAFETY VIOLATIONS
- ZERO `as any` — find the proper type or don't proceed
- ZERO `@ts-ignore` — fix the error properly
- ZERO `as unknown as` — double casts are not allowed
- If you don't know the type, READ THE CODE to find it

### ⛔ RULE #5: SECRETS = INSTANT FAILURE
- NEVER commit .env files with real keys
- NEVER commit API keys, even test ones
- NEVER leave credentials in code
- Check `git status` before EVERY commit

### ⛔ RULE #6: TEST YOUR CHANGES
```bash
# For EVERY change, no matter how small:
1. Make the change
2. npm run build:check  # Must pass
3. npm run lint         # Zero errors
4. npm test             # Must pass
5. npm run dev          # App must start
6. Test the actual feature in browser
7. ONLY THEN commit
```

### ⛔ RULE #7: ERROR HANDLING IS MANDATORY
- Financial components MUST have try-catch blocks
- User actions MUST have error handling
- API calls MUST handle failures
- NO silent failures — log or show errors to user

### ⛔ RULE #8: SMALL, VERIFIABLE CHANGES
- One component at a time
- Show the diff
- Run verification
- Show the output
- Get approval
- Then proceed to next

### ⛔ RULE #9: READ BEFORE WRITING
- ALWAYS read the existing code first
- UNDERSTAND the current patterns
- FOLLOW existing conventions
- DON'T introduce new patterns without discussion

### ⛔ RULE #10: BROKEN CODE = STOP EVERYTHING
If you encounter build, lint, test, or type errors — FIX FIRST before any other work. The codebase must always be in a working state.

---

## 🔴 Verification Checklist (Every Session)

### Before starting work:
- [ ] `npm run build:check` passes
- [ ] `npm run lint` has zero errors
- [ ] `npm test` passes
- [ ] No uncommitted changes (`git status`)

### After EVERY change:
- [ ] Change is small and focused
- [ ] `npm run build:check` still passes
- [ ] `npm run lint` still has zero errors
- [ ] `npm test` still passes
- [ ] Manually tested the feature

### Before ending session:
- [ ] All verification commands pass
- [ ] No .backup files created
- [ ] No commented code added
- [ ] No console.log statements
- [ ] No TODO comments left
- [ ] Documentation updated if needed

---

## PR Checklist (Must Be True To Merge)
- Scoped, reversible change; build/typecheck/lint pass locally
- No secrets, large deps, or public contract changes without approval and documentation
- Tests and docs updated when behavior/architecture changes
- Bundle impact checked; accessibility and logging patterns respected
- Renames/moves: show search results and confirm all references updated; CI green
- DI/service lifecycle changes: link ADR and outline migration
- New/updated deps >10KB gz: attach bundle diff and get explicit approval

---

## Additional Rules For All Coders And AI Assistants
- Read first, code second; modify in place; keep changes surgical
- Build discipline: run `npm run build:check` and `npm run lint` before pushing
- Type safety: no `any`/`unknown` in app code; use precise types
- Logging: no raw `console.*` in app code; use central `logger`
- Financial correctness: use Decimal.js; no floating point for money
- Security hygiene: never commit secrets; use `.env.example` only
- Accessibility: keyboard support, focus management, color contrast ≥44×44 touch targets
- Performance: lazy‑load heavy modules; respect bundle budgets
- Dependencies: add/upgrade only with size, security, rationale notes
- Testing: update/add tests with behavior changes
- Documentation: update docs/ADRs in same PR when architecture changes
- Public contracts: do not change exported types without explicit approval
- Migrations: reversible steps with rollback notes
- Deletions: prove dead code with usage search
- Branch/CI policy: no direct commits to main; all PRs pass all checks

---

## Acceptance Gates (PR Must Pass)
- `npm run build:check` (tsc + vite build) — required
- ESLint — required (no console in app code)
- Unit coverage report present; integration/E2E runs on label or nightly
- gitleaks — required; snyk — non-blocking with alerts
- Bundle-size check — warning gate; hard gate on main branch

---

## Handoff (Live Collaboration)

Use this lightweight snapshot when starting a new chat or passing work.

### Phase 1 Checklist (Targets • Owners)
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

### Error Snapshot (auto-refresh)
<!-- ERROR_SNAPSHOT_START -->
- Snapshot: 2025-09-13T11:53:07.011Z — 1 line(s)
- No relevant errors captured.
  <!-- ERROR_SNAPSHOT_END -->

### Context Error Snapshot (auto-refresh)
<!-- CONTEXT_ERROR_SNAPSHOT_START -->
- Snapshot: 2025-09-13T11:53:07.011Z — 1 line(s)
- No relevant errors captured.
  <!-- CONTEXT_ERROR_SNAPSHOT_END -->

### Recent Changelog (2025-09-11)
- Fixed 121 TypeScript errors (1,856 → 1,735)
- Added missing properties to interfaces (creditLimit, hasTestData)
- Fixed React component return types (null → Fragment)
- Added missing logger imports
- Fixed Decimal.js method calls

### Next Handoff
- Verify Phase 0 gates locally (`npm ci && npm run lint && npm run build:check && npm run test:ci`)
- Mark CI required checks in repo settings (lint/type/build/tests/gitleaks)
- Begin Phase 1 (Type Consolidation): unify duplicate types across services (dashboard, reports, financial plans)
- Enum→const sweep where still present; literal unions at boundaries
- Realtime/offline adapters with zod/guards at app boundaries

