/**
 * A one-point line series has to draw something a reader can see.
 *
 * These pin the MEASURED behaviour of the real recharts, not an expectation
 * about it — the difference decided the fix. The reported symptom was a
 * period-filtered chart on a one-month window showing axes around an empty
 * plot, diagnosed as "a Line draws segments between points, so one point
 * draws nothing". Rendering it says otherwise: recharts special-cases the
 * lone point and DOES draw it — as a 3px circle filled `#fff` with a 2px
 * ring, which on a white card is a speck, and `dot={false}` / `dot={true}`
 * produce that same element either way.
 *
 * So the tempting one-liner `dot={data.length === 1}` changes nothing at all.
 * The second test below is that fact, kept as a specimen: if a future recharts
 * makes the boolean meaningful again, it fails and this module can be
 * reconsidered.
 *
 * No ResponsiveContainer: it measures the DOM and jsdom lays nothing out, so
 * the charts get explicit dimensions. Every figure is invented — this repo is
 * public.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LineChart, Line, XAxis } from 'recharts';
import { singlePointDot } from '../singlePointDots';

const SERIES_COLOUR = '#0d9f6f';
const ONE_MONTH = [{ month: 'Aug 2026', income: 4200 }];
const THREE_MONTHS = [
  { month: 'Jun 2026', income: 3100 },
  { month: 'Jul 2026', income: 3800 },
  { month: 'Aug 2026', income: 4200 },
];

/** Renders the series and reports what recharts actually put in the DOM. */
function draw(data: typeof THREE_MONTHS, dot: ReturnType<typeof singlePointDot> | boolean) {
  const { container } = render(
    <LineChart width={600} height={300} data={data}>
      <XAxis dataKey="month" />
      <Line type="monotone" dataKey="income" stroke={SERIES_COLOUR} strokeWidth={2} dot={dot} isAnimationActive={false} />
    </LineChart>
  );
  const dot0 = container.querySelector('.recharts-line-dot');
  return {
    curves: container.querySelectorAll('.recharts-line-curve').length,
    dots: container.querySelectorAll('.recharts-line-dot').length,
    fill: dot0?.getAttribute('fill') ?? null,
    r: dot0?.getAttribute('r') ?? null,
    strokeWidth: dot0?.getAttribute('stroke-width') ?? null,
  };
}

describe('singlePointDot', () => {
  it('asks for a solid mark for one point, and no dots either side of it', () => {
    expect(singlePointDot([], SERIES_COLOUR)).toBe(false);
    expect(singlePointDot(['a', 'b'], SERIES_COLOUR)).toBe(false);
    expect(singlePointDot(['a'], SERIES_COLOUR)).toEqual({ r: 4, fill: SERIES_COLOUR, strokeWidth: 0 });
  });
});

describe('what recharts actually renders', () => {
  it('THE CAUSE: one point draws no line, only a white-filled speck', () => {
    const one = draw(ONE_MONTH, false);
    expect(one.curves).toBe(0);   // no segment: the "empty plot"
    expect(one.dots).toBe(1);     // but the point IS there…
    expect(one.fill).toBe('#fff'); // …filled white, so it reads as absent
    expect(one.r).toBe('3');
  });

  it('THE TRAP: the boolean is inert, so `dot={data.length === 1}` fixes nothing', () => {
    const asFalse = draw(ONE_MONTH, false);
    const asTrue = draw(ONE_MONTH, true);
    expect(asTrue).toEqual(asFalse);
  });

  it('THE FIX: the config gives the lone point solid ink in the series colour', () => {
    const fixed = draw(ONE_MONTH, singlePointDot(ONE_MONTH, SERIES_COLOUR));
    expect(fixed.dots).toBe(1);
    expect(fixed.fill).toBe(SERIES_COLOUR);
    expect(fixed.strokeWidth).toBe('0');
    expect(fixed.r).toBe('4');
  });

  it('leaves the common case alone: many points stay dotless with a line', () => {
    const many = draw(THREE_MONTHS, singlePointDot(THREE_MONTHS, SERIES_COLOUR));
    expect(many.dots).toBe(0);
    expect(many.curves).toBe(1);
  });
});
