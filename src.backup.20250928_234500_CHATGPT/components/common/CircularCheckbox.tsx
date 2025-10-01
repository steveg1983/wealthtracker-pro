import React from 'react';

interface CircularCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export default function CircularCheckbox({
  checked,
  onChange,
  disabled = false,
  className = ''
}: CircularCheckboxProps): React.JSX.Element {
  return (
    <div className={`relative ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only"
      />
      <div 
        className={`w-5 h-5 rounded-full border-2 transition-colors cursor-pointer ${
          checked
            ? 'border-gray-600 dark:border-gray-400'
            : 'border-gray-300 dark:border-gray-600'
        } ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onClick={() => !disabled && onChange(!checked)}
      >
        {checked && (
          <div className="w-3 h-3 rounded-full bg-gray-600 dark:bg-gray-400 m-0.5" />
        )}
      </div>
    </div>
  );
}