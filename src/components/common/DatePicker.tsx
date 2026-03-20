import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '../icons';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  'aria-label'?: string;
  id?: string;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Monday-start (Mon=0, Sun=6)
  return day === 0 ? 6 : day - 1;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${dd}/${mm}/${year}`;
}

function toYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function DatePicker({ value, onChange, className = '', 'aria-label': ariaLabel, id }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse value into viewMonth/viewYear
  const parsed = value ? value.split('-').map(Number) : null;
  const selectedYear = parsed ? parsed[0] : null;
  const selectedMonth = parsed ? parsed[1] - 1 : null;
  const selectedDay = parsed ? parsed[2] : null;

  const [viewYear, setViewYear] = useState(selectedYear ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedMonth ?? new Date().getMonth());

  // Sync view when value changes externally
  useEffect(() => {
    if (selectedYear != null && selectedMonth != null) {
      setViewYear(selectedYear);
      setViewMonth(selectedMonth);
    }
  }, [selectedYear, selectedMonth]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const prevMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 0) {
        setViewYear(y => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 11) {
        setViewYear(y => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const selectDay = (day: number) => {
    onChange(toYMD(viewYear, viewMonth, day));
    setIsOpen(false);
  };

  const selectToday = () => {
    const now = new Date();
    onChange(toYMD(now.getFullYear(), now.getMonth(), now.getDate()));
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setIsOpen(false);
  };

  const clear = () => {
    onChange('');
    setIsOpen(false);
  };

  // Build calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  // Previous month overflow
  const prevMonthDays = getDaysInMonth(
    viewMonth === 0 ? viewYear - 1 : viewYear,
    viewMonth === 0 ? 11 : viewMonth - 1
  );

  const cells: Array<{ day: number; current: boolean }> = [];
  // Leading days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, current: false });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true });
  }
  // Trailing days
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, current: false });
    }
  }

  const isSelected = (day: number, isCurrent: boolean) =>
    isCurrent &&
    selectedYear === viewYear &&
    selectedMonth === viewMonth &&
    selectedDay === day;

  const isToday = (day: number, isCurrent: boolean) => {
    if (!isCurrent) return false;
    const now = new Date();
    return day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          readOnly
          value={formatDisplayDate(value)}
          onClick={() => setIsOpen(o => !o)}
          placeholder="dd/mm/yyyy"
          aria-label={ariaLabel}
          className={`w-full px-3 py-2 pr-10 cursor-pointer ${className}`}
        />
        <CalendarIcon
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-3 w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeftIcon size={18} />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Next month"
            >
              <ChevronRightIcon size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d, i) => (
              <div key={i} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const selected = isSelected(cell.day, cell.current);
              const today = isToday(cell.day, cell.current);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => cell.current && selectDay(cell.day)}
                  disabled={!cell.current}
                  className={`
                    w-9 h-9 text-sm rounded-lg flex items-center justify-center transition-colors
                    ${!cell.current ? 'text-gray-300 dark:text-gray-600 cursor-default' : 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'}
                    ${selected ? 'bg-primary text-white hover:bg-secondary' : ''}
                    ${today && !selected ? 'border border-primary text-primary font-semibold' : ''}
                    ${cell.current && !selected && !today ? 'text-gray-700 dark:text-gray-200' : ''}
                  `}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={clear}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={selectToday}
              className="text-xs text-primary hover:text-secondary font-medium px-2 py-1"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
