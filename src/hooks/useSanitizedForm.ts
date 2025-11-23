/**
 * Custom hook for sanitizing form data
 * Integrates with react-hook-form or can be used standalone
 */

import { useState, useCallback } from 'react';
import { 
  sanitizeText, 
  sanitizeHTML, 
  sanitizeURL, 
  sanitizeQuery,
  sanitizeNumber,
  sanitizeDecimal,
  sanitizeDate,
  sanitizeFilename,
  sanitizeJSON
} from '../security/xss-protection';
import { useMemoizedLogger } from '../loggers/useMemoizedLogger';

type SanitizeType = 'text' | 'html' | 'url' | 'query' | 'number' | 'decimal' | 'date' | 'filename' | 'json';

interface FieldConfig {
  type: SanitizeType;
  required?: boolean;
  decimals?: number;
}

interface SanitizedFormConfig {
  [fieldName: string]: FieldConfig | SanitizeType;
}

export const useSanitizedForm = <T extends Record<string, unknown>>(
  initialValues: T,
  config: SanitizedFormConfig
) => {
  const logger = useMemoizedLogger('useSanitizedForm');
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const sanitizeField = useCallback((
    fieldName: string,
    value: unknown,
    fieldConfig: FieldConfig | SanitizeType
  ): unknown => {
    const config = typeof fieldConfig === 'string' 
      ? { type: fieldConfig } 
      : fieldConfig;

    // Check required fields
    if (config.required && !value) {
      setErrors(prev => ({ ...prev, [fieldName]: 'This field is required' }));
      return value;
    }

    // Clear error for this field
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName as keyof T];
      return newErrors;
    });

    switch (config.type) {
      case 'text':
        return sanitizeText(value);
      
      case 'html':
        return sanitizeHTML(value);
      
      case 'url': {
        const sanitizedUrl = sanitizeURL(value);
        if (value && !sanitizedUrl) {
          setErrors(prev => ({ ...prev, [fieldName]: 'Invalid URL' }));
        }
        return sanitizedUrl;
      }
      
      case 'query':
        return sanitizeQuery(value);
      
      case 'number': {
        const num = sanitizeNumber(value);
        if (value && num === 0 && value !== '0' && value !== 0) {
          setErrors(prev => ({ ...prev, [fieldName]: 'Invalid number' }));
        }
        return num;
      }
      
      case 'decimal':
        return sanitizeDecimal(value, config.decimals);
      
      case 'date': {
        const date = sanitizeDate(value);
        if (value && !date) {
          setErrors(prev => ({ ...prev, [fieldName]: 'Invalid date' }));
        }
        return date;
      }
      
      case 'filename':
        return sanitizeFilename(value);
      
      case 'json':
        try {
          return sanitizeJSON(value);
        } catch {
          setErrors(prev => ({ ...prev, [fieldName]: 'Invalid JSON' }));
          return '{}';
        }
      
      default:
        return sanitizeText(value);
    }
  }, []);

  const handleChange = useCallback((fieldName: keyof T) => {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | unknown) => {
      const value = (e as { target?: { value?: unknown } })?.target?.value ?? e;
      const fieldConfig = config[fieldName as string];
      
      if (!fieldConfig) {
        logger.warn?.('No sanitization config for field', { fieldName: String(fieldName) });
        setValues(prev => ({ ...prev, [fieldName]: value }));
        return;
      }

      const sanitized = sanitizeField(String(fieldName), value, fieldConfig);
      setValues(prev => ({ ...prev, [fieldName]: sanitized }));
    };
  }, [config, sanitizeField, logger]);

  const handleSubmit = useCallback((onSubmit: (data: T) => void) => {
    return (e?: React.FormEvent) => {
      e?.preventDefault();

      // Sanitize all values before submission
      const sanitizedValues: Record<string, unknown> = {};
      let hasErrors = false;

      for (const [fieldName, value] of Object.entries(values)) {
        const fieldConfig = config[fieldName];
        if (fieldConfig) {
          sanitizedValues[fieldName] = sanitizeField(fieldName, value, fieldConfig);
          
          // Check if field has error
          if (errors[fieldName as keyof T]) {
            hasErrors = true;
          }
        } else {
          sanitizedValues[fieldName] = value;
        }
      }

      if (!hasErrors) {
        onSubmit(sanitizedValues as T);
      }
    };
  }, [values, config, sanitizeField, errors]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  const setValue = useCallback((fieldName: keyof T, value: unknown) => {
    const fieldConfig = config[fieldName as string];
    
    if (!fieldConfig) {
      setValues(prev => ({ ...prev, [fieldName]: value }));
      return;
    }

    const sanitized = sanitizeField(String(fieldName), value, fieldConfig);
    setValues(prev => ({ ...prev, [fieldName]: sanitized }));
  }, [config, sanitizeField]);

  return {
    values,
    errors,
    handleChange,
    handleSubmit,
    reset,
    setValue,
    isValid: Object.keys(errors).length === 0
  };
};
