/**
 * Global Sanitizer
 * Applies XSS protection to all user inputs in the application
 */

import { logger } from '../services/loggingService';
import { 
  sanitizeText, 
  sanitizeHTML, 
  sanitizeURL, 
  sanitizeNumber,
  sanitizeDate,
  sanitizeFilename,
  sanitizeQuery
} from './xss-protection';

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
export const sanitizeByFieldName = (fieldName: string, value: any): any => {
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
      return sanitizeNumber(value);
    case 'date':
      return sanitizeDate(value);
    case 'filename':
      return typeof value === 'string' ? sanitizeFilename(value) : value;
    case 'query':
      return typeof value === 'string' ? sanitizeQuery(value) : value;
    default:
      return value;
  }
};

/**
 * Recursively sanitize an object
 */
export const sanitizeObject = <T>(obj: T, depth: number = 0): T => {
  // Prevent infinite recursion
  if (depth > 10) {
    logger.warn('Maximum sanitization depth reached');
    return obj;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => {
      if (item === null || item === undefined) {
        return item;
      }
      if (typeof item === 'object' && !(item instanceof Date)) {
        return sanitizeObject(item, depth + 1);
      }
      return typeof index === 'number' ? sanitizeByFieldName(index.toString(), item) : item;
    }) as unknown as T;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      result[key] = sanitizeObject(value, depth + 1);
    } else {
      result[key] = sanitizeByFieldName(key, value);
    }
  }

  return result as T;
};

/**
 * Sanitize form data before submission
 */
export const sanitizeFormData = (formData: FormData): FormData => {
  const sanitized = new FormData();

  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      sanitized.append(key, sanitizeByFieldName(key, value));
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
  const handler: ProxyHandler<T> = {
    set(obj, prop, value) {
      if (typeof prop === 'string') {
        return Reflect.set(obj as Record<string, unknown>, prop, sanitizeByFieldName(prop, value));
      }

      return Reflect.set(obj, prop, value);
    },
    get(obj, prop, receiver) {
      const rawValue = Reflect.get(obj, prop, receiver) as unknown;
      if (typeof prop === 'string' && rawValue && typeof rawValue === 'object' && !(rawValue instanceof Date)) {
        return createSanitizedProxy(rawValue as Record<string, unknown>);
      }
      return rawValue;
    }
  };

  return new Proxy(target, handler);
};

/**
 * Middleware function for API requests
 * Sanitizes request body before sending
 */
export const sanitizeRequestMiddleware = (config: any) => {
  if (config.data) {
    config.data = sanitizeObject(config.data);
  }
  return config;
};

/**
 * Middleware function for API responses
 * Sanitizes response data before using
 */
export const sanitizeResponseMiddleware = (response: any) => {
  if (response.data) {
    response.data = sanitizeObject(response.data);
  }
  return response;
};
