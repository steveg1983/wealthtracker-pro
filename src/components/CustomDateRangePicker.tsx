import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CheckIcon,
  XIcon,
  SparklesIcon,
  TrendingUpIcon,
  FilterIcon
} from './icons';

interface DateRange {
  start: Date | null;
  end: Date | null;
  label?: string;
}

interface CustomDateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  minDate?: Date;
  maxDate?: Date;
  showPresets?: boolean;
  showNaturalLanguage?: boolean;
  fiscalYearStart?: number; // Month (1-12) when fiscal year starts
  compact?: boolean;
  placeholder?: string;
}

interface PresetRange {
  label: string;
  icon?: React.ReactNode;
  getValue: () => DateRange;
  popular?: boolean;
}

/**
 * Custom Date Range Picker Component
 * Design principles:
 * 1. Better than browser defaults
 * 2. Preset ranges for quick selection
 * 3. Natural language input
 * 4. Fiscal year support
 * 5. Mobile-optimized interface
 */
export function CustomDateRangePicker({
  value,
  onChange,
  minDate,
  maxDate,
  showPresets = true,
  showNaturalLanguage = true,
  fiscalYearStart = 1,
  compact = false,
  placeholder = "Select date range"
}: CustomDateRangePickerProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'presets' | 'calendar' | 'natural'>('presets');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selecting, setSelecting] = useState<'start' | 'end' | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [naturalInput, setNaturalInput] = useState('');
  const [tempRange, setTempRange] = useState<DateRange>(value);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Preset ranges
  const presetRanges: PresetRange[] = useMemo(() => [
    {
      label: 'Today',
      icon: <CalendarIcon size={14} />,
      getValue: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return { start: today, end: today, label: 'Today' };
      },
      popular: true
    },
    {
      label: 'Yesterday',
      getValue: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        return { start: yesterday, end: yesterday, label: 'Yesterday' };
      }
    },
    {
      label: 'Last 7 days',
      icon: <ClockIcon size={14} />,
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: 'Last 7 days' };
      },
      popular: true
    },
    {
      label: 'Last 30 days',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: 'Last 30 days' };
      },
      popular: true
    },
    {
      label: 'This month',
      icon: <CalendarIcon size={14} />,
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: 'This month' };
      },
      popular: true
    },
    {
      label: 'Last month',
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: 'Last month' };
      }
    },
    {
      label: 'This quarter',
      icon: <TrendingUpIcon size={14} />,
      getValue: () => {
        const now = new Date();
        const quarter = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), quarter * 3, 1);
        const end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: 'This quarter' };
      }
    },
    {
      label: 'Last quarter',
      getValue: () => {
        const now = new Date();
        const quarter = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
        const end = new Date(now.getFullYear(), quarter * 3, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: 'Last quarter' };
      }
    },
    {
      label: 'This year',
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: 'This year' };
      }
    },
    {
      label: 'Last year',
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear() - 1, 0, 1);
        const end = new Date(now.getFullYear() - 1, 11, 31);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: 'Last year' };
      }
    },
    {
      label: 'This fiscal year',
      icon: <FilterIcon size={14} />,
      getValue: () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const fiscalYear = currentMonth >= fiscalYearStart 
          ? now.getFullYear() 
          : now.getFullYear() - 1;
        const start = new Date(fiscalYear, fiscalYearStart - 1, 1);
        const end = new Date(fiscalYear + 1, fiscalYearStart - 1, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: 'This fiscal year' };
      }
    },
    {
      label: 'All time',
      getValue: () => {
        return { start: null, end: null, label: 'All time' };
      }
    }
  ], [fiscalYearStart]);

  // Parse natural language input
  const parseNaturalLanguage = useCallback((input: string): DateRange | null => {
    const lower = input.toLowerCase().trim();
    const now = new Date();
    
    // Relative dates
    if (lower === 'today') {
      return presetRanges[0].getValue();
    }
    if (lower === 'yesterday') {
      return presetRanges[1].getValue();
    }
    if (lower === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return { start: tomorrow, end: tomorrow, label: 'Tomorrow' };
    }
    
    // Last X days/weeks/months
    const lastMatch = lower.match(/last (\d+) (day|week|month|year)s?/);
    if (lastMatch) {
      const amount = parseInt(lastMatch[1]);
      const unit = lastMatch[2];
      const end = new Date();
      const start = new Date();
      
      switch (unit) {
        case 'day':
          start.setDate(start.getDate() - amount + 1);
          break;
        case 'week':
          start.setDate(start.getDate() - (amount * 7) + 1);
          break;
        case 'month':
          start.setMonth(start.getMonth() - amount);
          break;
        case 'year':
          start.setFullYear(start.getFullYear() - amount);
          break;
      }
      
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: input };
    }
    
    // Next X days/weeks/months
    const nextMatch = lower.match(/next (\d+) (day|week|month)s?/);
    if (nextMatch) {
      const amount = parseInt(nextMatch[1]);
      const unit = nextMatch[2];
      const start = new Date();
      const end = new Date();
      
      switch (unit) {
        case 'day':
          end.setDate(end.getDate() + amount - 1);
          break;
        case 'week':
          end.setDate(end.getDate() + (amount * 7) - 1);
          break;
        case 'month':
          end.setMonth(end.getMonth() + amount);
          break;
      }
      
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: input };
    }
    
    // Month names
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const monthIndex = months.findIndex(m => lower.includes(m));
    if (monthIndex !== -1) {
      const year = lower.match(/\d{4}/) ? parseInt(lower.match(/\d{4}/)![0]) : now.getFullYear();
      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: input };
    }
    
    // Between dates
    const betweenMatch = lower.match(/between (.+) and (.+)/);
    if (betweenMatch) {
      const start = new Date(betweenMatch[1]);
      const end = new Date(betweenMatch[2]);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: input };
      }
    }
    
    // Single date
    const singleDate = new Date(input);
    if (!isNaN(singleDate.getTime())) {
      singleDate.setHours(0, 0, 0, 0);
      return { start: singleDate, end: singleDate, label: input };
    }
    
    return null;
  }, [presetRanges]);

  // Format date for display
  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Format range for display
  const formatRange = (): string => {
    if (value.label) return value.label;
    if (!value.start && !value.end) return placeholder;
    if (value.start && value.end) {
      if (value.start.toDateString() === value.end.toDateString()) {
        return formatDate(value.start);
      }
      return `${formatDate(value.start)} - ${formatDate(value.end)}`;
    }
    if (value.start) return `From ${formatDate(value.start)}`;
    if (value.end) return `Until ${formatDate(value.end)}`;
    return placeholder;
  };

  // Select date in calendar
  const selectDate = (date: Date) => {
    if (!selecting) {
      setSelecting('end');
      setTempRange({ start: date, end: date });
    } else if (selecting === 'end') {
      if (tempRange.start && date >= tempRange.start) {
        setTempRange({ ...tempRange, end: date });
        setSelecting(null);
      } else {
        setTempRange({ start: date, end: date });
        setSelecting('end');
      }
    }
  };

  // Apply natural language input
  const applyNaturalLanguage = () => {
    const parsed = parseNaturalLanguage(naturalInput);
    if (parsed) {
      onChange(parsed);
      setIsOpen(false);
      setNaturalInput('');
    }
  };

  // Render calendar days
  const renderCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    while (current <= lastDay || current.getDay() !== 0) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days.map((day, idx) => {
      const isCurrentMonth = day.getMonth() === month;
      const isSelected = tempRange.start && tempRange.end &&
        day >= tempRange.start && day <= tempRange.end;
      const isStart = tempRange.start && day.toDateString() === tempRange.start.toDateString();
      const isEnd = tempRange.end && day.toDateString() === tempRange.end.toDateString();
      const isToday = day.toDateString() === new Date().toDateString();
      const isDisabled = (minDate && day < minDate) || (maxDate && day > maxDate);
      const isHovered = hoveredDate && tempRange.start && !tempRange.end &&
        ((day >= tempRange.start && day <= hoveredDate) ||
         (day <= tempRange.start && day >= hoveredDate));
      
      return (
        <button
          key={idx}
          onClick={() => !isDisabled && selectDate(day)}
          onMouseEnter={() => setHoveredDate(day)}
          onMouseLeave={() => setHoveredDate(null)}
          disabled={isDisabled}
          className={`
            p-2 text-sm rounded-lg transition-all relative
            ${!isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white'}
            ${isSelected ? 'bg-primary/20' : ''}
            ${isStart || isEnd ? 'bg-primary text-white' : ''}
            ${isToday && !isSelected ? 'ring-2 ring-primary' : ''}
            ${isHovered ? 'bg-primary/10' : ''}
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
          `}
        >
          {day.getDate()}
        </button>
      );
    });
  };

  if (compact) {
    return (
      <div className="relative" ref={containerRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
        >
          <CalendarIcon size={16} />
          <span className="text-sm">{formatRange()}</span>
        </button>
        
        {isOpen && (
          <div className="absolute z-50 mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="space-y-2">
              {presetRanges.slice(0, 5).map(preset => (
                <button
                  key={preset.label}
                  onClick={() => {
                    onChange(preset.getValue());
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Input Field */}
      <div
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
      >
        <CalendarIcon size={20} className="text-gray-400" />
        <span className="flex-1 text-gray-900 dark:text-white">
          {formatRange()}
        </span>
        {value.start || value.end ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange({ start: null, end: null });
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <XIcon size={16} />
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full min-w-[600px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {showPresets && (
              <button
                onClick={() => setViewMode('presets')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  viewMode === 'presets'
                    ? 'bg-primary/10 text-primary border-b-2 border-primary'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Quick Select
              </button>
            )}
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-primary/10 text-primary border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Calendar
            </button>
            {showNaturalLanguage && (
              <button
                onClick={() => setViewMode('natural')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  viewMode === 'natural'
                    ? 'bg-primary/10 text-primary border-b-2 border-primary'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <SparklesIcon size={14} className="inline mr-1" />
                Natural Language
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Presets View */}
            {viewMode === 'presets' && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Popular</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {presetRanges.filter(p => p.popular).map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        onChange(preset.getValue());
                        setIsOpen(false);
                      }}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                    >
                      {preset.icon}
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">All Presets</p>
                <div className="grid grid-cols-3 gap-2">
                  {presetRanges.filter(p => !p.popular).map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        onChange(preset.getValue());
                        setIsOpen(false);
                      }}
                      className="px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-900/50 rounded-lg transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Calendar View */}
            {viewMode === 'calendar' && (
              <div>
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronLeftIcon size={20} />
                  </button>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronRightIcon size={20} />
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 p-2">
                      {day}
                    </div>
                  ))}
                  {renderCalendarDays()}
                </div>

                {/* Selected Range Display */}
                {(tempRange.start || tempRange.end) && (
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Selected: </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {tempRange.start && formatDate(tempRange.start)}
                        {tempRange.end && tempRange.start?.toDateString() !== tempRange.end?.toDateString() && 
                          ` - ${formatDate(tempRange.end)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setTempRange({ start: null, end: null });
                          setSelecting(null);
                        }}
                        className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => {
                          onChange(tempRange);
                          setIsOpen(false);
                        }}
                        className="px-4 py-1.5 bg-primary text-white rounded-lg hover:bg-secondary transition-colors text-sm"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Natural Language View */}
            {viewMode === 'natural' && (
              <div>
                <div className="mb-4">
                  <input
                    ref={inputRef}
                    type="text"
                    value={naturalInput}
                    onChange={(e) => setNaturalInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyNaturalLanguage()}
                    placeholder="Try: 'last 30 days', 'this month', 'january 2024', 'between jan 1 and jan 31'"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    autoFocus
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Examples:</p>
                  {[
                    'last 30 days',
                    'this month',
                    'last quarter',
                    'january 2024',
                    'between jan 1 and jan 31',
                    'yesterday',
                    'last year'
                  ].map(example => (
                    <button
                      key={example}
                      onClick={() => {
                        setNaturalInput(example);
                        const parsed = parseNaturalLanguage(example);
                        if (parsed) {
                          onChange(parsed);
                          setIsOpen(false);
                        }
                      }}
                      className="block w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
                
                {naturalInput && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button
                      onClick={applyNaturalLanguage}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
                    >
                      <CheckIcon size={16} />
                      Apply
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
