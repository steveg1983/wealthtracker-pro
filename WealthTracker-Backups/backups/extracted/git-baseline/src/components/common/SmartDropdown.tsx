import React, { useRef, useEffect, useState } from 'react';

interface SmartDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
}

export default function SmartDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  className = '',
  disabled = false,
  error = false,
  required = false,
  id,
  name
}: SmartDropdownProps): React.JSX.Element {
  const selectRef = useRef<HTMLSelectElement>(null);
  const [dropUpClass, setDropUpClass] = useState('');

  useEffect(() => {
    const checkPosition = () => {
      if (!selectRef.current) return;

      const rect = selectRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // If less than 200px below but more than 200px above, drop up
      if (spaceBelow < 200 && spaceAbove > 200) {
        setDropUpClass('drop-up');
      } else {
        setDropUpClass('');
      }
    };

    // Check position on mount and when dropdown is focused
    checkPosition();
    
    const handleFocus = () => checkPosition();
    const handleScroll = () => checkPosition();
    
    const element = selectRef.current;
    if (element) {
      element.addEventListener('focus', handleFocus);
      element.addEventListener('click', handleFocus);
      window.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', checkPosition);
    }

    return () => {
      if (element) {
        element.removeEventListener('focus', handleFocus);
        element.removeEventListener('click', handleFocus);
      }
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', checkPosition);
    };
  }, [options]);

  // Add custom CSS for drop-up behavior
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .smart-dropdown-container {
        position: relative;
      }
      
      .smart-dropdown.drop-up {
        /* This will be handled by the browser's native select positioning */
      }
      
      /* For custom dropdown implementations */
      .smart-dropdown-menu {
        position: absolute;
        z-index: 1000;
        width: 100%;
        max-height: 200px;
        overflow-y: auto;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      }
      
      .smart-dropdown-menu.drop-up {
        bottom: 100%;
        margin-bottom: 0.25rem;
      }
      
      .smart-dropdown-menu:not(.drop-up) {
        top: 100%;
        margin-top: 0.25rem;
      }
      
      @media (prefers-color-scheme: dark) {
        .smart-dropdown-menu {
          background: #1f2937;
          border-color: #374151;
        }
      }
      
      /* Extend page height when dropdown is at bottom */
      .dropdown-spacer {
        height: 200px;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Add spacer at bottom of page when dropdown is near bottom
  useEffect(() => {
    const checkNeedsSpacer = () => {
      if (!selectRef.current) return;
      
      const rect = selectRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      
      // Remove any existing spacers
      const existingSpacers = document.querySelectorAll('.dropdown-spacer');
      existingSpacers.forEach(spacer => spacer.remove());
      
      // Add spacer if dropdown is near bottom and focused
      if (spaceBelow < 200 && document.activeElement === selectRef.current) {
        const spacer = document.createElement('div');
        spacer.className = 'dropdown-spacer';
        document.body.appendChild(spacer);
        
        // Scroll the spacer into view
        setTimeout(() => {
          spacer.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
      }
    };

    const element = selectRef.current;
    if (element) {
      element.addEventListener('focus', checkNeedsSpacer);
      element.addEventListener('blur', () => {
        // Clean up spacer on blur
        const spacers = document.querySelectorAll('.dropdown-spacer');
        spacers.forEach(spacer => spacer.remove());
      });
    }

    return () => {
      // Clean up any remaining spacers
      const spacers = document.querySelectorAll('.dropdown-spacer');
      spacers.forEach(spacer => spacer.remove());
    };
  }, []);

  return (
    <div className="smart-dropdown-container">
      <select
        ref={selectRef}
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className={`smart-dropdown ${dropUpClass} w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}