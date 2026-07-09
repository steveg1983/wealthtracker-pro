import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DatePicker from './DatePicker';

const open = () => fireEvent.click(screen.getByPlaceholderText('dd/mm/yyyy'));

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
});
