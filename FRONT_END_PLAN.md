# Frontend Focus Plan (Q4 2025)

With lint/tests/build fully green, the remaining frontend work is design-quality polish. This page replaces the old “40 % production ready” roadmap.

## 1. Priorities
1. **Accessibility & AXE sweep** – audit dashboard/import flows for WCAG AA issues (focus traps, screen-reader copy, aria labels, colour contrast). Track findings in `docs/regression-audit-20251101.md`.
2. **Visual refinement** – partner with design to tighten typography, spacing, and iconography on the high-traffic routes (Dashboard, Transactions, Imports, Budget).
3. **Bundle UX follow-up** – continue the lazy-loading work from `docs/bundle-optimization-plan.md` without regressing interaction latency. Every heavy widget must show skeletons/loading states.

## 2. Guardrails (unchanged)
- `npm run lint`, `npm run typecheck:strict`, `npm run test:smoke`, `npm run test:realtime` must stay green before any UI polish lands.
- Re-run the regression triad (`docs/regression-audit-20251101.md`) after major UX changes.
- Log bundle-impacting work and shared-context refactors in the regression audit docs.

## 3. Suggested Workflow
1. Pick a flow (e.g., Dashboard KPIs).
2. Run AXE via browser devtools + keyboard-only walkthrough.
3. Patch contrast/focus/semantics, add tests if interactable elements change.
4. Update regression audit with screenshots + before/after notes.

This living note should evolve as soon as the design sweep is underway; remove or archive when the UX polish milestone is complete.
