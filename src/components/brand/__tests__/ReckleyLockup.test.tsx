/**
 * The lockup component holds the handover's §4 rules at the point of use: one
 * colour (the parent's), two rules, its own aspect, and never under 96px wide.
 * And whatever wraps it is still named "Reckley".
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReckleyLockup } from '../ReckleyLockup';
import { LOCKUP_HORIZONTAL, LOCKUP_STACKED } from '../../../design-system/brandIdentity';

const svgIn = (container: HTMLElement): SVGSVGElement => {
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('no svg rendered');
  return svg;
};

describe('ReckleyLockup', () => {
  it.each([
    ['horizontal', LOCKUP_HORIZONTAL],
    ['stacked', LOCKUP_STACKED]
  ] as const)('draws the %s lockup at the asked width, height following its own aspect', (layout, geometry) => {
    const { container } = render(<ReckleyLockup layout={layout} width={160} />);
    const svg = svgIn(container);
    const { x, y, width, height } = geometry.viewBox;
    expect(svg.getAttribute('viewBox')).toBe(`${x} ${y} ${width} ${height}`);
    expect(Number(svg.getAttribute('width'))).toBe(160);
    expect(Number(svg.getAttribute('height'))).toBeCloseTo((160 * height) / width, 1);
    expect(svg.hasAttribute('preserveAspectRatio')).toBe(false);
  });

  it('will not draw below the 96px minimum — the two rules would merge into one', () => {
    const { container } = render(<ReckleyLockup layout="horizontal" width={40} />);
    expect(Number(svgIn(container).getAttribute('width'))).toBe(96);
  });

  it('paints currentColor only, and both rules', () => {
    const { container } = render(<ReckleyLockup layout="horizontal" width={96} />);
    const svg = svgIn(container);
    expect(svg.getAttribute('fill')).toBe('currentColor');
    expect(svg.querySelectorAll('rect')).toHaveLength(2);
    expect(svg.querySelectorAll('path')).toHaveLength(2);
    expect(container.querySelector('[fill]:not(svg)')).toBeNull();
    expect(container.querySelector('text')).toBeNull();
  });

  it('names whatever wraps it "Reckley", with the drawing itself hidden from assistive tech', () => {
    const { container } = render(
      <h1>
        <ReckleyLockup layout="stacked" width={112} />
      </h1>
    );
    expect(screen.getByRole('heading', { name: 'Reckley' })).toBeInTheDocument();
    expect(svgIn(container).getAttribute('aria-hidden')).toBe('true');
  });

  it('says nothing when the name is already said beside it', () => {
    const { container } = render(<ReckleyLockup layout="horizontal" width={96} label={null} />);
    expect(container.textContent).toBe('');
  });
});
