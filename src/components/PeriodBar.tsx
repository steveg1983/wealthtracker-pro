import React from 'react';
import PeriodPicker from './PeriodPicker';
import type { UsePeriodResult } from '../hooks/usePeriod';

/**
 * The page-level period bar: the ONE control that says what window a whole
 * page is being read over.
 *
 * ─ WHY IT IS NOT A CARD ────────────────────────────────────────────────────
 * The Reports hub used to wrap this in a full-width white card — about 90px of
 * chrome around a 36px control, which per P1 is decoration charged against the
 * figures below it. The pills sit directly under the page heading instead: the
 * position is what says "this governs the page", and a box around it adds
 * nothing to that (DESIGN_PASS_2026-08 §3.5).
 *
 * ─ WHY IT IS SHARED ────────────────────────────────────────────────────────
 * The Dashboard used to carry period pickers of its own, in the same style but
 * governing only the section they sat in, so neither declared its scope
 * (§3.4). Both pages now render THIS, in the same place relative to the
 * heading, so the rule the user learns on one page holds on the other.
 *
 * `label` is required, unlike PeriodPicker's own: a control this far from what
 * it governs has to say so out loud for anyone who cannot see the layout.
 */
export default function PeriodBar({ picker, label }: {
  picker: UsePeriodResult;
  label: string;
}): React.JSX.Element {
  return (
    /* No calendar glyph since 15 August. It was `aria-hidden`, so it said
       nothing to a screen reader, and the pills beneath it already read "This
       month / Last month / Tax year" — a picture of a calendar next to the
       word "month" is the definition of decoration charged against the page
       (P1). On a phone it also cost 26px of the row the pills wrap inside. */
    <div data-period-bar className="flex items-center gap-2">
      <PeriodPicker picker={picker} label={label} />
    </div>
  );
}
