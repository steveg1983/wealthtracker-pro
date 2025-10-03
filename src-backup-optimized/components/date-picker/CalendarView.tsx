import React, { useEffect, memo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import type { DateRange } from './dateRangePresets';
import { formatDate } from './dateUtils';
import { useLogger } from '../services/ServiceProvider';

interface CalendarViewProps {
  tempRange: DateRange;
  onSelectDate: (date: Date) => void;
  onApply: (range: DateRange) => void;
  onClear: () => void;
  minDate?: Date;
  maxDate?: Date;
}

export const CalendarView = memo(function CalendarView({ tempRange,
  onSelectDate,
  onApply,
  onClear,
  minDate,
  maxDate
 }: CalendarViewProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('CalendarView component initialized', {
      componentName: 'CalendarView'
    });
  }, []);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

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
          onClick={() => !isDisabled && onSelectDate(day)}
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

  return (
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
              onClick={onClear}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => onApply(tempRange)}
              className="px-4 py-1.5 bg-primary text-white rounded-lg hover:bg-secondary transition-colors text-sm"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
});