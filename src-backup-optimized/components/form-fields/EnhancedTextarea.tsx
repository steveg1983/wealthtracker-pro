import { forwardRef, memo } from 'react';
import { FormFieldWrapper } from './FormFieldWrapper';
import { FormFieldService } from '../../services/formFieldService';
import { useLogger } from '../services/ServiceProvider';

interface EnhancedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
}

export const EnhancedTextarea = memo(forwardRef<HTMLTextAreaElement, EnhancedTextareaProps>(
  ({ label, error, success, hint, required, className = '', ...props }, ref) => {
    return (
      <FormFieldWrapper
        label={label}
        error={error}
        success={success}
        hint={hint}
        required={required}
      >
        <textarea
          ref={ref}
          required={required}
          className={`${FormFieldService.getBaseTextareaClasses(error)} ${className}`}
          {...props}
        />
      </FormFieldWrapper>
    );
  }
));

EnhancedTextarea.displayName = 'EnhancedTextarea';