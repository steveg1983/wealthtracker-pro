import React, { useId } from 'react';

interface AccessibleFormFieldProps {
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea';
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  autoComplete?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  rows?: number;
  className?: string;
}

export function AccessibleFormField({
  label,
  type = 'text',
  value,
  onChange,
  error,
  hint,
  required = false,
  disabled = false,
  placeholder,
  options = [],
  autoComplete,
  min,
  max,
  step,
  rows = 3,
  className = ''
}: AccessibleFormFieldProps): React.JSX.Element {
  // Generate unique IDs for accessibility
  const fieldId = useId();
  const errorId = useId();
  const hintId = useId();

  // Build aria-describedby based on what's present
  const ariaDescribedBy = [
    error ? errorId : null,
    hint ? hintId : null
  ].filter(Boolean).join(' ') || undefined;

  const baseInputClasses = `w-full px-3 py-2 bg-white dark:bg-gray-700 border-2 ${
    error ? 'border-red-500' : 'border-gray-300 dark:border-gray-500'
  } rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white`;

  const renderField = () => {
    switch (type) {
      case 'select':
        return (
          <select
            id={fieldId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            disabled={disabled}
            className={baseInputClasses}
            aria-describedby={ariaDescribedBy}
            aria-invalid={!!error}
            aria-required={required}
          >
            {!required && <option value="">Select an option</option>}
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            id={fieldId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            rows={rows}
            className={baseInputClasses}
            aria-describedby={ariaDescribedBy}
            aria-invalid={!!error}
            aria-required={required}
          />
        );

      default:
        return (
          <input
            id={fieldId}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete={autoComplete}
            min={min}
            max={max}
            step={step}
            className={baseInputClasses}
            aria-describedby={ariaDescribedBy}
            aria-invalid={!!error}
            aria-required={required}
          />
        );
    }
  };

  return (
    <div className={className}>
      <label 
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      
      {hint && (
        <p id={hintId} className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {hint}
        </p>
      )}
      
      {renderField()}
      
      {error && (
        <p 
          id={errorId} 
          className="mt-1 text-sm text-red-500" 
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}