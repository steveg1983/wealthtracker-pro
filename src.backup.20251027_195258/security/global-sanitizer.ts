/**
 * Global Sanitizer
 * Applies XSS protection to all user inputs in the application
 */

import { lazyLogger } from '../services/serviceFactory';

const logger = lazyLogger.getLogger('GlobalSanitizer');
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
export function sanitizeByFieldName(fieldName: string, value: string): string;
export function sanitizeByFieldName(fieldName: string, value: number): number;
export function sanitizeByFieldName(fieldName: string, value: Date): Date | null;
export function sanitizeByFieldName<T>(fieldName: string, value: T): T;
export function sanitizeByFieldName(fieldName: string, value: unknown): unknown {
  if (value == null) {
    return value;
  }

  const loweredField = fieldName.toLowerCase();
  const rule = SANITIZATION_RULES.find((candidate) =>
    candidate.fields.some((field) => loweredField.includes(field.toLowerCase())),
  );

  const defaultText = () => (typeof value === 'string' ? sanitizeText(value) : value);

  if (!rule) {
    return defaultText();
  }

  switch (rule.type) {
    case 'text':
      return defaultText();
    case 'html':
      return typeof value === 'string' ? sanitizeHTML(value) : value;
    case 'url':
      return typeof value === 'string' ? sanitizeURL(value) : value;
    case 'number':
      if (typeof value === 'number' || typeof value === 'string') {
        return sanitizeNumber(value);
      }
      return value;
    case 'date':
      if (typeof value === 'string' || value instanceof Date) {
        return sanitizeDate(value) ?? null;
      }
      return value;
    case 'filename':
      return typeof value === 'string' ? sanitizeFilename(value) : value;
    case 'query':
      return typeof value === 'string' ? sanitizeQuery(value) : value;
    default:
      return value;
  }
}

/**
 * Recursively sanitize an object
 */
export function sanitizeObject<T>(obj: T, depth: number = 0): T {
  // Prevent infinite recursion
  if (depth > 10) {
    logger.warn('Maximum sanitization depth reached');
    return obj;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    const sanitizedArray = obj.map((item, index) => {
      if (item === null || item === undefined) {
        return item;
      }
      if (typeof item === 'object' && !(item instanceof Date)) {
        return sanitizeObject(item, depth + 1);
      }
      return sanitizeByFieldName(index.toString(), item);
    }) as typeof obj;

    return sanitizedArray as T;
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
}

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
export const sanitizeRequestMiddleware = <T extends { data?: unknown }>(config: T): T => {
  if (config.data !== undefined) {
    config.data = sanitizeObject(config.data) as typeof config.data;
  }
  return config;
};

/**
 * Middleware function for API responses
 * Sanitizes response data before using
 */
export const sanitizeResponseMiddleware = <T extends { data?: unknown }>(response: T): T => {
  if (response.data !== undefined) {
    response.data = sanitizeObject(response.data) as typeof response.data;
  }
  return response;
};
