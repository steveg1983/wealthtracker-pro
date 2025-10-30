/**
 * Enhanced Accessible Form Field Components
 * Modular form components with proper accessibility
 */

import React, { forwardRef, useId } from 'react';
import { AlertCircleIcon, CheckCircleIcon, InfoIcon } from '../icons';

interface FormFieldWrapperProps {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactElement;
}

export const FormFieldWrapper: React.FC<FormFieldWrapperProps> = ({
  label,
  error,
  success,
  hint,
  required = false,
  children
}) => {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const successId = `${fieldId}-success`;

  // Build aria-describedby
  const describedBy = [
    error && errorId,
    hint && hintId,
    success && successId
  ].filter(Boolean).join(' ');

  // Clone child element and add accessibility props
  const field = React.cloneElement(children, {
    id: fieldId,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
    className: `${children.props.className || ''} ${
      error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
    }`
  });

  return (
    <div className="space-y-1">
      {/* Label */}
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      {/* Hint text */}
      {hint && !error && (
        <p id={hintId} className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-1">
          <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{hint}</span>
        </p>
      )}

      {/* Field */}
      {field}

      {/* Error message */}
      {error && (
        <p
          id={errorId}
          className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1"
          role="alert"
          aria-live="polite"
        >
          <AlertCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {/* Success message */}
      {success && !error && (
        <p
          id={successId}
          className="text-sm text-green-600 dark:text-green-400 flex items-start gap-1"
          role="status"
          aria-live="polite"
        >
          <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </p>
      )}
    </div>
  );
};

// Enhanced Input Component
interface EnhancedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const EnhancedInput = forwardRef<HTMLInputElement, EnhancedInputProps>(
  ({ label, error, success, hint, required, leftIcon, rightIcon, className = '', ...props }, ref) => {
    return (
      <FormFieldWrapper
        label={label}
        {...(error ? { error } : {})}
        {...(success ? { success } : {})}
        {...(hint ? { hint } : {})}
        {...(required ? { required } : {})}
      >
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            required={required}
            className={`
              block w-full rounded-lg border-gray-300 dark:border-gray-600
              dark:bg-gray-700 dark:text-white
              shadow-sm transition-colors
              focus:border-gray-500 focus:ring-gray-500
              disabled:bg-gray-100 dark:disabled:bg-gray-800
              disabled:cursor-not-allowed
              ${leftIcon ? 'pl-10' : 'pl-3'}
              ${rightIcon ? 'pr-10' : 'pr-3'}
              py-2
              ${className}
            `}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
      </FormFieldWrapper>
    );
  }
);

EnhancedInput.displayName = 'EnhancedInput';

// Enhanced Select Component
interface EnhancedSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const EnhancedSelect = forwardRef<HTMLSelectElement, EnhancedSelectProps>(
  ({ label, error, success, hint, required, options, placeholder, className = '', ...props }, ref) => {
    return (
      <FormFieldWrapper
        label={label}
        {...(error ? { error } : {})}
        {...(success ? { success } : {})}
        {...(hint ? { hint } : {})}
        {...(required ? { required } : {})}
      >
        <select
          ref={ref}
          required={required}
          className={`
            block w-full rounded-lg border-gray-300 dark:border-gray-600
            dark:bg-gray-700 dark:text-white
            shadow-sm transition-colors
            focus:border-gray-500 focus:ring-gray-500
            disabled:bg-gray-100 dark:disabled:bg-gray-800
            disabled:cursor-not-allowed
            px-3 py-2
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(option => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldWrapper>
    );
  }
);

EnhancedSelect.displayName = 'EnhancedSelect';

// Enhanced Textarea Component
interface EnhancedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
}

export const EnhancedTextarea = forwardRef<HTMLTextAreaElement, EnhancedTextareaProps>(
  ({ label, error, success, hint, required, className = '', ...props }, ref) => {
    return (
      <FormFieldWrapper
        label={label}
        {...(error ? { error } : {})}
        {...(success ? { success } : {})}
        {...(hint ? { hint } : {})}
        {...(required ? { required } : {})}
      >
        <textarea
          ref={ref}
          required={required}
          className={`
            block w-full rounded-lg border-gray-300 dark:border-gray-600
            dark:bg-gray-700 dark:text-white
            shadow-sm transition-colors
            focus:border-gray-500 focus:ring-gray-500
            disabled:bg-gray-100 dark:disabled:bg-gray-800
            disabled:cursor-not-allowed
            px-3 py-2
            ${className}
          `}
          {...props}
        />
      </FormFieldWrapper>
    );
  }
);

EnhancedTextarea.displayName = 'EnhancedTextarea';

// Enhanced Checkbox Component
interface EnhancedCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  error?: string;
}

export const EnhancedCheckbox = forwardRef<HTMLInputElement, EnhancedCheckboxProps>(
  ({ label, hint, error, className = '', ...props }, ref) => {
    const fieldId = useId();
    const hintId = `${fieldId}-hint`;
    const errorId = `${fieldId}-error`;

    const describedBy = [
      hint && hintId,
      error && errorId
    ].filter(Boolean).join(' ');

    return (
      <div className="space-y-1">
        <div className="flex items-start">
          <input
            ref={ref}
            id={fieldId}
            type="checkbox"
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
            className={`
              h-4 w-4 mt-0.5
              text-gray-600 
              border-gray-300 dark:border-gray-600
              rounded
              focus:ring-gray-500
              disabled:opacity-50 disabled:cursor-not-allowed
              ${className}
            `}
            {...props}
          />
          <label
            htmlFor={fieldId}
            className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        </div>
        {hint && (
          <p id={hintId} className="ml-6 text-sm text-gray-500 dark:text-gray-400">
            {hint}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            className="ml-6 text-sm text-red-600 dark:text-red-400"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

EnhancedCheckbox.displayName = 'EnhancedCheckbox';

// Radio Group Component
interface RadioOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface EnhancedRadioGroupProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  error?: string;
  hint?: string;
  required?: boolean;
}

export const EnhancedRadioGroup: React.FC<EnhancedRadioGroupProps> = ({
  label,
  name,
  value,
  onChange,
  options,
  error,
  hint,
  required
}) => {
  const groupId = useId();
  const errorId = `${groupId}-error`;
  const hintId = `${groupId}-hint`;

  const describedBy = [
    error && errorId,
    hint && hintId
  ].filter(Boolean).join(' ');

  return (
    <fieldset
      role="radiogroup"
      aria-labelledby={`${groupId}-label`}
      aria-describedby={describedBy || undefined}
      aria-required={required}
      aria-invalid={error ? true : undefined}
    >
      <legend id={`${groupId}-label`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </legend>

      {hint && (
        <p id={hintId} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}

      <div className="mt-2 space-y-2">
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`;
          const optionHintId = `${optionId}-hint`;

          return (
            <div key={option.value} className="flex items-start">
              <input
                id={optionId}
                name={name}
                type="radio"
                value={option.value}
                checked={value === option.value}
                onChange={(e) => onChange(e.target.value)}
                disabled={option.disabled}
                aria-describedby={option.hint ? optionHintId : undefined}
                className="h-4 w-4 mt-0.5 text-gray-600 border-gray-300 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="ml-2">
                <label
                  htmlFor={optionId}
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  {option.label}
                </label>
                {option.hint && (
                  <p id={optionHintId} className="text-sm text-gray-500 dark:text-gray-400">
                    {option.hint}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p
          id={errorId}
          className="mt-2 text-sm text-red-600 dark:text-red-400"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
};