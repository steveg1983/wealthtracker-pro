import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { parseMoneyInput } from '../../utils/decimal';
import MoneyInput from './MoneyInput';

const field = () => screen.getByLabelText<HTMLInputElement>('Amount');
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });
const blurField = () => fireEvent.blur(field());

/** The component is controlled; consumers feed the emitted raw value back. */
function ControlledString({
  initial = '',
  onEmit,
  allowNegative
}: {
  initial?: string;
  onEmit?: (value: string) => void;
  allowNegative?: boolean;
}): React.JSX.Element {
  const [value, setValue] = useState(initial);
  return (
    <MoneyInput
      aria-label="Amount"
      value={value}
      allowNegative={allowNegative}
      onChange={(raw) => {
        setValue(raw);
        onEmit?.(raw);
      }}
    />
  );
}

/** Callers that keep a number in state parse on the way in, as the app does. */
function ControlledNumber({ initial = 0 }: { initial?: number }): React.JSX.Element {
  const [value, setValue] = useState(initial);
  return (
    <MoneyInput
      aria-label="Amount"
      value={value}
      onChange={(raw) => setValue(parseMoneyInput(raw) ?? 0)}
    />
  );
}

describe('MoneyInput', () => {
  it('shows a seeded value grouped', () => {
    render(<ControlledString initial="1000000" />);
    expect(field().value).toBe('1,000,000.00');
  });

  it('does not regroup under the caret while typing, then groups on blur', () => {
    const onEmit = vi.fn();
    render(<ControlledString onEmit={onEmit} />);

    type('1000000');
    expect(field().value).toBe('1000000');
    expect(onEmit).toHaveBeenLastCalledWith('1000000');

    blurField();
    expect(field().value).toBe('1,000,000.00');
  });

  it('round-trips a grouped value back to the caller ungrouped', () => {
    const onEmit = vi.fn();
    render(<ControlledString onEmit={onEmit} />);

    type('1,234.56');
    expect(onEmit).toHaveBeenLastCalledWith('1234.56');
    expect(field().value).toBe('1,234.56');

    blurField();
    expect(field().value).toBe('1,234.56');
  });

  it('keeps decimals the caller typed', () => {
    render(<ControlledString />);
    type('12.3');
    expect(field().value).toBe('12.3');
    blurField();
    expect(field().value).toBe('12.30');
  });

  it('leaves a cleared field blank rather than showing a zero', () => {
    const onEmit = vi.fn();
    render(<ControlledString initial="500" onEmit={onEmit} />);

    type('');
    expect(onEmit).toHaveBeenLastCalledWith('');
    blurField();
    expect(field().value).toBe('');
  });

  it('refuses invalid characters', () => {
    const onEmit = vi.fn();
    render(<ControlledString onEmit={onEmit} />);

    type('12abc');
    expect(onEmit).toHaveBeenLastCalledWith('12');
    expect(field().value).toBe('12');
  });

  it('rejects a minus by default and accepts one when allowed', () => {
    const { unmount } = render(<ControlledString />);
    type('-25');
    expect(field().value).toBe('25');
    unmount();

    render(<ControlledString allowNegative />);
    type('-25');
    expect(field().value).toBe('-25');
    blurField();
    expect(field().value).toBe('-25.00');
  });

  it('survives a half-typed decimal when the caller stores numbers', () => {
    render(<ControlledNumber />);

    type('12');
    expect(field().value).toBe('12');
    // "12." parses to nothing, so the caller falls back to 0 — the draft must
    // still hold, or the next keystroke would land after a reformatted "0.00".
    type('12.');
    expect(field().value).toBe('12.');
    type('12.5');
    expect(field().value).toBe('12.5');

    blurField();
    expect(field().value).toBe('12.50');
  });

  it('gives way when the caller resets the value mid-edit', () => {
    function ResettableForm(): React.JSX.Element {
      const [value, setValue] = useState('');
      return (
        <>
          <MoneyInput aria-label="Amount" value={value} onChange={setValue} />
          <button type="button" onClick={() => setValue('')}>
            Reset
          </button>
        </>
      );
    }

    render(<ResettableForm />);
    type('4500');
    expect(field().value).toBe('4500');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(field().value).toBe('');
  });

  it('selects the amount on focus so typing replaces it', () => {
    render(<ControlledString initial="250" />);
    const input = field();
    const select = vi.spyOn(input, 'select');

    fireEvent.focus(input);
    expect(select).toHaveBeenCalled();
  });

  it('honours a caller that wants focus left alone', () => {
    render(
      <MoneyInput aria-label="Amount" value="250" onChange={vi.fn()} selectOnFocus={false} />
    );
    const input = field();
    const select = vi.spyOn(input, 'select');

    fireEvent.focus(input);
    expect(select).not.toHaveBeenCalled();
  });

  it('still calls the focus and blur handlers a caller supplies', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(
      <MoneyInput aria-label="Amount" value="250" onChange={vi.fn()} onFocus={onFocus} onBlur={onBlur} />
    );

    fireEvent.focus(field());
    fireEvent.blur(field());
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('passes accessibility and form attributes through', () => {
    render(
      <MoneyInput
        id="opening-balance"
        aria-label="Amount"
        aria-describedby="hint"
        className="w-full"
        required
        value="10"
        onChange={vi.fn()}
      />
    );

    const input = field();
    expect(input).toHaveAttribute('id', 'opening-balance');
    expect(input).toHaveAttribute('aria-describedby', 'hint');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toBeRequired();
    expect(input).toHaveClass('w-full');
  });
});
