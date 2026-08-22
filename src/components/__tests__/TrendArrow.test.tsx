import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TrendArrow from '../TrendArrow';
import { toDecimal } from '../../utils/decimal';

/**
 * The one home of "no direction at zero" (Claude Design, 16 Aug; made shared
 * 22 Aug after the fourth hand-rolled copy got it wrong). Every card that
 * wants an arrow beside a figure calls this; these specs are the rule's own
 * words, independent of any page.
 */
describe('TrendArrow — a zero has no direction', () => {
  const svgOf = (ui: React.ReactElement): SVGElement | null =>
    render(ui).container.querySelector('svg');

  it('renders nothing at zero, for numbers and Decimals alike', () => {
    expect(svgOf(<TrendArrow value={0} />)).toBeNull();
    expect(svgOf(<TrendArrow value={toDecimal(0)} />)).toBeNull();
  });

  it('renders nothing when there is nothing to measure', () => {
    expect(svgOf(<TrendArrow value={null} />)).toBeNull();
    expect(svgOf(<TrendArrow value={undefined} />)).toBeNull();
  });

  it('follows the sign of the figure it sits with', () => {
    // A positive figure may never wear a falling arrow — the finding that
    // made this component (Return % at +18.25% with a down glyph).
    expect(svgOf(<TrendArrow value={18.25} />)?.getAttribute('class')).toContain('text-green-500');
    expect(svgOf(<TrendArrow value={toDecimal(-5)} />)?.getAttribute('class')).toContain('text-red-500');
  });

  it('a flow arrow keeps its stated direction but still yields to the zero rule', () => {
    // Expenses point down even though spending is a positive figure…
    expect(svgOf(<TrendArrow value={100} direction="down" />)?.getAttribute('class')).toContain('text-red-500');
    // …and at zero the flow claim disappears with everything else.
    expect(svgOf(<TrendArrow value={0} direction="down" />)).toBeNull();
  });
});
