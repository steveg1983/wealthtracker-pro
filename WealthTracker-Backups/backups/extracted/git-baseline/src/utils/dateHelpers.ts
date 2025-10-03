/**
 * Utility functions for handling dates in Redux state
 */

/**
 * Convert a Date object or ISO string to ISO string for Redux storage
 */
export const toISOString = (date: Date | string | undefined | null): string | undefined => {
  if (!date) return undefined;
  
  if (typeof date === 'string') {
    // Already an ISO string or date string
    return date;
  }
  
  if (date instanceof Date) {
    return date.toISOString();
  }
  
  return undefined;
};

/**
 * Convert an ISO string or Date to a Date object
 */
export const toDate = (dateString: string | Date | undefined | null): Date | undefined => {
  if (!dateString) return undefined;
  
  if (dateString instanceof Date) {
    return dateString;
  }
  
  if (typeof dateString === 'string') {
    const date = new Date(dateString);
    // Check for valid date
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  return undefined;
};

/**
 * Get current date as ISO string
 */
export const getCurrentISOString = (): string => {
  return new Date().toISOString();
};