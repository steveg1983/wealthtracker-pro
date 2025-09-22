import { memo, useId, useEffect } from 'react';
import { FormFieldService } from '../../services/formFieldService';
import { useLogger } from '../services/ServiceProvider';

export interface RadioOption {
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

export const EnhancedRadioGroup = memo(function EnhancedRadioGroup({ label,
  name,
  value,
  onChange,
  options,
  error,
  hint,
  required
 }: EnhancedRadioGroupProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('EnhancedRadioGroup component initialized', {
      componentName: 'EnhancedRadioGroup'
    });
  }, []);

  const groupId = useId();
  const { errorId, hintId } = FormFieldService.generateFieldIds(groupId);

  const describedBy = FormFieldService.buildAriaDescribedBy([
    error && errorId,
    hint && hintId
  ]);

  return (
    <fieldset
      role="radiogroup"
      aria-labelledby={`${groupId}-label`}
      aria-describedby={describedBy}
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
                className={FormFieldService.getRadioClasses()}
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
});
