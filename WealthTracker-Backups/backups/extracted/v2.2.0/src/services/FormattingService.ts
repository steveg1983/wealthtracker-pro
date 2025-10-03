import Decimal from 'decimal.js';
import { FINANCIAL, DATA, TIME } from '../constants';
import { logger } from './loggingService';

/**
 * Enterprise-grade unified formatting service
 * Eliminates code duplication and provides consistent formatting across the application
 * Microsoft/Apple/Google standard - single source of truth for all formatting
 */
export class FormattingService {
  private readonly locale: string;
  private readonly currency: string;
  private readonly timezone: string;

  constructor(
    locale: string = 'en-GB',
    currency: string = 'GBP',
    timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  ) {
    this.locale = locale;
    this.currency = currency;
    this.timezone = timezone;
  }

  // ============================================================================
  // Currency Formatting
  // ============================================================================

  /**
   * Format currency with proper symbol and locale
   */
  formatCurrency(
    amount: number | string | Decimal,
    options: Intl.NumberFormatOptions = {}
  ): string {
    try {
      const value = this.toNumber(amount);
      
      return new Intl.NumberFormat(this.locale, {
        style: 'currency',
        currency: this.currency,
        minimumFractionDigits: FINANCIAL.DECIMAL_PLACES,
        maximumFractionDigits: FINANCIAL.DECIMAL_PLACES,
        ...options
      }).format(value);
    } catch (error) {
      logger.error('Currency formatting error:', error);
      return `${this.currency} 0.00`;
    }
  }

  /**
   * Format currency with sign indicator (+/-)
   */
  formatCurrencyWithSign(amount: number | string | Decimal): string {
    const value = this.toNumber(amount);
    const formatted = this.formatCurrency(Math.abs(value));
    return value >= 0 ? `+${formatted}` : `-${formatted.replace('-', '')}`;
  }

  /**
   * Format currency for display in charts (compact notation)
   */
  formatCurrencyCompact(amount: number | string | Decimal): string {
    const value = this.toNumber(amount);
    
    if (Math.abs(value) >= 1_000_000) {
      return this.formatCurrency(value / 1_000_000, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).replace(/[0-9.]+/, `${(value / 1_000_000).toFixed(1)}M`);
    }
    
    if (Math.abs(value) >= 1_000) {
      return this.formatCurrency(value / 1_000, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).replace(/[0-9.]+/, `${(value / 1_000).toFixed(1)}K`);
    }
    
    return this.formatCurrency(value);
  }

  // ============================================================================
  // Number Formatting
  // ============================================================================

  /**
   * Format number with locale-specific separators
   */
  formatNumber(
    value: number | string | Decimal,
    decimals: number = FINANCIAL.DECIMAL_PLACES
  ): string {
    try {
      const num = this.toNumber(value);
      
      return new Intl.NumberFormat(this.locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(num);
    } catch (error) {
      logger.error('Number formatting error:', error);
      return '0';
    }
  }

  /**
   * Format percentage with proper symbol
   */
  formatPercentage(
    value: number | string | Decimal,
    decimals: number = 1
  ): string {
    try {
      const num = this.toNumber(value);
      
      return new Intl.NumberFormat(this.locale, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(num / 100);
    } catch (error) {
      logger.error('Percentage formatting error:', error);
      return '0%';
    }
  }

  /**
   * Format decimal as percentage (already in percentage form)
   */
  formatDecimalAsPercentage(
    value: number | string | Decimal,
    decimals: number = 1
  ): string {
    const num = this.toNumber(value);
    return `${num.toFixed(decimals)}%`;
  }

  // ============================================================================
  // Date Formatting
  // ============================================================================

  /**
   * Format date with locale-specific format
   */
  formatDate(
    date: Date | string | number,
    format: 'short' | 'medium' | 'long' | 'full' = 'medium'
  ): string {
    try {
      const dateObj = this.toDate(date);
      
      const options: Intl.DateTimeFormatOptions = {
        short: { month: 'numeric', day: 'numeric', year: '2-digit' },
        medium: { month: 'short', day: 'numeric', year: 'numeric' },
        long: { month: 'long', day: 'numeric', year: 'numeric' },
        full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
      }[format];
      
      return new Intl.DateTimeFormat(this.locale, {
        ...options,
        timeZone: this.timezone
      }).format(dateObj);
    } catch (error) {
      logger.error('Date formatting error:', error);
      return 'Invalid date';
    }
  }

  /**
   * Format date as ISO string (YYYY-MM-DD)
   */
  formatDateISO(date: Date | string | number): string {
    try {
      const dateObj = this.toDate(date);
      return dateObj.toISOString().split('T')[0];
    } catch (error) {
      logger.error('ISO date formatting error:', error);
      return '';
    }
  }

  /**
   * Format date for display in tables/lists
   */
  formatDateCompact(date: Date | string | number): string {
    const dateObj = this.toDate(date);
    const now = new Date();
    
    // Today
    if (this.isSameDay(dateObj, now)) {
      return 'Today';
    }
    
    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (this.isSameDay(dateObj, yesterday)) {
      return 'Yesterday';
    }
    
    // Within 7 days
    const daysDiff = Math.floor((now.getTime() - dateObj.getTime()) / TIME.DAY);
    if (daysDiff > 0 && daysDiff < 7) {
      return `${daysDiff} days ago`;
    }
    
    // Default format
    return this.formatDate(dateObj, 'short');
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  formatRelativeTime(date: Date | string | number): string {
    try {
      const dateObj = this.toDate(date);
      const now = new Date();
      const diff = now.getTime() - dateObj.getTime();
      
      if (diff < TIME.MINUTE) {
        return 'just now';
      }
      
      if (diff < TIME.HOUR) {
        const minutes = Math.floor(diff / TIME.MINUTE);
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
      }
      
      if (diff < TIME.DAY) {
        const hours = Math.floor(diff / TIME.HOUR);
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      }
      
      if (diff < TIME.WEEK) {
        const days = Math.floor(diff / TIME.DAY);
        return `${days} day${days !== 1 ? 's' : ''} ago`;
      }
      
      if (diff < TIME.MONTH) {
        const weeks = Math.floor(diff / TIME.WEEK);
        return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
      }
      
      return this.formatDate(dateObj, 'medium');
    } catch (error) {
      logger.error('Relative time formatting error:', error);
      return '';
    }
  }

  // ============================================================================
  // Duration Formatting
  // ============================================================================

  /**
   * Format duration in human-readable format
   */
  formatDuration(milliseconds: number): string {
    const hours = Math.floor(milliseconds / TIME.HOUR);
    const minutes = Math.floor((milliseconds % TIME.HOUR) / TIME.MINUTE);
    const seconds = Math.floor((milliseconds % TIME.MINUTE) / TIME.SECOND);
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    
    return parts.join(' ');
  }

  /**
   * Format months duration (e.g., for loan terms)
   */
  formatMonthsDuration(months: number): string {
    const years = Math.floor(months / FINANCIAL.MONTHS_PER_YEAR);
    const remainingMonths = months % FINANCIAL.MONTHS_PER_YEAR;
    
    const parts = [];
    if (years > 0) {
      parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    }
    if (remainingMonths > 0) {
      parts.push(`${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`);
    }
    
    return parts.join(' ');
  }

  // ============================================================================
  // File Size Formatting
  // ============================================================================

  /**
   * Format file size in human-readable format
   */
  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  // ============================================================================
  // Account & Transaction Formatting
  // ============================================================================

  /**
   * Format account number with masking
   */
  formatAccountNumber(accountNumber: string, showLast: number = 4): string {
    if (!accountNumber || accountNumber.length <= showLast) {
      return accountNumber;
    }
    
    const masked = '*'.repeat(accountNumber.length - showLast);
    const visible = accountNumber.slice(-showLast);
    return `${masked}${visible}`;
  }

  /**
   * Format transaction description for display
   */
  formatTransactionDescription(description: string, maxLength: number = 50): string {
    if (!description) return '';
    
    // Clean up common prefixes
    const cleaned = description
      .replace(/^(POS |ATM |ONLINE |TRANSFER |PAYMENT )/, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Truncate if needed
    if (cleaned.length > maxLength) {
      return `${cleaned.substring(0, maxLength - 3)}...`;
    }
    
    return cleaned;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Convert various types to number
   */
  private toNumber(value: number | string | Decimal): number {
    if (value instanceof Decimal) {
      return value.toNumber();
    }
    if (typeof value === 'string') {
      return parseFloat(value) || 0;
    }
    return value || 0;
  }

  /**
   * Convert various types to Date
   */
  private toDate(value: Date | string | number): Date {
    if (value instanceof Date) {
      return value;
    }
    return new Date(value);
  }

  /**
   * Check if two dates are the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  /**
   * Create a formatter with custom locale/currency
   */
  static createFormatter(locale?: string, currency?: string): FormattingService {
    return new FormattingService(locale, currency);
  }

  /**
   * Get region-specific formatter
   */
  static getRegionalFormatter(region: 'UK' | 'US'): FormattingService {
    const config = {
      UK: { locale: 'en-GB', currency: 'GBP' },
      US: { locale: 'en-US', currency: 'USD' }
    };
    
    return new FormattingService(config[region].locale, config[region].currency);
  }
}

// Export singleton instance with default settings
export const formattingService = new FormattingService();

// Export factory functions for convenience
export const formatCurrency = formattingService.formatCurrency.bind(formattingService);
export const formatNumber = formattingService.formatNumber.bind(formattingService);
export const formatDate = formattingService.formatDate.bind(formattingService);
export const formatPercentage = formattingService.formatPercentage.bind(formattingService);
export const formatRelativeTime = formattingService.formatRelativeTime.bind(formattingService);
export const formatDuration = formattingService.formatDuration.bind(formattingService);