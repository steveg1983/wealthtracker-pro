import { useState, useRef, useEffect, useLayoutEffect, useCallback, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '../icons';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  'aria-label'?: string;
  id?: string;
  /** Mirrors a native date input's `required` for forms that rely on it. */
  required?: boolean;
  /** Runs AFTER the typed draft settles, so a caller's touched/validation
   *  bookkeeping sees the committed value rather than the half-typed one. */
  onBlur?: () => void;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  /**
   * Chrome density. 'sm' matches the compact filter rows (px-2 py-1.5) that
   * native inputs used; padding lives here rather than in className because
   * Tailwind resolves competing padding utilities by stylesheet order, not by
   * the order they appear in the class attribute.
   */
  size?: 'sm' | 'md';
  /**
   * Render the calendar in a fixed-position portal on document.body instead of
   * absolutely inside this field.
   *
   * For a field that sits inside a scroll container which CLIPS its overflow —
   * the register's quick-edit box lives inside the virtualised transaction
   * list, where an in-flow calendar is cut off at the edge of the table. Off by
   * default, so a field only leaves its own DOM when it has that problem.
   *
   * Not needed merely to escape the BOTTOM of the window: an in-flow calendar
   * flips above its field when it has to (see openUp), which is a clipping
   * ancestor's problem only when there is one.
   */
  usePortal?: boolean;
  /**
   * Draw the little calendar glyph inside the field.
   *
   * Off where the field is squeezed into a register COLUMN. The glyph itself is
   * 14px, but the padding reserved so the text never runs under it is 32px —
   * and a dd/mm/yyyy date in Inter at 14px needs 84 of the column's own width
   * before anything else takes a share (see registerDateColumn). Something had
   * to go, and the glyph is the part that tells the user least: the field opens
   * its calendar on focus and on click either way, so it is a hint about a way
   * in that is already open.
   */
  showIcon?: boolean;
  /**
   * A pulse — any change to this number — asking the field for the cursor with
   * the calendar left SHUT, and the current date selected ready to be typed
   * over.
   *
   * For the register's Save & Next run, where the app moves the cursor rather
   * than the user: the same field, row after row, and a calendar unfurling over
   * the next three transactions every time would hide the very list being
   * worked down. Focusing or clicking the field BY HAND still opens it — that
   * is what a click means, and F2 keeps it — so this changes nothing anywhere
   * the prop is left off.
   *
   * Zero (and absent) mean "nothing has been asked for", so a field that
   * merely mounts with the prop wired up never steals the cursor.
   */
  focusWithoutCalendarToken?: number;
}

/** The calendar's own size, needed to decide whether it fits below the field. */
const CALENDAR_WIDTH = 280;
const CALENDAR_HEIGHT = 340;

// `field` reserves room on the right for the glyph; `plain` is the same chrome
// with that room given back to the date, and — at sm — a little of its side
// padding too. Nothing asks for `plain` except a field squeezed into a column
// too narrow for the glyph (see showIcon), and there the six pixels either side
// are the difference between reading "15/01/2026" and reading "15/01/202".
//
// sm/plain's `px-1.5` is a TERM in the register's Date column width — see
// registerDateColumn, and the test that reads this class back off the rendered
// input. Widening it narrows the date it is trying to show.
const SIZES = {
  sm: { field: 'px-2 py-1.5 pr-8', plain: 'px-1.5 py-1.5', icon: 'right-2', iconSize: 14 },
  md: { field: 'px-3 py-2 pr-10', plain: 'px-3 py-2', icon: 'right-3', iconSize: 16 },
} as const;

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTHS_SHORT = MONTHS.map(m => m.slice(0, 3));
// Years shown per page in the year view (a clean 3×4 grid).
const YEAR_PAGE = 12;

type PickerView = 'days' | 'months' | 'years';

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

// A typed date, UK order, one separator kind per date: 14/04/2025, 14/4/2025,
// 14-04-2025, 14.4.2025. The year must be four digits so a half-typed "14/04/20"
// is never mistaken for a finished date and committed under the user.
const TYPED_DATE = /^(\d{1,2})([/\-.])(\d{1,2})\2(\d{4})$/;

function parseTypedDate(input: string): string | null {
  const match = TYPED_DATE.exec(input.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[3]);
  const year = Number(match[4]);
  // Two-digit years land here as 0025 and would sail through Date's 1900 window,
  // so anything below a real four-digit year is a typo, not a date.
  if (year < 1000) return null;
  if (month < 1 || month > 12) return null;
  // Impossible days are rejected rather than rolled over: 31/02 is a slip of the
  // finger, not the 3rd of March.
  if (day < 1 || day > getDaysInMonth(year, month - 1)) return null;
  return toYMD(year, month - 1, day);
}

export default function DatePicker({
  value,
  onChange,
  className = '',
  'aria-label': ariaLabel,
  id,
  required,
  onBlur,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  size = 'md',
  usePortal = false,
  showIcon = true,
  focusWithoutCalendarToken,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Up only for the length of a programmatic focus() (see the effect below):
  // it is what tells the focus handler this one was the app's doing, not the
  // user's, and the calendar should stay shut.
  const suppressOpenRef = useRef(false);
  // The portaled calendar lives outside containerRef, so the outside-click
  // check has to know about it separately — otherwise clicking a day would
  // count as "outside", close the calendar, and the day's own click would
  // never land.
  const menuRef = useRef<HTMLDivElement>(null);
  // What the user is currently typing, or null when the field just mirrors
  // `value`. Holding the raw string means we never reformat under the caret
  // half-way through "14/4/2025".
  const [draft, setDraft] = useState<string | null>(null);

  // Parse value into viewMonth/viewYear
  const parsed = value ? value.split('-').map(Number) : null;
  const selectedYear = parsed ? parsed[0] : null;
  const selectedMonth = parsed ? parsed[1] - 1 : null;
  const selectedDay = parsed ? parsed[2] : null;

  const [viewYear, setViewYear] = useState(selectedYear ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedMonth ?? new Date().getMonth());
  // Drill-up navigation: days → months → years, so jumping far back (e.g. to
  // 2008) is two clicks on the header instead of dozens on the arrow.
  const [view, setView] = useState<PickerView>('days');

  // Sync view when value changes externally
  useEffect(() => {
    if (selectedYear != null && selectedMonth != null) {
      setViewYear(selectedYear);
      setViewMonth(selectedMonth);
    }
  }, [selectedYear, selectedMonth]);

  // A value arriving from outside (Today, Clear, a parent form reset) has to show
  // in the field — but it must never yank the string out from under someone
  // who is mid-type, which is why the focused field keeps its draft.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(null);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inField = containerRef.current?.contains(target) ?? false;
      const inCalendar = menuRef.current?.contains(target) ?? false;
      if (!inField && !inCalendar) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  /**
   * Which way the calendar opens. Below is the ordinary answer; it flips above
   * when the field sits close enough to the bottom of the window that the
   * calendar would run off it.
   *
   * This used to be worked out only for the PORTALED calendar, which left the
   * in-flow one — the great majority of the fields, and the register's Quick Add
   * bar among them — pinned below the field wherever the field happened to be.
   * The Quick Add bar lives at the very bottom of the register page, so its
   * calendar was always the clipped case (owner, 30 August: "when doing a quick
   * add, and I drop down the date, I loose half the calendar, and then have to
   * scroll down"). The decision is one calculation for both renderings now, so
   * an in-flow field gets the same answer a portaled one has always had.
   */
  const [openUp, setOpenUp] = useState(false);
  // Where the portaled calendar sits (fixed coordinates; portal mode only).
  // Recomputed on scroll (capture phase, so a scrolling container counts, not
  // just the window) and on resize, so it tracks the field it belongs to rather
  // than hanging in mid-air — and so does the flip, which a scroll can change.
  const [menuPos, setMenuPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const computeMenuPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom;
    // Above only when above is genuinely the better side: a window too short for
    // the calendar either way would otherwise trade one clipped edge for another.
    const up = spaceBelow < CALENDAR_HEIGHT + gap && rect.top > spaceBelow;
    setOpenUp(up);
    // An in-flow calendar carries the flip in its own classes (bottom-full), so
    // there are no coordinates to hand it.
    if (!usePortal) return;
    setMenuPos({
      // Kept on screen: a field near the right edge would otherwise put the
      // calendar half outside the window.
      left: Math.max(8, Math.min(rect.left, window.innerWidth - CALENDAR_WIDTH - 8)),
      ...(up
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  }, [usePortal]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPos(null);
      setOpenUp(false);
      return;
    }
    computeMenuPosition();
    const onReflow = (): void => computeMenuPosition();
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [isOpen, computeMenuPosition]);

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
    setDraft(null);
    onChange(toYMD(viewYear, viewMonth, day));
    setIsOpen(false);
  };

  // Typing is the fast path: parse every keystroke, and the moment the string is
  // a complete valid date move the calendar to it and commit down the same
  // onChange a day click uses. Anything short of complete just sits in the draft.
  const handleTyping = (text: string) => {
    setDraft(text);
    const ymd = parseTypedDate(text);
    if (!ymd) return;
    const [year, month] = ymd.split('-').map(Number);
    setViewYear(year);
    setViewMonth(month - 1);
    setView('days');
    if (ymd !== value) onChange(ymd);
  };

  // Blur and Enter are the "I'm done" points: a complete date commits, an emptied
  // field clears, and anything else falls back to the last valid value rather
  // than committing garbage.
  const settleDraft = () => {
    if (draft === null) return;
    const text = draft.trim();
    const ymd = parseTypedDate(text);
    if (ymd) {
      if (ymd !== value) onChange(ymd);
    } else if (text === '' && value !== '') {
      onChange('');
    }
    setDraft(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Only swallow Enter while we have something of our own to accept; once the
      // calendar is closed and the draft settled, a second Enter belongs to the
      // form the field sits in.
      if (!isOpen && draft === null) return;
      e.preventDefault();
      settleDraft();
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      if (!isOpen && draft === null) return;
      // Escape dismisses the calendar first; a modal above us gets the next one.
      e.stopPropagation();
      setDraft(null);
      setIsOpen(false);
    }
  };

  // Header drill-down picks a month/year to VIEW (not the value) and steps back
  // down a level: years → months → days.
  const selectMonth = (month: number) => {
    setViewMonth(month);
    setView('days');
  };

  const selectYear = (year: number) => {
    setViewYear(year);
    setView('months');
  };

  const selectToday = () => {
    const now = new Date();
    setDraft(null);
    onChange(toYMD(now.getFullYear(), now.getMonth(), now.getDate()));
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setView('days');
    setIsOpen(false);
  };

  const clear = () => {
    setDraft(null);
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

  // Start of the 12-year block currently in view (e.g. 2004–2015 for 2008).
  const yearPageStart = viewYear - (((viewYear % YEAR_PAGE) + YEAR_PAGE) % YEAR_PAGE);
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth();

  // A caller asking for the cursor with the calendar shut. Focus events are
  // delivered synchronously, so the flag is up for exactly this focus() and
  // nothing else — it can never survive to swallow a click the user makes
  // afterwards.
  useEffect(() => {
    if (!focusWithoutCalendarToken) return;
    const input = inputRef.current;
    if (!input) return;
    suppressOpenRef.current = true;
    input.focus();
    input.select();
    suppressOpenRef.current = false;
  }, [focusWithoutCalendarToken]);

  // Focusing or clicking the field opens the calendar and leaves it open: the
  // field is typeable now, so a second click is someone placing the caret, not
  // asking for the calendar to go away. Escape and outside clicks close it.
  const openPicker = () => {
    if (suppressOpenRef.current) return;
    if (isOpen) return;
    setView('days');
    setIsOpen(true);
  };

  const chrome = SIZES[size];

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={draft ?? formatDisplayDate(value)}
          onChange={(e) => handleTyping(e.target.value)}
          onFocus={openPicker}
          onClick={openPicker}
          onBlur={() => {
            settleDraft();
            onBlur?.();
          }}
          onKeyDown={handleKeyDown}
          placeholder="dd/mm/yyyy"
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          required={required}
          autoComplete="off"
          className={`w-full ${showIcon ? chrome.field : chrome.plain} ${className}`}
        />
        {showIcon && (
          <CalendarIcon
            size={chrome.iconSize}
            className={`absolute ${chrome.icon} top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none`}
          />
        )}
      </div>

      {isOpen && (() => {
        const calendar = (
        <div
          ref={usePortal ? menuRef : undefined}
          // data-datepicker-panel: a portaled calendar is no longer inside the
          // field's DOM, so anything that asks "was that click inside my
          // component?" — the register's click-outside-to-deselect handler —
          // needs a way to recognise it.
          data-datepicker-panel
          style={usePortal && menuPos ? {
            position: 'fixed',
            left: menuPos.left,
            zIndex: 9999,
            ...(menuPos.top !== undefined ? { top: menuPos.top } : { bottom: menuPos.bottom }),
          } : undefined}
          // data-datepicker-placement: which way it opened, readable by a test
          // (and by anything that has to reason about the field's chrome)
          // without measuring styles jsdom does not compute.
          data-datepicker-placement={openUp ? 'above' : 'below'}
          className={`${usePortal ? '' : `absolute z-50 ${openUp ? 'bottom-full mb-1' : 'mt-1'}`} bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-3 w-[280px]`}
        >
          {/* Header — the arrows step within the current view (month / year /
              12-year block) and the label drills UP a level (day→month→year). */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={
                view === 'days'
                  ? prevMonth
                  : view === 'months'
                  ? () => setViewYear(y => y - 1)
                  : () => setViewYear(y => y - YEAR_PAGE)
              }
              /* The arrows set NO colour of their own, so they inherited — and
                 in a dark modal the inherited ink was near-invisible (owner,
                 16 August: "I can hardly read the left and right arrow").
                 Named explicitly, both modes, like the month label between
                 them. */
              className="p-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label={view === 'days' ? 'Previous month' : view === 'months' ? 'Previous year' : 'Previous years'}
            >
              <ChevronLeftIcon size={18} />
            </button>
            {view === 'years' ? (
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {yearPageStart} – {yearPageStart + YEAR_PAGE - 1}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setView(view === 'days' ? 'months' : 'years')}
                className="text-sm font-medium text-gray-700 dark:text-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label={view === 'days' ? 'Select month' : 'Select year'}
              >
                {view === 'days' ? `${MONTHS[viewMonth]} ${viewYear}` : viewYear}
              </button>
            )}
            <button
              type="button"
              onClick={
                view === 'days'
                  ? nextMonth
                  : view === 'months'
                  ? () => setViewYear(y => y + 1)
                  : () => setViewYear(y => y + YEAR_PAGE)
              }
              className="p-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label={view === 'days' ? 'Next month' : view === 'months' ? 'Next year' : 'Next years'}
            >
              <ChevronRightIcon size={18} />
            </button>
          </div>

          {view === 'days' && (
            <>
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
                        ${selected ? 'bg-[#1a2332] text-white hover:bg-secondary' : ''}
                        ${today && !selected ? 'border border-primary text-primary font-semibold' : ''}
                        ${cell.current && !selected && !today ? 'text-gray-700 dark:text-gray-200' : ''}
                      `}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === 'months' && (
            <div className="grid grid-cols-3 gap-1">
              {MONTHS_SHORT.map((label, i) => {
                const selected = selectedYear === viewYear && selectedMonth === i;
                const current = nowYear === viewYear && nowMonth === i;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => selectMonth(i)}
                    className={`
                      h-10 text-sm rounded-lg flex items-center justify-center transition-colors
                      ${selected ? 'bg-[#1a2332] text-white hover:bg-secondary' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}
                      ${current && !selected ? 'border border-primary text-primary font-semibold' : ''}
                    `}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'years' && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: YEAR_PAGE }, (_, i) => yearPageStart + i).map(year => {
                const selected = selectedYear === year;
                const current = nowYear === year;
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => selectYear(year)}
                    className={`
                      h-10 text-sm rounded-lg flex items-center justify-center transition-colors
                      ${selected ? 'bg-[#1a2332] text-white hover:bg-secondary' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}
                      ${current && !selected ? 'border border-primary text-primary font-semibold' : ''}
                    `}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          )}

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
        );
        if (!usePortal) return calendar;
        // Nothing is drawn until the position is known — a calendar painted at
        // 0,0 for one frame and then moved is a visible jump.
        return menuPos ? createPortal(calendar, document.body) : null;
      })()}
    </div>
  );
}
