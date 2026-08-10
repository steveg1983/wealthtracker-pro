import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PayeeAutoCompleteInput from './PayeeAutoCompleteInput';
import { buildPayeeCompletionIndex } from '../utils/payeeAutocomplete';
import type { Transaction } from '../types';

/**
 * The payee box on its own: what is in the VALUE, what is only painted over
 * it, and what a screen reader is told about the difference.
 *
 * The register's own suite proves the keystrokes end-to-end; this one pins the
 * contract that makes the never-committed rule structural rather than
 * remembered — and the a11y plumbing, which no end-to-end assertion reads.
 *
 * Every payee below is invented: this repo is public.
 */

const HISTORY: Pick<Transaction, 'description' | 'date'>[] = [
  { description: 'Marrow & Vine', date: new Date('2026-01-04') },
  { description: 'Marrow & Vine', date: new Date('2026-01-09') },
  { description: 'Marchbank Cycles', date: new Date('2026-02-02') },
];

const PAYEES = buildPayeeCompletionIndex(HISTORY);

afterEach(cleanup);

/** A controlled host, because the value is the caller's — as it is in the register. */
function Host({ onAccept }: { onAccept?: (payee: string) => void }): React.JSX.Element {
  const [value, setValue] = useState('');
  return (
    <PayeeAutoCompleteInput
      id="payee"
      value={value}
      onChange={setValue}
      payees={PAYEES}
      onAccept={onAccept}
      aria-label="Description"
    />
  );
}

const box = (): HTMLInputElement => {
  const el = screen.getByLabelText('Description');
  if (!(el instanceof HTMLInputElement)) throw new Error('not an input');
  return el;
};

const ghost = (): string => document.querySelector('[data-payee-ghost]')?.textContent ?? '';

const type = (text: string): void => {
  for (const char of text) {
    fireEvent.keyDown(box(), { key: char });
    fireEvent.change(box(), { target: { value: box().value + char } });
  }
};

describe('PayeeAutoCompleteInput — the value holds only what was typed', () => {
  it('paints the suggestion without putting it in the value', () => {
    render(<Host />);

    type('Mar');

    expect(box()).toHaveValue('Mar');
    expect(ghost()).toBe('row & Vine');
  });

  it('completes a payee whose stored spelling is a different case', () => {
    render(<Host />);

    type('mar');

    // The typed characters keep the user's own case — they are the input's own
    // text — and only the remainder is drawn.
    expect(box()).toHaveValue('mar');
    expect(ghost()).toBe('row & Vine');
  });

  it('adopts the payee’s own spelling in full on acceptance', () => {
    render(<Host />);

    type('mar');
    box().setSelectionRange(3, 3);
    fireEvent.keyDown(box(), { key: 'ArrowRight' });

    expect(box()).toHaveValue('Marrow & Vine');
    expect(ghost()).toBe('');
  });

  it('reports the accepted payee to the caller, once', () => {
    const onAccept = vi.fn();
    render(<Host onAccept={onAccept} />);

    type('Marr');
    box().setSelectionRange(4, 4);
    fireEvent.keyDown(box(), { key: 'ArrowRight' });

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledWith('Marrow & Vine');
  });

  it('reports nothing when Right Arrow is only moving the caret', () => {
    const onAccept = vi.fn();
    render(<Host onAccept={onAccept} />);

    type('Marr');
    box().setSelectionRange(1, 1);
    fireEvent.keyDown(box(), { key: 'ArrowRight' });

    expect(onAccept).not.toHaveBeenCalled();
    expect(box()).toHaveValue('Marr');
  });

  it('drops the ghost when the box loses the cursor', () => {
    render(<Host />);

    type('Marr');
    expect(ghost()).not.toBe('');

    fireEvent.blur(box());

    expect(ghost()).toBe('');
    expect(box()).toHaveValue('Marr');
  });
});

describe('PayeeAutoCompleteInput — what a screen reader is told', () => {
  it('says a completion is offered after the caret', () => {
    render(<Host />);
    expect(box()).toHaveAttribute('aria-autocomplete', 'inline');
  });

  it('hides the painted ghost from the accessibility tree', () => {
    render(<Host />);
    type('Mar');

    const painted = document.querySelector('[data-payee-ghost]');
    expect(painted?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('offers the suggestion politely, and says how to take it', () => {
    render(<Host />);
    type('Mar');

    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('Marrow & Vine. Press right arrow to accept.');
  });

  it('says nothing when there is no suggestion', () => {
    render(<Host />);
    type('Marz');

    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('keeps the browser’s own saved-form list out of the way', () => {
    render(<Host />);
    expect(box()).toHaveAttribute('autocomplete', 'off');
  });
});
