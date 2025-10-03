import { useState, useCallback, useMemo } from 'react';
import { sanitizeText, sanitizeNumber } from '../security/xss-protection';
import { useLogger } from '../services/ServiceProvider';

/**
 * Enterprise-grade form validation hook
 * Eliminates duplicate validation logic across components
 * Microsoft/Apple/Google standard - centralized validation with type safety
 */

export type ValidationRule<T> = {
  validate: (value: T) => boolean;
  message: string;
};

export type ValidationRules<T> = {
  [K in keyof T]?: ValidationRule<T[K]>[];
};

export type ValidationErrors<T> = {
  [K in keyof T]?: string;
};

export type TouchedFields<T> = {
  [K in keyof T]?: boolean;
};

interface UseFormValidationOptions<T> {
  initialValues: T;
  validationRules?: ValidationRules<T>;
  onSubmit?: (values: T) => void | Promise<void>;
  sanitize?: boolean;
}

export function useFormValidation<T extends Record<string, any>>({ initialValues,
  validationRules = {},
  onSubmit,
  sanitize = true
}: UseFormValidationOptions<T>) {
  const logger = useLogger();
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors<T>>({});
  const [touched, setTouched] = useState<TouchedFields<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  /**
   * Validate a single field
   */
  const validateField = useCallback((fieldName: keyof T, value: any): string | undefined => {
    const rules = validationRules[fieldName];
    if (!rules || rules.length === 0) return undefined;

    for (const rule of rules) {
      if (!rule.validate(value)) {
        return rule.message;
      }
    }

    return undefined;
  }, [validationRules]);

  /**
   * Validate all fields
   */
  const validateAllFields = useCallback((): ValidationErrors<T> => {
    const newErrors: ValidationErrors<T> = {};
    
    (Object.keys(values) as Array<keyof T>).forEach(fieldName => {
      const error = validateField(fieldName, values[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    return newErrors;
  }, [values, validateField]);

  /**
   * Handle field change with validation and sanitization
   */
  const handleChange = useCallback(<K extends keyof T>(fieldName: K) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | T[K]
  ) => {
    let value: any;
    
    // Handle both event and direct value
    if (event && typeof event === 'object' && 'target' in event) {
      value = event.target.value;
    } else {
      value = event;
    }

    // Sanitize input if enabled
    if (sanitize) {
      if (typeof value === 'string') {
        value = sanitizeText(value) as T[K];
      } else if (typeof value === 'number') {
        value = sanitizeNumber(value) as T[K];
      }
    }

    // Update value
    setValues(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Validate on change if field was touched
    if (touched[fieldName]) {
      const error = validateField(fieldName, value);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error
      }));
    }
  }, [touched, validateField, sanitize]);

  /**
   * Handle field blur - mark as touched and validate
   */
  const handleBlur = useCallback(<K extends keyof T>(fieldName: K) => () => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));

    const error = validateField(fieldName, values[fieldName]);
    setErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
  }, [values, validateField]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    setSubmitCount(prev => prev + 1);
    
    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce((acc, key) => ({
      ...acc,
      [key]: true
    }), {} as TouchedFields<T>);
    setTouched(allTouched);

    // Validate all fields
    const validationErrors = validateAllFields();
    setErrors(validationErrors);

    // Check if form is valid
    const isValid = Object.keys(validationErrors).length === 0;
    
    if (!isValid) {
      logger.warn('Form validation failed', validationErrors);
      return;
    }

    // Submit form
    if (onSubmit) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (error) {
        logger.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [values, validateAllFields, onSubmit]);

  /**
   * Reset form to initial state
   */
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setSubmitCount(0);
    setIsSubmitting(false);
  }, [initialValues]);

  /**
   * Set field value programmatically
   */
  const setFieldValue = useCallback(<K extends keyof T>(fieldName: K, value: T[K]) => {
    setValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Validate if touched
    if (touched[fieldName]) {
      const error = validateField(fieldName, value);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error
      }));
    }
  }, [touched, validateField]);

  /**
   * Set field error programmatically
   */
  const setFieldError = useCallback(<K extends keyof T>(fieldName: K, error: string) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
  }, []);

  /**
   * Check if form is valid
   */
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0 && Object.keys(touched).length > 0;
  }, [errors, touched]);

  /**
   * Check if form is dirty (values changed from initial)
   */
  const isDirty = useMemo(() => {
    return Object.keys(values).some(key => 
      values[key as keyof T] !== initialValues[key as keyof T]
    );
  }, [values, initialValues]);

  /**
   * Get field props for input binding
   */
  const getFieldProps = useCallback(<K extends keyof T>(fieldName: K) => ({
    name: fieldName as string,
    value: values[fieldName],
    onChange: handleChange(fieldName),
    onBlur: handleBlur(fieldName),
    'aria-invalid': !!errors[fieldName],
    'aria-describedby': errors[fieldName] ? `${String(fieldName)}-error` : undefined
  }), [values, errors, handleChange, handleBlur]);

  /**
   * Get error props for error display
   */
  const getErrorProps = useCallback(<K extends keyof T>(fieldName: K) => ({
    id: `${String(fieldName)}-error`,
    role: 'alert',
    'aria-live': 'polite' as const
  }), []);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    submitCount,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldValue,
    setFieldError,
    getFieldProps,
    getErrorProps,
    validateField,
    validateAllFields
  };
}

// Common validation rules
export const validationRules = {
  required: (message = 'This field is required'): ValidationRule<any> => ({
    validate: (value) => value != null && value !== '',
    message
  }),
  
  minLength: (min: number, message?: string): ValidationRule<string> => ({
    validate: (value) => value.length >= min,
    message: message || `Must be at least ${min} characters`
  }),
  
  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    validate: (value) => value.length <= max,
    message: message || `Must be no more than ${max} characters`
  }),
  
  email: (message = 'Invalid email address'): ValidationRule<string> => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message
  }),
  
  number: (message = 'Must be a number'): ValidationRule<any> => ({
    validate: (value) => !isNaN(Number(value)),
    message
  }),
  
  min: (min: number, message?: string): ValidationRule<number> => ({
    validate: (value) => value >= min,
    message: message || `Must be at least ${min}`
  }),
  
  max: (max: number, message?: string): ValidationRule<number> => ({
    validate: (value) => value <= max,
    message: message || `Must be no more than ${max}`
  }),
  
  pattern: (regex: RegExp, message = 'Invalid format'): ValidationRule<string> => ({
    validate: (value) => regex.test(value),
    message
  }),
  
  url: (message = 'Invalid URL'): ValidationRule<string> => ({
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message
  }),
  
  date: (message = 'Invalid date'): ValidationRule<string> => ({
    validate: (value) => !isNaN(Date.parse(value)),
    message
  })
};