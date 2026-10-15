/**
 * THE RECKLEY LOCKUP — the mark and the name, drawn from outlined geometry.
 *
 * Identity handover (Claude Design, 16 Sep 2026): mark 2a, a capital R in IBM
 * Plex Sans 600 ruled off with a double underline, and the name in the same
 * face. Every shape here comes from `design-system/brandIdentity.ts`, which
 * `scripts/brand/build-identity.mjs` outlines straight out of the font, so
 * nothing on screen depends on Plex being installed or fetched. The app's own
 * text is Inter; the logo never asks for Plex at all.
 *
 * ── WHAT THIS COMPONENT REFUSES TO DO ────────────────────────────────────────
 *
 *  - A colour. It paints `currentColor` and nothing else, so a lockup is navy
 *    because its parent says navy, white on the navy bar because the bar says
 *    white. There is no prop for a second hue, a gradient, a shadow — and the
 *    amber, income green and expense red are not the parent's to give it
 *    either (handover §4: the amber means one thing, once per screen).
 *  - One rule. The two rects come from one constant and render together; there
 *    is no variant without the second. A single rule means a subtotal.
 *  - Squash. Width is the only size input and height follows from the
 *    geometry's own aspect, with preserveAspectRatio left at its default.
 *  - Shrink below 96px wide (§4's minimum for a lockup). Asked for less, it
 *    draws 96 — below that the two rules merge into one line and the mark's
 *    meaning inverts.
 *
 * ── ITS NAME ──────────────────────────────────────────────────────────────────
 *
 * The SVG is hidden from assistive technology and the name travels as visually
 * hidden TEXT beside it. That way a heading or a link wrapping the lockup is
 * named "Reckley" by the ordinary text rules — the same name a test, a screen
 * reader and a find-in-page all see. `label={null}` is for a place where the
 * name is already said in text right beside the lockup, so it is not read twice.
 * (The page shell's boot splash is the same idea in static HTML: its inline SVG
 * is aria-hidden because its caption already names the app.)
 */

import type { ReactElement } from 'react';
import {
  LOCKUP_HORIZONTAL,
  LOCKUP_STACKED,
  MARK_R_PATH,
  MARK_RULES,
  MIN_LOCKUP_WIDTH_PX,
  type LockupGeometry
} from '../../design-system/brandIdentity';

const LOCKUPS: Readonly<Record<'horizontal' | 'stacked', LockupGeometry>> = {
  horizontal: LOCKUP_HORIZONTAL,
  stacked: LOCKUP_STACKED
};

export interface ReckleyLockupProps {
  /**
   * horizontal — app header, landing header, PDF footers.
   * stacked — sign-in and splash.
   */
  layout: 'horizontal' | 'stacked';
  /** CSS pixels. Never less than 96: anything smaller is drawn at 96. */
  width: number;
  className?: string;
  /** The accessible name. `null` only where the name is already said beside it. */
  label?: string | null;
}

export function ReckleyLockup({
  layout,
  width,
  className,
  label = 'Reckley'
}: ReckleyLockupProps): ReactElement {
  const { viewBox, wordPath } = LOCKUPS[layout];
  const w = Math.max(width, MIN_LOCKUP_WIDTH_PX);
  const h = Math.round(((w * viewBox.height) / viewBox.width) * 100) / 100;
  return (
    <span className={`inline-flex ${className ?? ''}`.trim()} data-brand-lockup={layout}>
      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        width={w}
        height={h}
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
        className="block"
      >
        <path d={MARK_R_PATH} />
        {MARK_RULES.map((rule) => (
          <rect key={rule.y} x={rule.x} y={rule.y} width={rule.width} height={rule.height} />
        ))}
        <path d={wordPath} />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
