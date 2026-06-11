# Accessibility Audit (WCAG 2.1 A/AA) — 2026-06-11

**Tool**: `npm run audit:a11y` (scripts/audit-accessibility.mjs) — axe-core via
Playwright against the dev server in demo mode, real browser rendering (so
color-contrast results are valid). 26 routes scanned. Reports in
`logs/accessibility/`.

## Result

| | Before | After |
|---|---|---|
| Serious/critical violation types across routes | **43** | **0** |

The docs' standing WCAG 2.1 AA claim was unverified until this run — and was
false. It is now true for the automated-checkable rule set on every routed
page.

## What was broken (and fixed)

**One global critical on all 26 pages**: the persistent header search input
used combobox ARIA attributes (`aria-expanded`, `aria-autocomplete`,
`aria-controls`) without `role="combobox"` — invalid ARIA on every page
render. Fixed with the proper combobox role + label (GlobalSearch.tsx).

**Invalid ARIA grid (Calendar)**: `role="grid"`/`role="row"` on a CSS-grid
month view whose children were plain divs — ARIA grid demands a strict
grid→row→gridcell tree plus arrow-key navigation that was never implemented.
Removed the grid semantics; days with transactions are now keyboard-reachable
buttons (Tab + Enter/Space) with descriptive labels — fixing a WCAG 2.1.1
keyboard failure that axe's structural rules only hinted at.

**Tabs without a tablist (ReportsHub)**: `role="tab"` buttons with no
`role="tablist"` parent.

**Unlabeled form controls (~40 nodes)**: selects with no accessible name
(Reports filters, ExportManager, DocumentManager, OnboardingModal currency,
AppSettings currency, SecuritySettings session timeout), date inputs
(ExportManager), a number input and range slider (alert settings), and 17+
toggle checkboxes/buttons whose only content was a styled track div
(AppSettings, NotificationSettings, PushNotificationSettings,
AutomaticBackupSettings, NotificationCenter). All toggles also gained
`aria-pressed` state.

**Unnamed icon buttons**: Categories page edit/save/cancel/expand buttons.

**Color contrast (~25 nodes)**: white text on tailwind 500/600-shade buttons
(green, emerald, teal, cyan, orange, red, indigo, purple, yellow — mostly
DataManagement) and emerald-600/yellow-600 text on white, all below the 4.5:1
AA ratio. Darkened one–two shades; hover states adjusted to match.

## Honest limitations — what automated checks do NOT prove

axe-core covers roughly 30–40% of WCAG. Still outstanding for a full AA claim:
- **Keyboard journey testing**: full Tab-order walkthroughs of add-transaction,
  reconcile, import, and checkout flows; modal focus trapping and return-focus
  behaviour (the Calendar fix shows this class of issue exists)
- **Screen reader testing**: VoiceOver/NVDA passes over the dashboard, charts
  (recharts SVGs currently have no text alternatives beyond container labels),
  and data tables
- **Modal/overlay states**: axe scanned page loads; open modals, dropdowns,
  and toasts were not in the scanned DOM
- **Reduced-motion and zoom**: 200% zoom reflow (WCAG 1.4.10) and
  prefers-reduced-motion coverage unverified

## Keeping it green

`npm run audit:a11y` (dev server must be running) exits non-zero on any
serious/critical violation — suitable for a CI job with a dev-server step, or
run it before UI-heavy merges. New interactive components should follow the
patterns now in the codebase: real buttons for click targets, `aria-label` +
`aria-pressed` on icon toggles, one-step-darker tailwind shades for white-text
buttons.
