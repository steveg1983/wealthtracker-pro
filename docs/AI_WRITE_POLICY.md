# AI Assistant Write Policy

These controls limit write scope and reduce the risk of broad, breaking changes.

## Defaults
- Read‑only by default. Any write requires an explicit plan and a feature branch.
- Limit per PR: ≤ 10 files or ≤ 300 LOC, unless pre‑approved.
- No dependency or configuration changes without explicit reviewer approval.
- No repo‑wide refactors, reformatting, or renames in mixed PRs.

## Prohibited Without Approval
- Adding/upgrading dependencies.
- Changing build/CI, lint, or tsconfig.
- Editing `../supabase/` (except adding a new migration).
- Disabling tests or reducing coverage.

## Required With Every Change
- Verification: build, lint, typecheck, tests, manual validation for the affected area.
- Small, focused diffs matching the PR description.
- Screenshot/GIF for UI changes.

## Enforcement
- DangerJS flags large PRs and dependency changes; label `deps-approved` required for deps.
- DB migration workflow enforces migration presence for DB changes.
- CI guardrails scan for banned patterns and risky TS usage.
