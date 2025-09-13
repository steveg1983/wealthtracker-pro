import { forwardRef, useId, memo } from 'react';
import { FormFieldService } from '../../services/formFieldService';
import { logger } from '../../services/loggingService';

interface EnhancedCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  error?: string;
}

export const EnhancedCheckbox = memo(forwardRef<HTMLInputElement, EnhancedCheckboxProps>(
  ({ label, hint, error, className = '', ...props }, ref) => {
    const fieldId = useId();
    const { hintId, errorId } = FormFieldService.generateFieldIds(fieldId);

    const describedBy = FormFieldService.buildAriaDescribedBy([
      hint && hintId,
      error && errorId
    ]);

    return (
      <div className="space-y-1">
        <div className="flex items-start">
          <input
            ref={ref}
            id={fieldId}
            type="checkbox"
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={`${FormFieldService.getCheckboxClasses(error)} ${className}`}
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
));

EnhancedCheckbox.displayName = 'EnhancedCheckbox';