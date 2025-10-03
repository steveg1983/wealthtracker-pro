import { memo, useId, cloneElement, useEffect } from 'react';
import { AlertCircleIcon, CheckCircleIcon, InfoIcon } from '../icons';
import { FormFieldService } from '../../services/formFieldService';
import { useLogger } from '../services/ServiceProvider';

interface FormFieldWrapperProps {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactElement;
}

export const FormFieldWrapper = memo(function FormFieldWrapper({ label,
  error,
  success,
  hint,
  required = false,
  children
 }: FormFieldWrapperProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('FormFieldWrapper component initialized', {
        label,
        hasError: Boolean(error),
        hasSuccess: Boolean(success),
        hasHint: Boolean(hint),
        required,
        componentName: 'FormFieldWrapper'
      });
    } catch (error) {
      logger.error('FormFieldWrapper initialization failed:', error, 'FormFieldWrapper');
    }
  }, [label, error, success, hint, required]);

  const fieldId = useId();
  const { errorId, hintId, successId } = FormFieldService.generateFieldIds(fieldId);

  const describedBy = (() => {
    try {
      return FormFieldService.buildAriaDescribedBy([
        error && errorId,
        hint && hintId,
        success && successId
      ]);
    } catch (error) {
      logger.error('Failed to build aria-describedby:', error, 'FormFieldWrapper');
      return '';
    }
  })();

  const field = (() => {
    try {
      const stateClasses = FormFieldService.getFieldStateClasses(error, success);
      return cloneElement(children, {
        id: fieldId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
        className: `${children.props.className || ''} ${stateClasses}`
      });
    } catch (error) {
      logger.error('Failed to clone field element:', error, 'FormFieldWrapper');
      // Return original children as fallback
      return children;
    }
  })();

  try {
    return (
      <div className="space-y-1">
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label || 'Field'}
          {required && (
            <span className="text-red-500 ml-1" aria-label="required">
              *
            </span>
          )}
        </label>

        {hint && !error && (
          <p id={hintId} className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-1">
            {(() => {
              try {
                return <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />;
              } catch (iconError) {
                logger.error('Failed to render info icon:', iconError, 'FormFieldWrapper');
                return null;
              }
            })()}
            <span>{hint}</span>
          </p>
        )}

        {field}

        {error && (
          <p
            id={errorId}
            className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1"
            role="alert"
            aria-live="polite"
          >
            {(() => {
              try {
                return <AlertCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />;
              } catch (iconError) {
                logger.error('Failed to render alert icon:', iconError, 'FormFieldWrapper');
                return null;
              }
            })()}
            <span>{error}</span>
          </p>
        )}

        {success && !error && (
          <p
            id={successId}
            className="text-sm text-green-600 dark:text-green-400 flex items-start gap-1"
            role="status"
            aria-live="polite"
          >
            {(() => {
              try {
                return <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />;
              } catch (iconError) {
                logger.error('Failed to render check icon:', iconError, 'FormFieldWrapper');
                return null;
              }
            })()}
            <span>{success}</span>
          </p>
        )}
      </div>
    );
  } catch (error) {
    logger.error('Failed to render FormFieldWrapper:', { error, label }, 'FormFieldWrapper');
    return (
      <div className="space-y-1">
        <div className="text-red-600 dark:text-red-400 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
          Error rendering form field: {label || 'Unknown field'}
        </div>
        {children}
      </div>
    );
  }
});
