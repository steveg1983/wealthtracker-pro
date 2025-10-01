import React from 'react';

interface RadioCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function RadioCheckbox({ 
  checked, 
  onChange, 
  disabled = false,
  className = '',
  id
}: RadioCheckboxProps): React.JSX.Element {
  return (
    <div className={`relative ${className}`}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only"
      />
      <div 
        className={`
          w-5 h-5 rounded-full border-2 transition-colors cursor-pointer
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
          ${checked 
            ? 'border-gray-600 bg-gray-600 dark:border-gray-400 dark:bg-gray-400' 
            : 'border-gray-400 bg-white dark:bg-gray-800 dark:border-gray-600'
          }
        `}
        onClick={() => !disabled && onChange(!checked)}
      >
        {checked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}