import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DatePicker from './DatePicker';

const field = () => screen.getByPlaceholderText<HTMLInputElement>('dd/mm/yyyy');
const open = () => fireEvent.click(field());
// Real focus (not fireEvent.focus) so document.activeElement matches what the
// component checks before it decides a draft is safe to discard.
const focusField = () => {
  field().focus();
  fireEvent.click(field());
};
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });
// fireEvent rather than the DOM's blur(), so React flushes the resulting render
// before the assertions read the field back.
const blurField = () => fireEvent.blur(field());
const monthHeader = () => screen.queryByRole('button', { name: 'Select month' });

/** The picker is controlled; consumers feed the committed value straight back. */
function ControlledPicker({ initial, onCommit }: { initial: string; onCommit: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DatePicker
      value={value}
      onChange={(next) => {
        setValue(next);
        onCommit(next);
      }}
    />
  );
}

describe('DatePicker drill-up navigation', () => {
  it('opens in day view showing the selected month and year', () => {
    render(<DatePicker value="2024-02-15" onChange={() => {}} />);
    open();
    expect(screen.getByRole('button', { name: 'Select month' })).toHaveTextContent('February 2024');
  });

  it('drills day → month → year, pages back, and back down to a far-past date', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-07-10" onChange={onChange} />);
    open();

    // days -> months (year 2026 in the header)
    fireEvent.click(screen.getByRole('button', { name: 'Select month' }));
    expect(screen.getByRole('button', { name: 'Select year' })).toHaveTextContent('2026');

    // months -> years (block 2016–2027; 2008 not present yet)
    fireEvent.click(screen.getByRole('button', { name: 'Select year' }));
    expect(screen.getByRole('button', { name: 'Previous years' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2008' })).toBeNull();

    // page back one 12-year block -> 2004–2015, then pick 2008
    fireEvent.click(screen.getByRole('button', { name: 'Previous years' }));
    fireEvent.click(screen.getByRole('button', { name: '2008' }));
    expect(screen.getByRole('button', { name: 'Select year' })).toHaveTextContent('2008');

    // months -> days for Jan 2008, then pick the 15th
    fireEvent.click(screen.getByRole('button', { name: 'Jan' }));
    expect(screen.getByRole('button', { name: 'Select month' })).toHaveTextContent('January 2008');
    fireEvent.click(screen.getByRole('button', { name: '15' }));

    expect(onChange).toHaveBeenCalledWith('2008-01-15');
  });

  it('steps a year at a time in month view', () => {
    render(<DatePicker value="2024-06-01" onChange={() => {}} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Select month' }));

    fireEvent.click(screen.getByRole('button', { name: 'Previous year' }));
    expect(screen.getByRole('button', { name: 'Select year' })).toHaveTextContent('2023');

    fireEvent.click(screen.getByRole('button', { name: 'Next year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next year' }));
    expect(screen.getByRole('button', { name: 'Select year' })).toHaveTextContent('2025');
  });

  it('reopens in day view even after drilling up to the year grid', () => {
    render(<DatePicker value="2024-02-15" onChange={() => {}} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Select month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select year' }));
    // close via outside click, then reopen
    fireEvent.mouseDown(document.body);
    open();
    expect(screen.getByRole('button', { name: 'Select month' })).toHaveTextContent('February 2024');
  });

  it('keeps the calendar open when the field is clicked a second time', () => {
    render(<DatePicker value="2024-02-15" onChange={() => {}} />);
    open();
    open();
    expect(monthHeader()).toBeInTheDocument();
  });
});

describe('DatePicker typed entry', () => {
  it('navigates the calendar, highlights the day and commits a fully typed date', () => {
    const onCommit = vi.fn();
    render(<ControlledPicker initial="2026-07-10" onCommit={onCommit} />);
    focusField();

    type('14/04/2025');

    expect(onCommit).toHaveBeenCalledWith('2025-04-14');
    expect(monthHeader()).toHaveTextContent('April 2025');
    expect(screen.getByRole('button', { name: '14' }).className).toContain('bg-[#1a2332]');
  });

  it('accepts single-digit day and month, and hyphen separators', () => {
    const onCommit = vi.fn();
    render(<ControlledPicker initial="2026-07-10" onCommit={onCommit} />);
    focusField();

    type('4/7/2025');
    expect(onCommit).toHaveBeenCalledWith('2025-07-04');

    type('4-7-2024');
    expect(onCommit).toHaveBeenCalledWith('2024-07-04');
  });

  it('leaves half-typed input alone: no commit, no reformatting under the caret', () => {
    const onCommit = vi.fn();
    render(<ControlledPicker initial="2024-02-15" onCommit={onCommit} />);
    focusField();

    type('14/04');
    expect(onCommit).not.toHaveBeenCalled();
    expect(field().value).toBe('14/04');
    expect(monthHeader()).toHaveTextContent('February 2024');

    // A complete-but-unpadded date commits without being rewritten mid-typing.
    type('14/4/2025');
    expect(onCommit).toHaveBeenCalledWith('2025-04-14');
    expect(field().value).toBe('14/4/2025');

    // Only on blur does the field settle into the display format.
    blurField();
    expect(field().value).toBe('14/04/2025');
  });

  it('reverts to the last valid value when blurred on nonsense', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2024-02-15" onChange={onChange} />);
    focusField();

    type('not a date');
    blurField();

    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe('15/02/2024');
  });

  it('rejects an impossible date rather than rolling it into the next month', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2024-02-15" onChange={onChange} />);
    focusField();

    type('31/02/2025');
    expect(onChange).not.toHaveBeenCalled();
    expect(monthHeader()).toHaveTextContent('February 2024');

    blurField();
    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe('15/02/2024');
  });

  it('commits on Enter and closes the calendar', () => {
    const onCommit = vi.fn();
    render(<ControlledPicker initial="2024-02-15" onCommit={onCommit} />);
    focusField();

    type('1/3/2025');
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith('2025-03-01');
    expect(field().value).toBe('01/03/2025');
    expect(monthHeader()).toBeNull();
  });

  it('reverts and closes on Escape', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2024-02-15" onChange={onChange} />);
    focusField();

    type('31/12');
    fireEvent.keyDown(field(), { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe('15/02/2024');
    expect(monthHeader()).toBeNull();
  });

  it('clears the value when the field is emptied and blurred', () => {
    const onCommit = vi.fn();
    render(<ControlledPicker initial="2024-02-15" onCommit={onCommit} />);
    focusField();

    type('');
    expect(onCommit).not.toHaveBeenCalled();

    blurField();
    expect(onCommit).toHaveBeenCalledWith('');
    expect(field().value).toBe('');
  });
});
