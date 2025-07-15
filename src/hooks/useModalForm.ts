import { useState, useCallback, useEffect } from 'react';

interface UseModalFormOptions<T> {
  onSubmit: (data: T) => void | Promise<void>;
  onClose: () => void;
  resetOnClose?: boolean;
}

export function useModalForm<T>(
  initialState: T | (() => T),
  { onSubmit, onClose, resetOnClose = true }: UseModalFormOptions<T>
) {
  const [formData, setFormData] = useState<T>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal closes if resetOnClose is true
  useEffect(() => {
    if (resetOnClose) {
      return () => {
        setFormData(typeof initialState === 'function' ? initialState() : initialState);
        setErrors({});
        setIsSubmitting(false);
      };
    }
  }, [initialState, resetOnClose]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when it's updated
    if (errors[field as string]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
    }
  }, [errors]);

  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [field as string]: error }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    setIsSubmitting(true);
    clearErrors();

    try {
      await onSubmit(formData);
      
      // Reset form after successful submission
      if (resetOnClose) {
        setFormData(typeof initialState === 'function' ? initialState() : initialState);
      }
      
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, onClose, initialState, resetOnClose, clearErrors]);

  const reset = useCallback(() => {
    setFormData(typeof initialState === 'function' ? initialState() : initialState);
    setErrors({});
    setIsSubmitting(false);
  }, [initialState]);

  return {
    formData,
    setFormData,
    updateField,
    errors,
    setFieldError,
    clearErrors,
    isSubmitting,
    handleSubmit,
    reset
  };
}