/**
 * Global Sanitizer
 * Applies XSS protection to all user inputs in the application
 */

import { 
  sanitizeText, 
  sanitizeHTML, 
  sanitizeURL, 
  sanitizeNumber,
  sanitizeDate,
  sanitizeFilename,
  sanitizeQuery
} from './xss-protection';
import { createScopedLogger } from '../loggers/scopedLogger';

const logger = createScopedLogger('GlobalSanitizer');

// Define sanitization rules for different data types
interface SanitizationRule {
  fields: string[];
  type: 'text' | 'html' | 'url' | 'number' | 'date' | 'filename' | 'query';
}

// Common field patterns and their sanitization rules
const SANITIZATION_RULES: SanitizationRule[] = [
  // Text fields
  {
    fields: ['name', 'description', 'title', 'label', 'notes', 'comment', 'remarks'],
    type: 'text'
  },
  // HTML content fields
  {
    fields: ['content', 'body', 'html'],
    type: 'html'
  },
  // URL fields
  {
    fields: ['url', 'link', 'href', 'website', 'homepage'],
    type: 'url'
  },
  // Numeric fields
  {
    fields: ['amount', 'balance', 'price', 'quantity', 'total', 'value'],
    type: 'number'
  },
  // Date fields
  {
    fields: ['date', 'startDate', 'endDate', 'createdAt', 'updatedAt', 'dueDate'],
    type: 'date'
  },
  // File fields
  {
    fields: ['filename', 'fileName', 'file'],
    type: 'filename'
  },
  // Search/query fields
  {
    fields: ['search', 'query', 'filter', 'keyword'],
    type: 'query'
  }
];

/**
 * Sanitize a single value based on field name
 */
export const sanitizeByFieldName = (fieldName: string, value: unknown): unknown => {
  if (value == null) return value;

  // Find matching rule for the field
  const rule = SANITIZATION_RULES.find(r => 
    r.fields.some(field => fieldName.toLowerCase().includes(field.toLowerCase()))
  );

  if (!rule) {
    // Default to text sanitization for unknown fields
    return typeof value === 'string' ? sanitizeText(value) : value;
  }

  switch (rule.type) {
    case 'text':
      return typeof value === 'string' ? sanitizeText(value) : value;
    case 'html':
      return typeof value === 'string' ? sanitizeHTML(value) : value;
    case 'url':
      return typeof value === 'string' ? sanitizeURL(value) : value;
    case 'number':
      return sanitizeNumber(typeof value === 'number' ? value : String(value ?? ''));
    case 'date':
      return sanitizeDate(value instanceof Date ? value : String(value ?? ''));
    case 'filename':
      return typeof value === 'string' ? sanitizeFilename(value) : value;
    case 'query':
      return typeof value === 'string' ? sanitizeQuery(value) : value;
    default:
      return value;
  }
};

type SanitizableValue = Record<string, unknown> | unknown[];

const isSanitizableValue = (value: unknown): value is SanitizableValue =>
  typeof value === 'object' && value !== null && !(value instanceof Date);

/**
 * Recursively sanitize an object or array
 */
export const sanitizeObject = <T extends SanitizableValue>(obj: T, depth: number = 0): T => {
  // Prevent infinite recursion
  if (depth > 10) {
    logger.warn('Maximum sanitization depth reached');
    return obj;
  }

  if (Array.isArray(obj)) {
    const sanitizedArray: unknown[] = [];

    obj.forEach((value, index) => {
      if (value == null) {
        sanitizedArray[index] = value;
      } else if (isSanitizableValue(value)) {
        sanitizedArray[index] = sanitizeObject(value, depth + 1);
      } else {
        sanitizedArray[index] = sanitizeByFieldName(String(index), value);
      }
    });

    return sanitizedArray as T;
  }

  const sanitizedRecord: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value == null) {
      sanitizedRecord[key] = value;
    } else if (isSanitizableValue(value)) {
      sanitizedRecord[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitizedRecord[key] = sanitizeByFieldName(key, value);
    }
  }

  return sanitizedRecord as T;
};

/**
 * Sanitize form data before submission
 */
export const sanitizeFormData = (formData: FormData): FormData => {
  const sanitized = new FormData();

  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      const sanitizedValue = sanitizeByFieldName(key, value);
      sanitized.append(key, typeof sanitizedValue === 'string' ? sanitizedValue : String(value));
    } else if (value instanceof File) {
      // Sanitize filename
      const sanitizedFilename = sanitizeFilename(value.name);
      // Create a new File object with sanitized name
      const sanitizedFile = new File([value], sanitizedFilename, {
        type: value.type,
        lastModified: value.lastModified
      });
      sanitized.append(key, sanitizedFile);
    } else {
      sanitized.append(key, value);
    }
  });

  return sanitized;
};

/**
 * Create a proxy that automatically sanitizes object properties
 */
export const createSanitizedProxy = <T extends Record<string, unknown>>(target: T): T => {
  return new Proxy(target, {
    set(obj, prop: string | symbol, value: unknown) {
      if (typeof prop === 'string') {
        const sanitizedValue = isSanitizableValue(value)
          ? sanitizeObject(value)
          : sanitizeByFieldName(prop, value);
        return Reflect.set(obj, prop, sanitizedValue);
      }
      return Reflect.set(obj, prop, value);
    },
    get(obj, prop: string | symbol) {
      const value = Reflect.get(obj, prop);
      if (typeof prop === 'string' && isSanitizableValue(value)) {
        return createSanitizedProxy(value as Record<string, unknown>);
      }
      return value;
    }
  });
};

/**
 * Middleware function for API requests
 * Sanitizes request body before sending
 */
export const sanitizeRequestMiddleware = (config: { data?: unknown }) => {
  if (config.data && isSanitizableValue(config.data)) {
    config.data = sanitizeObject(config.data);
  }
  return config;
};

/**
 * Middleware function for API responses
 * Sanitizes response data before using
 */
export const sanitizeResponseMiddleware = (response: { data?: unknown }) => {
  if (response.data && isSanitizableValue(response.data)) {
    response.data = sanitizeObject(response.data);
  }
  return response;
};
