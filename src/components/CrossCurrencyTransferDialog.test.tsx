import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CrossCurrencyTransferDialog from './CrossCurrencyTransferDialog';
import type { ConfirmedConversion } from '../utils/crossCurrencyTransfer';

/**
 * The dialog, driven the way a person drives it.
 *
 * `fetch` is the ONLY thing stubbed here, and it is stubbed rather than mocked
 * out: it is a browser API and the boundary the rates provider sits behind (the
 * repo's testing rule mocks browser APIs and nothing else). Everything below it
 * — the cache, the provenance, `fx.ts`'s arithmetic, the two-way recalculation
 * — is the real code, because the arithmetic is the thing worth testing.
 */

const RATES_URL = 'https://api.exchangerate-api.com/v4/latest/GBP';

/** The provider's shape: units of each currency per one GBP. */
const quoteResponds = (rates: Record<string, number>): void => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url) !== RATES_URL) throw new Error(`unexpected fetch: ${url}`);
    return { ok: true, json: async () => ({ rates }) } as unknown as Response;
  }));
};

const quoteFails = (): void => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
};

const props = {
  isOpen: true as const,
  sourceAmount: -100,
  sourceCurrency: 'GBP',
  sourceAccountName: 'Everyday',
  destinationCurrency: 'USD',
  destinationAccountName: 'Dollars',
  busy: false,
};

// Found by their accessible names, which is also the assertion that they HAVE
// accessible names: two unlabelled boxes that recalculate each other would be
// unusable with a screen reader.
const rateBox = (to = 'USD'): HTMLInputElement =>
  screen.getByLabelText(new RegExp(`^Rate, ${to} per 1 GBP$`)) as HTMLInputElement;
const arrivesBox = (to = 'USD'): HTMLInputElement =>
  screen.getByLabelText(new RegExp(`^Amount arriving in Dollars, in ${to}$`)) as HTMLInputElement;

beforeEach(() => {
  // The rates cache is module-level and would otherwise carry one test's quote
  // into the next.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('CrossCurrencyTransferDialog', () => {
  it('prefills both boxes from a live quote and says who quoted it', async () => {
    quoteResponds({ GBP: 1, USD: 1.25 });
    render(<CrossCurrencyTransferDialog {...props} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    await waitFor(() => expect(rateBox().value).toBe('1.25'));
    // 100 × 1.25, to the penny.
    expect(arrivesBox().value).toBe('125.00');
    expect(screen.getByText(/exchangerate-api\.com/)).toBeInTheDocument();
  });

  it('recalculates the amount when the rate is edited', async () => {
    quoteResponds({ GBP: 1, USD: 1.25 });
    render(<CrossCurrencyTransferDialog {...props} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(rateBox().value).toBe('1.25'));

    fireEvent.change(rateBox(), { target: { value: '1.3' } });

    expect(arrivesBox().value).toBe('130.00');
    // The box being typed in is never rewritten under the cursor.
    expect(rateBox().value).toBe('1.3');
  });

  it('recalculates the rate when the amount is edited', async () => {
    quoteResponds({ GBP: 1, USD: 1.25 });
    render(<CrossCurrencyTransferDialog {...props} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(rateBox().value).toBe('1.25'));

    // What a statement says actually arrived, spread and fee included.
    fireEvent.change(arrivesBox(), { target: { value: '123.47' } });

    expect(rateBox().value).toBe('1.2347');
    expect(arrivesBox().value).toBe('123.47');
  });

  it('confirms an untouched live quote as api, carrying the quote’s own timestamp', async () => {
    quoteResponds({ GBP: 1, USD: 1.25 });
    const onConfirm = vi.fn();
    render(<CrossCurrencyTransferDialog {...props} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await waitFor(() => expect(rateBox().value).toBe('1.25'));

    fireEvent.click(screen.getByRole('button', { name: /Record both sides/ }));

    const conversion = onConfirm.mock.calls[0][0] as ConfirmedConversion;
    expect(conversion.source).toBe('api');
    expect(conversion.rate.toString()).toBe('1.25');
    expect(conversion.destinationAmount.toString()).toBe('125');
  });

  it('confirms an EDITED rate as manual', async () => {
    quoteResponds({ GBP: 1, USD: 1.25 });
    const onConfirm = vi.fn();
    render(<CrossCurrencyTransferDialog {...props} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await waitFor(() => expect(rateBox().value).toBe('1.25'));

    fireEvent.change(arrivesBox(), { target: { value: '123.47' } });
    fireEvent.click(screen.getByRole('button', { name: /Record both sides/ }));

    const conversion = onConfirm.mock.calls[0][0] as ConfirmedConversion;
    // One keystroke makes the figure theirs, and the record says so.
    expect(conversion.source).toBe('manual');
    expect(conversion.destinationAmount.toString()).toBe('123.47');
  });

  it('degrades to the manual box when no rate can be had, and never blocks', async () => {
    // The desktop edition opens a ledger file with no network behind it. A
    // transfer between two of the owner's own accounts must not wait on a
    // provider in another country.
    quoteFails();
    const onConfirm = vi.fn();
    render(
      <CrossCurrencyTransferDialog
        {...props}
        destinationCurrency="XYZ"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText(/No rate available offline/)).toBeInTheDocument());
    // Consequence, then remedy (P6): what is missing, then the way through.
    expect(screen.getByText(/Enter the rate or the amount that arrived/)).toBeInTheDocument();

    // Nothing to confirm yet — but the controls work.
    expect(screen.getByRole('button', { name: /Record both sides/ })).toBeDisabled();

    fireEvent.change(rateBox('XYZ'), { target: { value: '1.1' } });
    expect(arrivesBox('XYZ').value).toBe('110.00');

    fireEvent.click(screen.getByRole('button', { name: /Record both sides/ }));
    const conversion = onConfirm.mock.calls[0][0] as ConfirmedConversion;
    expect(conversion.source).toBe('manual');
    expect(conversion.rate.toString()).toBe('1.1');
  });

  it('cannot be confirmed on a half-typed box', async () => {
    quoteResponds({ GBP: 1, USD: 1.25 });
    render(<CrossCurrencyTransferDialog {...props} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(rateBox().value).toBe('1.25'));

    fireEvent.change(rateBox(), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /Record both sides/ })).toBeDisabled();

    // A zero rate is not a value to be corrected — it is an entry that is not
    // finished, and the local schema's `fx_rate_e10 > 0` would refuse it.
    fireEvent.change(rateBox(), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: /Record both sides/ })).toBeDisabled();
  });

  it('spends no amber — the yellow thread is the only one in the building', async () => {
    quoteResponds({ GBP: 1, USD: 1.25 });
    const { container } = render(
      <CrossCurrencyTransferDialog {...props} onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    await waitFor(() => expect(rateBox().value).toBe('1.25'));

    // DESIGN_PASS_2026-08 P3. A dialog that borrowed the thread's colour would
    // read as the next action on a page where something else is.
    const classes = Array.from(container.querySelectorAll('*'))
      .map(node => node.className)
      .filter((name): name is string => typeof name === 'string')
      .join(' ');
    expect(classes).not.toMatch(/amber|yellow/);
  });
});
