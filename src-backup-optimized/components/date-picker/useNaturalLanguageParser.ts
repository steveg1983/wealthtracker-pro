import { useCallback } from 'react';
import type { DateRange } from './dateRangePresets';

export function useNaturalLanguageParser() {
  const parseNaturalLanguage = useCallback((input: string): DateRange | null => {
    const lower = input.toLowerCase().trim();
    const now = new Date();
    
    // Relative dates
    if (lower === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { start: today, end: today, label: 'Today' };
    }
    if (lower === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      return { start: yesterday, end: yesterday, label: 'Yesterday' };
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
  }, []);

  return { parseNaturalLanguage };
}