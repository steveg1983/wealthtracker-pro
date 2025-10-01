/**
 * Date formatting utilities with locale detection
 * Automatically detects user's locale and formats dates accordingly
 */

// Detect user's locale from browser settings
export function getUserLocale(): string {
  // Check navigator.language first, then fall back to navigator.languages
  const browserLocale = navigator.language || 
    (navigator.languages && navigator.languages[0]) || 
    'en-US';
  
  // Store the preference in localStorage for consistency
  const storedLocale = localStorage.getItem('preferredLocale');
  if (storedLocale) {
    return storedLocale;
  }
  
  localStorage.setItem('preferredLocale', browserLocale);
  return browserLocale;
}

// Set user's preferred locale
export function setUserLocale(locale: string): void {
  localStorage.setItem('preferredLocale', locale);
}

// Determine if the user prefers UK date format (dd/mm/yyyy)
// For consistency with UK market positioning, always use UK format
export function isUKDateFormat(): boolean {
  // Always return true to ensure UK date format (dd/mm/yyyy) is used throughout
  // This ensures consistency as requested in the UI/UX review
  return true;
}

// Format date according to user's locale (always UK format for consistency)
export function formatDate(date: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  // Always use en-GB locale for UK date format consistency
  const locale = 'en-GB';
  
  // Default options if none provided
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  
  return dateObj.toLocaleDateString(locale, options || defaultOptions);
}

// Format date for display in short format (always dd/mm/yyyy for UK market)
export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();
  
  // Always use UK format (dd/mm/yyyy) for consistency
  return `${day}/${month}/${year}`;
}

// Format date for input fields (always yyyy-mm-dd for HTML date inputs)
export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Parse date from various formats
export function parseDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  // Handle ISO format (yyyy-mm-dd)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Handle UK format (dd/mm/yyyy) - always parse as UK format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    const parts = dateString.split('/');
    const [dayPart, monthPart, yearPart] = parts;
    if (dayPart && monthPart && yearPart) {
      const date = new Date(parseInt(yearPart, 10), parseInt(monthPart, 10) - 1, parseInt(dayPart, 10));
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // Try native Date parsing as fallback
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

// Format date with time
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  // Always use en-GB locale for UK format consistency
  const locale = 'en-GB';
  
  return dateObj.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Format relative date (e.g., "2 days ago", "in 3 weeks")
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  const now = new Date();
  const diffInMs = now.getTime() - dateObj.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) {
    return 'Today';
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays === -1) {
    return 'Tomorrow';
  } else if (diffInDays > 0 && diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else if (diffInDays < 0 && diffInDays > -7) {
    return `in ${Math.abs(diffInDays)} days`;
  } else if (diffInDays >= 7 && diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else if (diffInDays <= -7 && diffInDays > -30) {
    const weeks = Math.floor(Math.abs(diffInDays) / 7);
    return `in ${weeks} week${weeks > 1 ? 's' : ''}`;
  } else {
    return formatShortDate(dateObj);
  }
}

// Get date format placeholder for input fields
export function getDateFormatPlaceholder(): string {
  // Always return UK format for consistency
  return 'dd/mm/yyyy';
}

// Get month names in user's locale (UK format)
export function getMonthNames(format: 'long' | 'short' = 'long'): string[] {
  const locale = 'en-GB';
  const months: string[] = [];
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(2024, i, 1);
    months.push(date.toLocaleDateString(locale, { month: format }));
  }
  
  return months;
}

// Get day names in user's locale (UK format)
export function getDayNames(format: 'long' | 'short' | 'narrow' = 'long'): string[] {
  const locale = 'en-GB';
  const days: string[] = [];
  
  // Start with Sunday (0) to Saturday (6)
  for (let i = 0; i < 7; i++) {
    const date = new Date(2024, 0, i + 7); // January 7-13, 2024 (Sunday-Saturday)
    days.push(date.toLocaleDateString(locale, { weekday: format }));
  }
  
  return days;
}
