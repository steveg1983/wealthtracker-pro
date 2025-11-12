import React from 'react';
import { SkipLinks } from '../common/SkipLinks';

/**
 * Accessibility Improvements Components
 * Components to enhance accessibility across the application
 */

// Enhanced Skip Links with better styling
export function EnhancedSkipLinks() {
  return (
    <>
      <SkipLinks />
      <style dangerouslySetInnerHTML={{ __html: `
        :global(.skip-link) {
          position: absolute;
          left: -10000px;
          top: auto;
          width: 1px;
          height: 1px;
          overflow: hidden;
          background-color: #4b5563;
          color: white;
          padding: 0.75rem 1.5rem;
          text-decoration: none;
          font-weight: 500;
          border-radius: 0.375rem;
          z-index: 9999;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        :global(.skip-link:focus) {
          position: fixed;
          left: 1rem;
          top: 1rem;
          width: auto;
          height: auto;
          overflow: visible;
          outline: 2px solid #94a3b8;
          outline-offset: 2px;
          animation: slideIn 0.2s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(-20px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}} />
    </>
  );
}

// Screen reader only text component
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only absolute left-[-10000px] w-px h-px overflow-hidden">
      {children}
    </span>
  );
}

// Accessible loading spinner
export function AccessibleSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <ScreenReaderOnly>{label}</ScreenReaderOnly>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

// Focus visible indicator component
export function FocusIndicator() {
  React.useEffect(() => {
    // Add focus-visible class to body when using keyboard navigation
    const handleFirstTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        document.body.classList.add('user-is-tabbing');
      }
    };

    const handleMouseDown = () => {
      document.body.classList.remove('user-is-tabbing');
    };

    window.addEventListener('keydown', handleFirstTab);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleFirstTab);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      /* Enhanced focus styles for keyboard navigation */
      .user-is-tabbing *:focus-visible:not([data-suppress-focus-outline="true"]) {
        outline: 2px solid #94a3b8 !important;
        outline-offset: 2px !important;
      }

      /* Remove default focus for mouse users */
      *:focus:not(.focus-visible) {
        outline: none;
      }

      /* Ensure interactive elements have minimum size */
      button, a, input, select, textarea, [role="button"] {
        min-height: 44px;
        min-width: 44px;
      }

      /* Exception for inline links */
      p a, li a, span a {
        min-height: auto;
        min-width: auto;
      }
    `}} />
  );
}

// Announce route changes for screen readers
export function RouteAnnouncer() {
  const [routeAnnouncement, setRouteAnnouncement] = React.useState('');
  
  React.useEffect(() => {
    const announceRoute = () => {
      const pageTitle = document.title;
      setRouteAnnouncement(`Navigated to ${pageTitle}`);
    };

    // Listen for route changes
    window.addEventListener('popstate', announceRoute);
    
    return () => window.removeEventListener('popstate', announceRoute);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {routeAnnouncement}
    </div>
  );
}

// High contrast mode detector
// Accessible icon button component
interface AccessibleIconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function AccessibleIconButton({ 
  icon, 
  label, 
  onClick, 
  className = '',
  variant = 'secondary'
}: AccessibleIconButtonProps) {
  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`
        min-w-[44px] min-h-[44px] 
        flex items-center justify-center 
        rounded-lg transition-colors
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {icon}
    </button>
  );
}

// Accessible form field component
interface AccessibleFormFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  helpText?: string;
}

export function AccessibleFormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  error,
  helpText
}: AccessibleFormFieldProps) {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;

  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
      </label>
      
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={`${helpText ? helpId : ''} ${error ? errorId : ''}`.trim()}
        className={`
          w-full px-3 py-2 
          border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
          ${error 
            ? 'border-red-500 dark:border-red-400' 
            : 'border-gray-300 dark:border-gray-600'
          }
          bg-white dark:bg-gray-700 
          text-gray-900 dark:text-white
        `}
      />
      
      {helpText && (
        <p id={helpId} className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {helpText}
        </p>
      )}
      
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
