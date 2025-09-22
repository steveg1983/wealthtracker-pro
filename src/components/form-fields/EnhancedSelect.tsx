import { forwardRef, memo } from 'react';
import { FormFieldWrapper } from './FormFieldWrapper';
import { FormFieldService } from '../../services/formFieldService';
import { useLogger } from '../services/ServiceProvider';

interface EnhancedSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const EnhancedSelect = memo(forwardRef<HTMLSelectElement, EnhancedSelectProps>(
  ({ label, error, success, hint, required, options, placeholder, className = '', ...props }, ref) => {
    return (
      <FormFieldWrapper
        label={label}
        error={error}
        success={success}
        hint={hint}
        required={required}
      >
        <select
          ref={ref}
          required={required}
          className={`${FormFieldService.getBaseSelectClasses(error)} ${className}`}
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
));

EnhancedSelect.displayName = 'EnhancedSelect';