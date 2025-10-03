/**
 * Comprehensive tests for FormattingService
 * Following CLAUDE_WORKFILE.md Phase 1 requirement for money/parsers/formatters testing
 */

import { describe, it, expect } from 'vitest';
import { formattingService } from '../FormattingService';
import { toDecimal } from '../../utils/decimal';

describe('FormattingService', () => {
  describe('Currency Formatting', () => {
    it('formats positive amounts correctly', () => {
      const result = formattingService.formatCurrency(1234.56);
      expect(result).toMatch(/1,234\.56/);
    });

    it('formats negative amounts correctly', () => {
      const result = formattingService.formatCurrency(-1234.56);
      expect(result).toMatch(/-.*1,234\.56/);
    });

    it('formats zero correctly', () => {
      const result = formattingService.formatCurrency(0);
      expect(result).toMatch(/0\.00/);
    });

    it('formats decimal instances correctly', () => {
      const decimal = toDecimal(1234.56);
      const result = formattingService.formatCurrency(decimal);
      expect(result).toMatch(/1,234\.56/);
    });

    it('formats string amounts correctly', () => {
      const result = formattingService.formatCurrency('1234.56');
      expect(result).toMatch(/1,234\.56/);
    });
  });

  describe('Currency with Sign Formatting', () => {
    it('adds plus sign for positive amounts', () => {
      const result = formattingService.formatCurrencyWithSign(100);
      expect(result).toMatch(/^\+.*100/);
    });

    it('handles negative amounts correctly', () => {
      const result = formattingService.formatCurrencyWithSign(-100);
      expect(result).toMatch(/^-.*100/);
    });
  });

  describe('Compact Currency Formatting', () => {
    it('formats millions with M suffix', () => {
      const result = formattingService.formatCurrencyCompact(1500000);
      expect(result).toMatch(/1\.5M/);
    });

    it('formats thousands with K suffix', () => {
      const result = formattingService.formatCurrencyCompact(1500);
      expect(result).toMatch(/1\.5K/);
    });

    it('formats small amounts normally', () => {
      const result = formattingService.formatCurrencyCompact(100);
      expect(result).toMatch(/100/);
    });
  });

  describe('Number Formatting', () => {
    it('formats numbers with specified decimals', () => {
      const result = formattingService.formatNumber(1234.5678, 2);
      expect(result).toBe('1,234.57');
    });

    it('handles zero decimals', () => {
      const result = formattingService.formatNumber(1234.5678, 0);
      expect(result).toBe('1,235');
    });
  });

  describe('Percentage Formatting', () => {
    it('formats percentages correctly', () => {
      const result = formattingService.formatPercentage(0.75, 1);
      expect(result).toBe('75.0%');
    });

    it('handles decimal percentages', () => {
      const result = formattingService.formatPercentage(0.1234, 2);
      expect(result).toBe('12.34%');
    });
  });

  describe('Date Formatting', () => {
    it('formats dates in different styles', () => {
      const date = new Date('2024-01-15');

      const short = formattingService.formatDate(date, 'short');
      const medium = formattingService.formatDate(date, 'medium');
      const long = formattingService.formatDate(date, 'long');

      expect(short).toMatch(/1\/15\/24|15\/1\/24/);
      expect(medium).toMatch(/Jan.*15.*2024/);
      expect(long).toMatch(/January.*15.*2024/);
    });

    it('handles string dates correctly', () => {
      const result = formattingService.formatDate('2024-01-15');
      expect(result).toMatch(/Jan.*15.*2024/);
    });
  });

  describe('Error Handling', () => {
    it('handles invalid currency values gracefully', () => {
      const result = formattingService.formatCurrency(NaN);
      expect(result).toMatch(/0\.00/);
    });

    it('handles invalid dates gracefully', () => {
      const result = formattingService.formatDate('invalid-date');
      expect(result).toBe('Invalid date');
    });
  });
});