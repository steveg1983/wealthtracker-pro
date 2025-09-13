# PROJECT-BIGPICTURE.md

## 🏢 Project Enterprise - World-Class Engineering Excellence

## 🎯 Vision for 1% Quality
WealthTracker aims to deliver a world-class personal finance platform built to Apple-level reliability and zero tolerance for errors. Professional-grade engineering, security-first practices, and rigorous testing drive every decision to achieve market leadership.

**North-star targets (gates, not aspirations):**
- Build and typecheck: zero errors; CI green on main and PRs
- Secrets: none in repo or history; automated scanning in CI
- Type safety: strict on app code; ≤ 1% any/unknown debt accepted only at boundaries with adapters
- Logging and error handling: consistent taxonomy, no raw console in app code
- Tests: 70% unit coverage (services/utils), critical integration and a stable E2E happy path
- Performance: bundle budgets enforced; Core Web Vitals green in prod; no silent runtime errors
- Accessibility: WCAG 2.1 AA on core flows; automated checks in CI

Last updated: 2025-09-11
Owner: Project Engineering Manager

---

Note: This document supersedes and replaces `PROJECT_WORLD_CLASS.md` as the single authoritative “project bible”.

## 📝 Executive Summary
We are moving from a partially refactored, build-unstable codebase to a secure, type-safe, observable, and performant product with uncompromising standards. The plan prioritizes working software first and establishes guardrails so future changes cannot regress quality.

## 🚀 Phased Execution Plan

### Phase 0 — Stabilize And Secure (Blockers First)
**Objective:** Stop the bleeding, make the project reliably build and run, and close security risks.

**Deliverables:**
- Build stability: Fix all TypeScript errors, resolve broken imports
- Security: Remove committed secrets, add CI secret scanning, rotate keys
- Lint/type debt triage: Convert JSX-in-TS files to `.tsx`

**Status:** In Progress — CI gates added (lint/type/build/tests/gitleaks); .env files removed; awaiting verification run

**Definition of Done (Phase 0):**
- `npm run build:check` and CI quality gates (lint/type/build/tests) succeed
- No `.env*` tracked; gitleaks CI job enabled and passing
- No remaining parser/type errors from TSX/TS mismatches or obvious import mistakes

**Phase 0 Checklist (Live):**
- [x] Add CI gitleaks workflow with SARIF upload
- [x] Remove tracked `.env.*` files; rely on `.env.*.example` and CI/env vars
- [x] Add tests step to CI quality gates
- [ ] Verify local build/lint/tests pass (`npm ci && npm run lint && npm run build:check && npm run test:ci`)
- [ ] Confirm CI required checks are enforced in repo settings (manual)

### Phase 1 — Type Safety And Contracts
**Objective:** Establish trustworthy types at boundaries; eliminate silent failures.

**Deliverables:**
- App boundaries use DTO validators (zod) for API/Supabase/Stripe responses
- Contexts, hooks, and services expose precise types
- Replace defensive casts with safe adapters

#### Phase 1 Checklist (Targets • Owners • Files)
| Task | Owner | Targets/Files | Status |
|------|-------|---------------|--------|
| Type consolidation (single source of truth) | Claude | `src/types/**/*`, remove duplicates in `src/{contexts,services,hooks}/**/*` | ⏳ |
| Enum→const migration (literal unions) | Claude | Affected enums in `src/**/*.{ts,tsx}` | ⏳ |
| Zod DTO validators at boundaries | Lead specs → Claude impl | `src/services/**/*` (API/Supabase), `src/lib/stripe-webhooks.ts`, adapters in `src/utils/validation/*` | ⏳ |
| Date parsing/coercion at import boundaries | Claude | Importers in `src/services/import*`, relevant utils in `src/utils/*` | ⏳ |
| Realtime payload type-guards | Claude | `src/services/realtime*`, `src/contexts/**/*` | ⏳ |
| Offline/Push/Fuse types hardened | Claude | `src/services/{offline,push}*`, `src/utils/search/*` | ⏳ |
| Async return type correctness | Claude | `src/services/**/*`, `src/hooks/**/*` | ⏳ |
| Replace defensive casts with typed adapters | Claude | `src/{services,contexts,hooks}/**/*` | ⏳ |

Notes:
- All new validators live under `src/utils/validation/` and are imported at boundaries only.
- Domain types live in `src/types/` and are re-exported from a single index to avoid drift.

### Phase 2 — Error Handling And Logging
**Objective:** Consistent, privacy-safe logging with actionable context.

**Deliverables:**
- Central logger only; ESLint forbids raw console in app code
- Error taxonomy and mapping to user-visible messages
- Sentry wired via env flags; PII redaction enforced

### Phase 3 — Dependency Injection And Composition
**Objective:** One DI strategy; predictable lifecycles; testable services.

**Deliverables:**
- Adopt DI container consistently
- Register services with scopes and tags
- Document service graph

### Phase 4 — Testing Excellence
**Objective:** Useful tests that catch regressions without slowing iteration.

**Deliverables:**
- Unit tests for utility and calculation modules (70%+ coverage)
- Integration tests for critical flows (auth, subscriptions, exports)
- E2E happy-path smoke on Playwright tri-browser

### Phase 5 — Performance, Bundling, And DX
**Objective:** Fast, observable, and cheap to run.

**Deliverables:**
- Route-based code splitting; heavy libs lazy-loaded
- Lighthouse budget in CI; bundle-size check gates PRs
- Core Web Vitals green on test deploy

### Phase 6 — Accessibility
**Objective:** WCAG 2.1 AA on key flows; regressions prevented.

**Deliverables:**
- Axe checks in CI on core pages
- Keyboard navigation verified
- Color contrast palette verified

### Phase 7 — CI/CD Guardrails
**Objective:** Prevent regressions by default; shorten feedback loops.

**Deliverables:**
- Lint + typecheck as required checks
- gitleaks scanning; Snyk audit; bundle budget
- Pre-commit hooks for staged files

---

## 📋 Living Checklist & Tasks

### Current Sprint (2025-09-13)
| Date       | Owner  | Task                                      | Status |
|------------|--------|-------------------------------------------|--------|
| 2025-09-13 | Team   | Fix remaining TypeScript errors          | 🔄     |
| 2025-09-13 | Team   | Remove all console.log statements        | ⏳     |
| 2025-09-13 | Team   | Remove all TODO comments                 | ⏳     |
| 2025-09-13 | Team   | Enable gitleaks in CI                    | ✅     |
| 2025-09-13 | Team   | Remove tracked .env files                | ✅     |
| 2025-09-13 | Team   | Add tests to CI quality gates            | ✅     |
| 2025-09-13 | Team   | Add zod validators at boundaries         | ⏳     |
| 2025-09-13 | Team   | Document error taxonomy                  | ⏳     |
| 2025-09-13 | Team   | Unit tests for money/parsers/formatters  | ⏳     |
| 2025-09-13 | Team   | Integration test: auth + subscription    | ⏳     |

**Legend:** ✅ Done | 🔄 In Progress | ⏳ Pending | ❌ Blocked

### Error Snapshot (Current Build Status)
- **TypeScript Errors:** 1,735
- **Main Categories:**
  - TS2339: Property doesn't exist (439 instances)
  - TS2322: Type assignment errors (230 instances)
  - TS2345: Argument type errors (180 instances)
  - TS2304: Cannot find name (104 instances)

### Context Error Snapshot
Auto-refreshed by `npm run handoff:update`.

<!-- CONTEXT_ERROR_SNAPSHOT_START -->
- Snapshot: 2025-09-11T00:00:00.000Z — no detailed lines captured
- Use `npm run handoff:update` to populate the latest top errors
<!-- CONTEXT_ERROR_SNAPSHOT_END -->

### Recent Changelog (2025-09-11)
- Fixed 121 TypeScript errors (1,856 → 1,735)
- Added missing properties to interfaces (creditLimit, hasTestData)
- Fixed React component return types (null → Fragment)
- Added missing logger imports
- Fixed Decimal.js method calls

---

## 🚨 BULLETPROOF RULES - MANDATORY FOR ALL CODERS
**⚠️ MUST NOT DELETE BY ANYONE UNLESS INSTRUCTED BY STEVE (PROJECT OWNER) ⚠️**
**THESE RULES ARE NON-NEGOTIABLE. VIOLATION = IMMEDIATE REJECTION**

### ⛔ RULE #1: NEVER BREAK THE BUILD
```bash
# BEFORE ANY CODE CHANGES:
npm run build:check  # MUST PASS
npm run lint         # MUST HAVE ZERO ERRORS
npm test            # MUST PASS

# AFTER YOUR CHANGES:
npm run build:check  # MUST STILL PASS
npm run lint         # MUST STILL HAVE ZERO ERRORS
npm test            # MUST STILL PASS

# IF ANY FAIL: DO NOT COMMIT, DO NOT PUSH, FIX IMMEDIATELY
```

### ⛔ RULE #2: NO PARTIAL CHANGES
- **NEVER** create .backup files - fix the original or don't touch it
- **NEVER** inject code mid-component - all types/imports go at the top
- **NEVER** leave work half-done - finish it or revert it
- **NEVER** commit commented-out code - delete it or keep it active

### ⛔ RULE #3: VERIFY BEFORE CLAIMING SUCCESS
- **DO NOT** say "I've fixed it" without running verification
- **DO NOT** say "should work" - prove it works with command output
- **DO NOT** make bulk changes - one file at a time with verification
- **ALWAYS** show the output of build/lint/test commands

### ⛔ RULE #4: NO TYPE SAFETY VIOLATIONS
- **ZERO** `as any` - find the proper type or don't proceed
- **ZERO** `@ts-ignore` - fix the error properly
- **ZERO** `as unknown as` - this is a double cast and always wrong
- If you don't know the type, READ THE CODE to find it

### ⛔ RULE #5: SECRETS = INSTANT FAILURE
- **NEVER** commit .env files with real keys
- **NEVER** commit API keys, even test ones
- **NEVER** leave credentials in code
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
- NO silent failures - log or show errors to user

### ⛔ RULE #8: SMALL, VERIFIABLE CHANGES
- One component at a time
- Show the diff
- Run verification
- Show the output
- Get approval
- Then proceed to next

### ⛔ RULE #9: READ BEFORE WRITING
- **ALWAYS** read the existing code first
- **UNDERSTAND** the current patterns
- **FOLLOW** existing conventions
- **DON'T** introduce new patterns without discussion

### ⛔ RULE #10: BROKEN CODE = STOP EVERYTHING
If you encounter:
- Build errors → FIX FIRST before ANY other work
- Lint errors → FIX FIRST before ANY other work  
- Test failures → FIX FIRST before ANY other work
- Type errors → FIX FIRST before ANY other work

**THE CODEBASE MUST ALWAYS BE IN A WORKING STATE**

---

## 🔴 VERIFICATION CHECKLIST (EVERY SESSION)

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
- The change is scoped and reversible. Build, typecheck, and lint pass locally.
- No secrets, large deps, or public contract changes without approval and documentation.
- Tests added/updated where behavior changed; docs/ADRs updated if architecture changed.
- Bundle impact checked; accessibility and logging patterns respected.
- If files were renamed/moved: show search results and confirm all references updated; CI green.
- If DI topology or service lifecycles changed: link ADR and outline migration.
- If new/updated deps exceed 10KB gz: attach bundle diff and get explicit approval.

---

## Additional Rules For All Coders And AI Assistants

- **Read First, Code Second:** Inspect existing code and understand behavior before changing anything.
- **Modify In Place:** Do not create "-copy" or "-refactored" duplicates.
- **Keep Changes Surgical:** One logical change per PR. No drive‑by edits.
- **Build Discipline:** Before pushing, run `npm run build:check` and `npm run lint`.
- **Type Safety:** No `any`/`unknown` in app code. Use precise types.
- **Logging:** No raw `console.*` in app code. Use the central `logger`.
- **Financial Correctness:** Never use floating point for money. Use Decimal.js.
- **Security Hygiene:** Never commit secrets; use `.env.example` only.
- **Accessibility:** Keyboard support, focus management, color contrast ≥44×44 touch targets.
- **Performance:** Lazy‑load heavy modules; respect bundle budgets.
- **Dependency Changes:** Do not add/upgrade deps without size, security, and rationale notes.
- **Testing:** Update or add tests with behavior changes.
- **Documentation:** When altering architecture, update docs/ADRs in the same PR.
- **Public Contracts:** Do not change exported types without explicit approval.
- **Migrations:** Write reversible steps and rollback notes.
- **Deletions:** Search usages to prove dead code.
- **Branch/CI Policy:** No direct commits to main. All PRs must pass all checks.

---

## Assignment Guidance (What Assistants Can Safely Do)

### Allowed for assistants (under review):
- Documentation updates, ADR drafting from our decisions
- Unit tests for pure utils (formatters, parsers, currency), no side effects
- Lint fixes that do not change runtime behavior
- Simple type fixes in leaf modules (no public API changes)

### Reserved for lead engineer:
- Security (keys, gitleaks, history purge)
- DI/container migrations; public type contracts; error taxonomy
- Build pipeline and bundle strategy
- Any changes touching financial math or data integrity

---

## Acceptance Gates (PR Must Pass)
- `npm run build:check` (tsc + vite build) – required
- ESLint – required (no console in app code)
- Unit coverage report present; integration/E2E run on label or nightly
- gitleaks – required; snyk – non-blocking with alerts
- Bundle-size check – warning gate; hard gate on main branch

---

## Context Log
Lightweight, rolling record to keep assistants and humans aligned across chat sessions.

Entry Template (append new entries at the top)
- Summary: <1–2 sentences on current goal/scope>
- Decisions (YYYY-MM-DD):
  - <Decision> — <Reason>
- Constraints:
  - <Guardrails and “do not touch” areas>
- Current Tasks (owner → status):
  - <Task> — <Done/In progress/Blocked>
- Error Snapshot:
  - <Top relevant build/type errors with file:line>
- Changelog (YYYY-MM-DD):
  - <file> — <1 line rationale>
- Next Handoff:
  - <What’s next, risks, owners>

### Latest Entry (2025-09-11)
- **Summary:** Fixing TypeScript errors systematically to achieve build stability. Currently at 1,735 errors from initial 1,856.
- **Decisions:**
  - Fix errors systematically by category
  - No `as any` or `@ts-ignore` allowed
  - Small, verifiable changes only
- **Constraints:**
  - Must not break existing functionality
  - Follow existing patterns
  - Verify each change with build:check
- **Current Tasks:**
  - Continue fixing TypeScript errors → In Progress
  - Remove console.log statements → Pending
  - Remove TODO comments → Pending
- **Next Handoff:**
  - Complete TypeScript error fixes
  - Enable CI gates on main branch
  - Begin Phase 1 (Type Safety)

---

## 🎯 Alignment References
- See [CLAUDE.md](CLAUDE.md) for core project principles and standards
- See [CLAUDE_REQUIREMENTS.md](CLAUDE_REQUIREMENTS.md) for mandatory checklist

---

**"Excellence isn't a slogan; it's a gate."**
