import { describe, it, expect, vi, afterEach } from 'vitest';
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

/**
 * WHICH WAY THE CALENDAR OPENS.
 *
 * The owner, 30 August, on the register's Quick Add bar — which sits at the
 * FOOT of the page: "when doing a quick add, and I drop down the date, I loose
 * half the calendar, and then have to scroll down. I should not need to do
 * that." A field near the bottom of the window has to open upward.
 *
 * jsdom lays nothing out — every rect is an empty one at the origin, which is
 * the roomiest possible position and therefore the one case this could never
 * catch by accident. So the two numbers the decision is a function of (where
 * the field is, how tall the window is) are STATED here, and what the component
 * concludes from them is what these pin. That the calendar is 340px tall in a
 * real browser is a browser fact and is not pretended at.
 */
describe('DatePicker placement', () => {
  const geometry: Array<[object, string, PropertyDescriptor | undefined]> = [];

  /** Put the field `top` pixels down a window `viewport` pixels tall. */
  const pinField = (top: number, viewport: number): void => {
    geometry.push([window, 'innerHeight', Object.getOwnPropertyDescriptor(window, 'innerHeight')]);
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => viewport });
    // The picker measures exactly one element — its own container — so a single
    // answer for every element is answer enough.
    geometry.push([
      HTMLElement.prototype,
      'getBoundingClientRect',
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect'),
    ]);
    const height = 32;
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: (): DOMRect => ({
        x: 20, y: top, top, bottom: top + height, left: 20, right: 170,
        width: 150, height, toJSON: () => ({}),
      }),
    });
  };

  afterEach(() => {
    while (geometry.length > 0) {
      const entry = geometry.pop();
      if (!entry) break;
      const [target, property, descriptor] = entry;
      if (descriptor) Object.defineProperty(target, property, descriptor);
      else Reflect.deleteProperty(target, property);
    }
  });

  const panel = (): HTMLElement => {
    const el = document.querySelector('[data-datepicker-panel]');
    if (!(el instanceof HTMLElement)) throw new Error('the calendar is not open');
    return el;
  };

  it('opens above the field when the window ends just under it', () => {
    // 28px of window left below a 340px calendar: the Quick Add bar's case.
    pinField(740, 800);
    render(<DatePicker value="2024-02-15" onChange={() => {}} />);
    open();

    expect(panel()).toHaveAttribute('data-datepicker-placement', 'above');
    // bottom-full is what puts it there; mt-1 would push it back down.
    expect(panel().className).toContain('bottom-full');
    expect(panel().className).not.toContain('mt-1');
  });

  it('opens below the field when there is room below', () => {
    pinField(100, 800);
    render(<DatePicker value="2024-02-15" onChange={() => {}} />);
    open();

    expect(panel()).toHaveAttribute('data-datepicker-placement', 'below');
    expect(panel().className).toContain('mt-1');
    expect(panel().className).not.toContain('bottom-full');
  });

  it('stays below when neither side has room, rather than trading one clipped edge for another', () => {
    // A 320px window: 188px below the field, 100px above it. Neither fits the
    // calendar, and below is the larger of the two.
    pinField(100, 320);
    render(<DatePicker value="2024-02-15" onChange={() => {}} />);
    open();

    expect(panel()).toHaveAttribute('data-datepicker-placement', 'below');
  });

  it('anchors a portaled calendar by its bottom edge when it opens upward', () => {
    pinField(740, 800);
    render(<DatePicker value="2024-02-15" onChange={() => {}} usePortal />);
    open();

    // Portaled: fixed coordinates rather than classes, and it is the BOTTOM
    // that is pinned — to the field's top edge, less the 4px gap.
    expect(panel()).toHaveAttribute('data-datepicker-placement', 'above');
    expect(panel().style.position).toBe('fixed');
    expect(panel().style.bottom).toBe('64px');
    expect(panel().style.top).toBe('');
  });
});
