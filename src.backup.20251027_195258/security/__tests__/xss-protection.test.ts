/**
 * XSS Protection Tests
 * Verifies that all sanitization functions properly neutralize XSS attacks
 */

import { describe, it, expect, vi } from 'vitest';

const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../services/serviceFactory', () => ({
  lazyLogger: {
    getLogger: () => loggerMock,
  },
}));
import {
  sanitizeText,
  sanitizeHTML,
  sanitizeURL,
  sanitizeQuery,
  sanitizeJSON,
  sanitizeFilename,
  sanitizeNumber,
  sanitizeDecimal,
  sanitizeDate,
  sanitizeMarkdown
} from '../xss-protection';

describe('XSS Protection', () => {
  describe('sanitizeText', () => {
    it('removes script tags', () => {
      const input = '<script>alert("XSS")</script>Hello';
      const result = sanitizeText(input);
      expect(result).toBe('Hello');
      expect(result).not.toContain('<script>');
    });

    it('removes event handlers', () => {
      const input = '<div onclick="alert(\'XSS\')">Click me</div>';
      const result = sanitizeText(input);
      expect(result).toBe('Click me');
      expect(result).not.toContain('onclick');
    });

    it('handles empty input', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
    });

    it('preserves safe text', () => {
      const input = 'This is safe text with special chars: @#$%^&*()';
      expect(sanitizeText(input)).toBe(input);
    });
  });

  describe('sanitizeHTML', () => {
    it('allows safe HTML tags', () => {
      const input = '<b>Bold</b> and <i>italic</i> text';
      const result = sanitizeHTML(input);
      expect(result).toContain('<b>Bold</b>');
      expect(result).toContain('<i>italic</i>');
    });

    it('removes dangerous tags', () => {
      const input = '<script>alert("XSS")</script><iframe src="evil.com"></iframe>';
      const result = sanitizeHTML(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('<iframe>');
    });

    it('removes dangerous attributes', () => {
      const input = '<div onclick="alert(\'XSS\')" onmouseover="alert(\'XSS\')">Content</div>';
      const result = sanitizeHTML(input);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onmouseover');
    });
  });

  describe('sanitizeURL', () => {
    it('allows safe URLs', () => {
      const urls = [
        'https://example.com',
        'http://example.com',
        '/relative/path',
        'relative/path'
      ];
      urls.forEach(url => {
        expect(sanitizeURL(url)).toBe(url);
      });
    });

    it('blocks javascript URLs', () => {
      const dangerous = [
        'javascript:alert("XSS")',
        'JavaScript:alert("XSS")',
        ' javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:msgbox("XSS")'
      ];
      dangerous.forEach(url => {
        expect(sanitizeURL(url)).toBe('');
      });
    });

    it('handles malformed URLs', () => {
      const input = 'not a valid url with <script>';
      const result = sanitizeURL(input);
      expect(result).not.toContain('<script>');
    });
  });

  describe('sanitizeQuery', () => {
    it('removes SQL injection attempts', () => {
      const input = "'; DROP TABLE users; --";
      const result = sanitizeQuery(input);
      expect(result).not.toContain("'");
      expect(result).not.toContain(';');
      // The word DROP by itself might be preserved, but not in dangerous context
    });

    it('removes dangerous SQL patterns', () => {
      const input = 'UNION SELECT * FROM users';
      const result = sanitizeQuery(input);
      expect(result).not.toContain('UNION SELECT');
      
      const input2 = 'value = 5; DROP TABLE users';
      const result2 = sanitizeQuery(input2);
      expect(result2).not.toContain(';');
      expect(result2).toContain('value = 5');
    });

    it('preserves legitimate use of SQL words', () => {
      const input = 'I want to select the best option from the list';
      const result = sanitizeQuery(input);
      expect(result).toContain('select');
      expect(result).toContain('from');
    });

    it('preserves safe search queries', () => {
      const input = 'search for products under $50';
      const result = sanitizeQuery(input);
      expect(result).toContain('search for products under $50');
    });
  });

  describe('sanitizeJSON', () => {
    it('sanitizes string values in JSON', () => {
      const input = '{"name": "<script>alert(\'XSS\')</script>"}';
      const result = sanitizeJSON(input);
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe('');
    });

    it('handles nested objects', () => {
      const input = JSON.stringify({
        user: {
          name: '<script>evil</script>John',
          profile: {
            bio: 'Normal bio with <script>alert("XSS")</script>'
          }
        }
      });
      const result = sanitizeJSON(input);
      const parsed = JSON.parse(result);
      expect(parsed.user.name).toBe('John');
      expect(parsed.user.profile.bio).toBe('Normal bio with ');
    });

    it('returns empty object for invalid JSON', () => {
      expect(sanitizeJSON('not valid json')).toBe('{}');
      expect(sanitizeJSON('')).toBe('{}');
    });
  });

  describe('sanitizeFilename', () => {
    it('removes path traversal attempts', () => {
      const input = '../../../etc/passwd';
      const result = sanitizeFilename(input);
      expect(result).not.toContain('..');
      expect(result).toBe('etcpasswd');
    });

    it('removes special characters', () => {
      const input = 'file<script>.txt';
      const result = sanitizeFilename(input);
      expect(result).toBe('filescript.txt');
    });

    it('limits filename length', () => {
      const input = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(input);
      expect(result.length).toBeLessThanOrEqual(255);
    });

    it('preserves valid filenames', () => {
      const input = 'my-file_name.v2.0.txt';
      expect(sanitizeFilename(input)).toBe(input);
    });
  });

  describe('sanitizeNumber', () => {
    it('converts valid numbers', () => {
      expect(sanitizeNumber('123')).toBe(123);
      expect(sanitizeNumber('123.45')).toBe(123.45);
      expect(sanitizeNumber(-99.99)).toBe(-99.99);
    });

    it('returns 0 for invalid input', () => {
      expect(sanitizeNumber('not a number')).toBe(0);
      expect(sanitizeNumber('123abc')).toBe(0);
      expect(sanitizeNumber(NaN)).toBe(0);
      expect(sanitizeNumber(Infinity)).toBe(0);
    });
  });

  describe('sanitizeDecimal', () => {
    it('formats decimal numbers', () => {
      expect(sanitizeDecimal(123.456, 2)).toBe('123.46');
      expect(sanitizeDecimal('99.999', 2)).toBe('100.00');
      expect(sanitizeDecimal(0.1, 1)).toBe('0.1');
    });

    it('handles invalid input', () => {
      expect(sanitizeDecimal('invalid', 2)).toBe('0.00');
      expect(sanitizeDecimal(NaN, 2)).toBe('0.00');
    });
  });

  describe('sanitizeDate', () => {
    it('accepts valid dates', () => {
      const date = new Date('2024-01-01');
      expect(sanitizeDate(date)).toEqual(date);
      expect(sanitizeDate('2024-01-01')).toEqual(date);
    });

    it('rejects invalid dates', () => {
      expect(sanitizeDate('not a date')).toBeNull();
      expect(sanitizeDate('')).toBeNull();
    });

    it('rejects dates outside valid range', () => {
      expect(sanitizeDate('1800-01-01')).toBeNull();
      expect(sanitizeDate('2200-01-01')).toBeNull();
    });
  });

  describe('sanitizeMarkdown', () => {
    it('preserves safe markdown syntax', () => {
      const input = '# Heading\n**Bold** and *italic*\n[Link](https://example.com)';
      const result = sanitizeMarkdown(input);
      // Should preserve markdown syntax, not convert to HTML
      expect(result).toContain('# Heading');
      expect(result).toContain('**Bold**');
      expect(result).toContain('*italic*');
      expect(result).toContain('[Link](https://example.com)');
    });

    it('removes dangerous elements from markdown', () => {
      const input = '<script>alert("XSS")</script>\n[Evil](javascript:alert("XSS"))';
      const result = sanitizeMarkdown(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('javascript:');
      // Should keep the link text but remove the dangerous URL
      expect(result).toContain('Evil');
    });

    it('removes various dangerous URL schemes', () => {
      // Test simple dangerous URLs
      const input1 = '[Click](javascript:alert("XSS"))';
      expect(sanitizeMarkdown(input1)).toBe('[Click]()');
      
      const input2 = '[Click](vbscript:msgbox("XSS"))';
      expect(sanitizeMarkdown(input2)).toBe('[Click]()');
      
      // Test data URL - note it has nested content that gets sanitized first
      const input3 = '[Click](data:text/html,<script>alert("XSS")</script>)';
      const result3 = sanitizeMarkdown(input3);
      // The script tag is removed first, then the data: URL is handled
      expect(result3).not.toContain('data:');
      expect(result3).not.toContain('script');
      expect(result3).toContain('Click');
    });
  });
});
