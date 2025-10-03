/**
 * XSS Protection using DOMPurify
 * Sanitizes all user inputs to prevent cross-site scripting attacks
 */

import DOMPurify from 'dompurify';
import { logger } from '../services/loggingService';

// Configure DOMPurify options for different contexts
const DEFAULT_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span', 'div'],
  ALLOWED_ATTR: ['class', 'style'],
  ALLOW_DATA_ATTR: false,
  USE_PROFILES: { html: true }
};

const STRICT_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true
};

const MARKDOWN_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 
                  'blockquote', 'code', 'pre', 'br', 'hr', 'strong', 'em', 'b', 'i'],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  ALLOW_DATA_ATTR: false
};

/**
 * Sanitize HTML content
 * Use this for any content that might contain HTML
 */
export const sanitizeHTML = (dirty: string, config: DOMPurify.Config = DEFAULT_CONFIG): string => {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, config);
};

/**
 * Sanitize plain text
 * Use this for inputs that should not contain any HTML
 */
export const sanitizeText = (dirty: string): string => {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, STRICT_CONFIG);
};

/**
 * Sanitize markdown content
 * Use this for markdown fields that might be rendered as HTML
 * Note: This sanitizes the raw markdown, not rendered HTML
 */
export const sanitizeMarkdown = (dirty: string): string => {
  if (!dirty) return '';
  
  // First, sanitize any embedded HTML/scripts in the markdown
  let safe = DOMPurify.sanitize(dirty, STRICT_CONFIG);
  
  // Then remove dangerous markdown patterns
  // Match markdown links with better handling of nested parentheses
  safe = safe.replace(/\[([^\]]+)\]\(((?:[^)(]|\([^)]*\))*)\)/gi, (match, linkText, url) => {
    const lowerUrl = url.toLowerCase().trim();
    if (lowerUrl.startsWith('javascript:') || 
        lowerUrl.startsWith('data:') || 
        lowerUrl.startsWith('vbscript:')) {
      return `[${linkText}]()`;
    }
    return match;
  });
  
  return safe;
};

/**
 * Sanitize URL
 * Prevents javascript: and data: URLs
 */
export const sanitizeURL = (url: string): string => {
  if (!url) return '';
  
  // First sanitize as text to remove any HTML/script tags
  const sanitizedText = sanitizeText(url);
  
  // Remove any whitespace and convert to lowercase for checking
  const cleanUrl = sanitizedText.trim().toLowerCase();
  
  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  if (dangerousProtocols.some(protocol => cleanUrl.startsWith(protocol))) {
    logger.warn('Blocked dangerous URL:', url);
    return '';
  }
  
  // Additional URL validation
  try {
    const urlObject = new URL(sanitizedText, window.location.origin);
    // Only allow http(s) and relative URLs
    if (!['http:', 'https:', ''].includes(urlObject.protocol)) {
      return '';
    }
    return sanitizedText;
  } catch {
    // If URL parsing fails, treat as relative URL
    return sanitizedText;
  }
};

/**
 * Sanitize JSON string
 * Use this before parsing JSON from user input
 */
export const sanitizeJSON = (jsonString: string): string => {
  if (!jsonString) return '{}';
  
  try {
    // Parse and re-stringify to remove any non-JSON content
    const parsed = JSON.parse(jsonString);
    // Recursively sanitize string values in the JSON
    const sanitized = sanitizeJSONObject(parsed);
    return JSON.stringify(sanitized);
  } catch {
    logger.warn('Invalid JSON input:', jsonString);
    return '{}';
  }
};

/**
 * Types for JSON sanitization
 */
type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
interface JSONObject {
  [key: string]: JSONValue;
}
interface JSONArray extends Array<JSONValue> {}

/**
 * Recursively sanitize object values
 */
const sanitizeJSONObject = (obj: JSONValue): JSONValue => {
  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeJSONObject);
  }
  
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const sanitized: JSONObject = {};
    for (const [key, value] of Object.entries(obj as JSONObject)) {
      // Sanitize the key as well
      const sanitizedKey = sanitizeText(key);
      sanitized[sanitizedKey] = sanitizeJSONObject(value);
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * Sanitize filename
 * Removes potentially dangerous characters from filenames
 */
export const sanitizeFilename = (filename: string): string => {
  if (!filename) return '';
  
  // Remove path traversal attempts
  let safe = filename.replace(/\.\./g, '');
  
  // Remove special characters except for common filename chars
  safe = safe.replace(/[^a-zA-Z0-9._\- ]/g, '');
  
  // Limit length
  if (safe.length > 255) {
    safe = safe.substring(0, 255);
  }
  
  return safe;
};

/**
 * Sanitize SQL-like input
 * Use this for search queries or filters
 */
export const sanitizeQuery = (query: string): string => {
  if (!query) return '';
  
  // Remove SQL injection attempts
  let safe = query.replace(/[';\\]/g, '');
  
  // Only remove dangerous SQL keywords when combined with special characters
  // This prevents removing legitimate words like "select" from normal searches
  const dangerousPatterns = [
    /;\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|EXEC)\s+/gi,
    /UNION\s+SELECT/gi,
    /SELECT\s+\*\s+FROM/gi,
    /--\s*$/g,  // SQL comments
    /\/\*.*?\*\//g  // SQL block comments
  ];
  
  dangerousPatterns.forEach(pattern => {
    safe = safe.replace(pattern, '');
  });
  
  return sanitizeText(safe);
};

/**
 * Sanitize number input
 * Ensures the input is a valid number
 */
export const sanitizeNumber = (input: string | number): number => {
  const num = Number(input);
  if (isNaN(num) || !isFinite(num)) {
    return 0;
  }
  return num;
};

/**
 * Sanitize decimal/currency input
 * Ensures the input is a valid decimal number
 */
export const sanitizeDecimal = (input: string | number, decimals: number = 2): string => {
  const num = sanitizeNumber(input);
  return num.toFixed(decimals);
};

/**
 * Sanitize date input
 * Ensures the input is a valid date
 */
export const sanitizeDate = (input: string | Date): Date | null => {
  if (!input) return null;
  
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    return null;
  }
  
  // Prevent dates that are too far in the past or future
  const minDate = new Date('1900-01-01');
  const maxDate = new Date('2100-12-31');
  
  if (date < minDate || date > maxDate) {
    return null;
  }
  
  return date;
};

/**
 * Type-safe props sanitization
 */
type SanitizableValue = string | number | Date | boolean | null | undefined;
type SanitizableProps = Record<string, SanitizableValue | SanitizableValue[]>;

/**
 * Create a sanitized component props helper
 * Use this to sanitize all props passed to a component
 */
export const sanitizeProps = <T extends SanitizableProps>(props: T): T => {
  const sanitized: Partial<T> = {};
  
  for (const [key, value] of Object.entries(props) as [keyof T, T[keyof T]][]) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value) as T[keyof T];
    } else if (typeof value === 'number') {
      sanitized[key] = sanitizeNumber(value) as T[keyof T];
    } else if (value instanceof Date) {
      sanitized[key] = sanitizeDate(value) as T[keyof T];
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeText(item) : item
      ) as T[keyof T];
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
};

/**
 * Hook to automatically sanitize form inputs
 */
export const useSanitizedInput = (initialValue: string = '', type: 'text' | 'html' | 'url' | 'query' = 'text'): {
  sanitize: (value: string) => string;
  sanitizeOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => string;
} => {
  const sanitize = (value: string): string => {
    switch (type) {
      case 'html':
        return sanitizeHTML(value);
      case 'url':
        return sanitizeURL(value);
      case 'query':
        return sanitizeQuery(value);
      default:
        return sanitizeText(value);
    }
  };

  return {
    sanitize,
    sanitizeOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const sanitized = sanitize(e.target.value);
      e.target.value = sanitized;
      return sanitized;
    }
  };
};

// Set up DOMPurify hooks for additional security
if (typeof window !== 'undefined') {
  // Add a hook to log all sanitization operations in development
  const isDevelopment = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'development';
  if (isDevelopment) {
    DOMPurify.addHook('beforeSanitizeElements', (node: Node, data: DOMPurify.HookEvent) => {
      if (data && data.tagName && ['script', 'iframe', 'object', 'embed'].includes(data.tagName)) {
        logger.warn('DOMPurify blocked dangerous element:', data.tagName);
      }
    });
  }

  // Add hook to set target="_blank" rel="noopener" on external links
  DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
    if ('target' in node && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}