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
export const sanitizeObject = <T extends Record<string, any>>(obj: T, depth: number = 0): T => {
  // Prevent infinite recursion
  if (depth > 10) {
    console.warn('Maximum sanitization depth reached');
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (value == null) {
      sanitized[key] = value;
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = sanitizeByFieldName(key, value);
    }
  }

  return sanitized as T;
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
export const createSanitizedProxy = <T extends Record<string, any>>(target: T): T => {
  return new Proxy(target, {
    set(obj, prop: string, value) {
      obj[prop] = sanitizeByFieldName(prop, value);
      return true;
    },
    get(obj, prop: string) {
      const value = obj[prop];
      if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
        return createSanitizedProxy(value);
      }
      return value;
    }
  });
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