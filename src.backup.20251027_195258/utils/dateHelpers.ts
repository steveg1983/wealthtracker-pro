/**
 * Utility functions for handling dates in Redux state
 */

export type DateInput = Date | string | number | null | undefined;

/**
 * Type guard to check if a value can be treated as a date input
 */
export const isDateInput = (value: unknown): value is DateInput => {
  return (
    value === null ||
    value === undefined ||
    value instanceof Date ||
    typeof value === 'string' ||
    typeof value === 'number'
  );
};

/**
 * Convert a Date object or ISO-like input to ISO string for Redux storage
 */
export const toISOString = (date: DateInput): string | undefined => {
  if (!date) return undefined;
  
  if (typeof date === 'string') {
    // Already an ISO string or date string
    return date;
  }
  
  if (typeof date === 'number') {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  
  if (date instanceof Date) {
    return date.toISOString();
  }
  
  return undefined;
};

/**
 * Convert a date-like input to a Date object
 */
export const toDate = (dateInput: DateInput): Date | undefined => {
  if (dateInput === null || dateInput === undefined) return undefined;
  
  if (dateInput instanceof Date) {
    return dateInput;
  }
  
  if (typeof dateInput === 'string' || typeof dateInput === 'number') {
    const date = new Date(dateInput);
    // Check for valid date
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return undefined;
};

/**
 * Convert input to a Date, returning a fallback when conversion fails
 */
export const ensureDate = (dateInput: DateInput, fallback: Date = new Date()): Date => {
  const parsed = toDate(dateInput);
  return parsed ?? fallback;
};

/**
 * Get current date as ISO string
 */
export const getCurrentISOString = (): string => {
  return new Date().toISOString();
};
