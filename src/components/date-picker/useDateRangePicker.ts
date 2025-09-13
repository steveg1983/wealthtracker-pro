import { useState, useEffect, useRef, useCallback } from 'react';
import type { DateRange } from './dateRangePresets';

export type ViewMode = 'presets' | 'calendar' | 'natural';

export function useDateRangePicker(
  value: DateRange,
  onChange: (range: DateRange) => void
) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('presets');
  const [tempRange, setTempRange] = useState<DateRange>(value);
  const [selecting, setSelecting] = useState<'start' | 'end' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update temp range when value changes
  useEffect(() => {
    setTempRange(value);
  }, [value]);

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

  const selectDate = useCallback((date: Date) => {
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
  }, [selecting, tempRange]);

  const applyRange = useCallback((range: DateRange) => {
    onChange(range);
    setIsOpen(false);
  }, [onChange]);

  const clearRange = useCallback(() => {
    setTempRange({ start: null, end: null });
    setSelecting(null);
  }, []);

  const closeAndReset = useCallback(() => {
    setIsOpen(false);
    setTempRange(value);
    setSelecting(null);
  }, [value]);

  return {
    isOpen,
    setIsOpen,
    viewMode,
    setViewMode,
    tempRange,
    setTempRange,
    selecting,
    containerRef,
    selectDate,
    applyRange,
    clearRange,
    closeAndReset
  };
}