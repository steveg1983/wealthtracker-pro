# Consolidation of wealthtracker-pro into wealthtracker-web

Date: 2025-09-10

## Summary
- `wealthtracker-pro` is deprecated and no longer accepts application code changes.
- `wealthtracker-web` is the canonical frontend codebase.

## Rationale
- Eliminates duplicate maintenance, CI, migrations, and testing burden.
- Avoids divergence and accidental regressions between near-identical apps.

## What moved
- No unique migrations to port (both had the same set).
- Heavy chart dependencies (Chart.js/Plotly) in `-pro` are not adopted in `-web` (standard is Recharts).
- Governance and CI guardrails standardized in `-web`.

## Enforcement
- `-pro` Danger + CI block code changes outside docs/.github.
- `-web` CLAUDE/CI/Danger enforce small, verified PRs.

## Next steps
- Archive `wealthtracker-pro` in GitHub or keep as read-only docs.
- All new frontend work happens in `wealthtracker-web`.

