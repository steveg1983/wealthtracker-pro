# AI Assistant Write Policy

Defaults
- Read-only by default; any write on a feature branch only.
- Keep PRs small: ≤ 10 files or ≤ 300 LOC unless pre-approved.
- No dependency or configuration changes without explicit approval.

Required per change
- Lint, typecheck, tests green; update `.env.example` when adding env usage.
- Avoid broad refactors; match PR scope to description.

Enforcement
- Danger flags large PRs and dependency changes; `deps-approved` label required for deps.
- CI guardrail scans for banned patterns and risky TS usage in `src/`.

