import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConvertedTotalNote from './ConvertedTotalNote';

const at = (iso: string) => new Date(iso);

describe('ConvertedTotalNote', () => {
  describe('the single-currency user sees NOTHING', () => {
    it('renders nothing when no conversion was needed', () => {
      // provenance === null means no rates were used at all. Most people hold
      // one currency and must never read a word about exchange rates.
      const { container } = render(<ConvertedTotalNote provenance={null} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing rather than an empty box or a reassurance', () => {
      const { container } = render(<ConvertedTotalNote provenance={null} unconverted={[]} />);
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByTestId('converted-total-note')).not.toBeInTheDocument();
    });
  });

  describe('the everyday case — converted at a live quote', () => {
    it('states the time the rates were taken', () => {
      render(
        <ConvertedTotalNote
          provenance={{ source: 'api', asOf: at('2026-08-12T14:02:00.000Z') }}
        />
      );

      // The clock time is rendered in the reader's own locale, so the assertion
      // is on the sentence rather than on a hard-coded 14:02, which would fail
      // in any timezone but one.
      expect(screen.getByTestId('converted-total-note')).toHaveTextContent(
        /^Converted at rates as of \d{1,2}:\d{2}/
      );
    });

    it('does not shout — it is quiet text, not a chip', () => {
      render(
        <ConvertedTotalNote provenance={{ source: 'api', asOf: at('2026-08-12T14:02:00.000Z') }} />
      );

      const note = screen.getByTestId('converted-total-note');
      expect(note.className).toContain('text-gray-500');
      expect(note.className).not.toContain('font-medium');
    });
  });

  describe('the fallback case — approximate rates', () => {
    it('says the consequence before the reason', () => {
      render(
        <ConvertedTotalNote
          provenance={{ source: 'fallback', asOf: at('2026-08-12T14:02:00.000Z') }}
        />
      );

      const note = screen.getByTestId('converted-total-note');
      // P6: what is wrong with the NUMBER comes first; the server's problem
      // comes second.
      expect(note).toHaveTextContent(/^Approximate/);
      expect(note).toHaveTextContent(/could not be reached/);
    });

    it('is visibly distinct from the quiet state', () => {
      const { rerender } = render(
        <ConvertedTotalNote provenance={{ source: 'api', asOf: at('2026-08-12T14:02:00.000Z') }} />
      );
      const quiet = screen.getByTestId('converted-total-note').className;

      rerender(
        <ConvertedTotalNote
          provenance={{ source: 'fallback', asOf: at('2026-08-12T14:02:00.000Z') }}
        />
      );
      const loud = screen.getByTestId('converted-total-note').className;

      expect(loud).not.toBe(quiet);
      expect(loud).toContain('font-medium');
      expect(loud).toContain('border');
    });

    it('spends no amber — the yellow thread keeps its exclusivity', () => {
      // DESIGN_PASS_2026-08 P3: one amber in the building, and this is not it.
      render(
        <ConvertedTotalNote
          provenance={{ source: 'fallback', asOf: at('2026-08-12T14:02:00.000Z') }}
        />
      );

      const note = screen.getByTestId('converted-total-note');
      for (const amber of ['amber', 'yellow', 'accent', 'warning']) {
        expect(note.className).not.toContain(amber);
      }
    });
  });

  describe('the serious case — amounts added without conversion', () => {
    it('says the total is WRONG, not merely approximate', () => {
      // These amounts were summed into the figure at face value, so the total
      // is out by however much they were worth. That is a different and worse
      // claim than "converted at stale rates".
      render(
        <ConvertedTotalNote
          provenance={{ source: 'api', asOf: at('2026-08-12T14:02:00.000Z') }}
          unconverted={['ZZZ']}
          displayCurrency="GBP"
        />
      );

      const note = screen.getByTestId('converted-total-note');
      expect(note).toHaveTextContent(/This total is wrong/);
      expect(note).toHaveTextContent(/ZZZ/);
    });

    it('beats the approximate-rates state to the line', () => {
      // Both are true at once here. The one that changes the figure wins.
      render(
        <ConvertedTotalNote
          provenance={{ source: 'fallback', asOf: at('2026-08-12T14:02:00.000Z') }}
          unconverted={['ZZZ']}
        />
      );

      const note = screen.getByTestId('converted-total-note');
      expect(note).toHaveTextContent(/This total is wrong/);
      expect(note).not.toHaveTextContent(/^Approximate/);
    });

    it('reports even when there is no provenance at all', () => {
      render(<ConvertedTotalNote provenance={null} unconverted={['ZZZ']} />);
      expect(screen.getByTestId('converted-total-note')).toHaveTextContent(/This total is wrong/);
    });
  });

  describe('the ECB reference rate — the preferred provider (24 Aug §1)', () => {
    it('names the day\'s reference rate, not a wall-clock time', () => {
      // The reference rate is a DAILY figure; a clock time would overstate
      // its freshness.
      render(<ConvertedTotalNote provenance={{ source: 'ecb', asOf: new Date(2026, 7, 24, 9, 30) }} />);
      const note = screen.getByTestId('converted-total-note');
      expect(note).toHaveTextContent('Converted at today’s ECB reference rate');
      expect(note.textContent).not.toMatch(/09|9:30/);
    });
  });
});
