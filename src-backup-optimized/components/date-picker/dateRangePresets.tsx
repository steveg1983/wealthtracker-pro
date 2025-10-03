// Converted to .tsx to allow inline icons
import React from 'react';
import { CalendarIcon, ClockIcon, TrendingUpIcon, FilterIcon } from '../icons';

export interface DateRange {
  start: Date | null;
  end: Date | null;
  label?: string;
}

export interface PresetRange {
  label: string;
  icon?: React.ReactNode;
  getValue: () => DateRange;
  popular?: boolean;
}

export function getPresetRanges(fiscalYearStart: number = 1): PresetRange[] {
  return [
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
  ];
}
