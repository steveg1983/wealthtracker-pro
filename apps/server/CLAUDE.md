# WealthTracker Backend – Coding Guardrails

## Mission
Professional‑grade API with zero tolerance for regressions. Follow these rules precisely to avoid breaking production.

## 🚨 Bulletproof Rules (Mandatory)
- Never break the build: `npm run build` must pass before and after changes
- Lint/typecheck/tests must pass: `npm run lint`, `npx tsc --noEmit`, `npm test`
- No partial changes or commented‑out code; finish or revert
- No secret material in code or PRs; keep `.env.example` in sync
- Fix build/lint/test/type errors before any other work

## 🔒 Automated Enforcement
- CI required checks: Lint & Typecheck, Jest Tests, Build
- DangerJS: blocks dependency changes unless PR has `deps-approved`; blocks skipped tests; warns on large PRs
- Banned patterns guardrail (CI): rejects `@ts-ignore`, `as any`, `as unknown as`, `*.backup`, `TODO|FIXME` in `src/`
- Commitlint: Conventional Commits required (type(scope): subject)
- Branch protection: code owner review required; conversations resolved; linear history
- Dependabot: weekly to `develop`; verify like any PR
- Runtime pin: Node 20 only (`.nvmrc=20`, `"engines": {"node": ">=20 <21"}`)

## 🤖 AI Assistant Write Policy (Summary)
- Default read‑only; any writes must be small, focused, and on a feature branch
- Keep diffs small: ≤ 10 files or ≤ 300 LOC unless pre‑approved
- No dependency or config changes without reviewer approval and `deps-approved` label
- Always verify locally: build, lint, typecheck, tests, then push

## API & Data Safety
- Validate inputs (Joi/Zod), sanitize outputs; never echo raw error messages to clients
- Use structured logging; no stray `console.log` in `src/`
- Rate‑limit sensitive endpoints; handle timeouts and Supabase errors explicitly
- Database/Supabase schema changes belong in the app(s) that own migrations; coordinate changes across repos and document rollback

## PR Requirements
- PR template checklists completed; include reproduction, risk, rollback plan
- Screenshots/logs for behavior changes; link to Linear/GitHub issue
- No skipping tests; add tests when fixing bugs or introducing new behavior

## Commands
```bash
npm run lint
npx tsc --noEmit
npm test -- --ci
npm run build
```

Quality over speed. Understanding over guessing. Financial software demands precision.

