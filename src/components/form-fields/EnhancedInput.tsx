import { forwardRef, memo } from 'react';
import { FormFieldWrapper } from './FormFieldWrapper';
import { FormFieldService } from '../../services/formFieldService';
import { logger } from '../../services/loggingService';

interface EnhancedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const EnhancedInput = memo(forwardRef<HTMLInputElement, EnhancedInputProps>(
  ({ label, error, success, hint, required, leftIcon, rightIcon, className = '', ...props }, ref) => {
    return (
      <FormFieldWrapper
        label={label}
        error={error}
        success={success}
        hint={hint}
        required={required}
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
            className={`${FormFieldService.getBaseInputClasses(!!leftIcon, !!rightIcon, error)} ${className}`}
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
));

EnhancedInput.displayName = 'EnhancedInput';