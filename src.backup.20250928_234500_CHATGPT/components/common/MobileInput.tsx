import React, { forwardRef } from 'react';

interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const MobileInput = forwardRef<HTMLInputElement, MobileInputProps>(
  ({ label, error, hint, icon, rightElement, className = '', ...props }, ref) => {
    const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="space-y-1">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        {hint && !error && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>
        )}
        
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
              {icon}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full 
              px-4 py-3 
              ${icon ? 'pl-10' : ''} 
              ${rightElement ? 'pr-10' : ''}
              text-base
              bg-white dark:bg-gray-700 
              border-2 ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
              rounded-lg 
              focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent
              disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400
              placeholder-gray-400 dark:placeholder-gray-500
              dark:text-white
              transition-colors
              ${className}
            `}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
          
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {rightElement}
            </div>
          )}
        </div>
        
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

MobileInput.displayName = 'MobileInput';

// Mobile-optimized select component
interface MobileSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}

export const MobileSelect = forwardRef<HTMLSelectElement, MobileSelectProps>(
  ({ label, error, hint, options, className = '', ...props }, ref) => {
    const selectId = props.id || `select-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="space-y-1">
        {label && (
          <label 
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        {hint && !error && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>
        )}
        
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full 
            px-4 py-3 
            text-base
            bg-white dark:bg-gray-700 
            border-2 ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
            rounded-lg 
            focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent
            disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400
            dark:text-white
            appearance-none
            bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2714%27%20height%3D%278%27%20viewBox%3D%270%200%2014%208%27%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%3E%3Cpath%20d%3D%27M1%201l6%206%206-6%27%20stroke%3D%27%236B7280%27%20stroke-width%3D%272%27%20fill%3D%27none%27%20fill-rule%3D%27evenodd%27%2F%3E%3C%2Fsvg%3E')] 
            bg-[position:right_1rem_center] 
            bg-[size:12px] 
            bg-no-repeat
            pr-10
            ${className}
          `}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          {...props}
        >
          {!props.required && <option value="">Select an option</option>}
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        {error && (
          <p id={`${selectId}-error`} className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

MobileSelect.displayName = 'MobileSelect';