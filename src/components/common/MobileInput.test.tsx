/**
 * MobileInput and MobileSelect Components Tests
 * Comprehensive tests for mobile-optimized input components
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileInput, MobileSelect } from './MobileInput';
import React from 'react';

describe('MobileInput', () => {
  describe('basic rendering', () => {
    it('renders input element', () => {
      render(<MobileInput />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<MobileInput label="Email Address" />);
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    });

    it('renders required indicator with label', () => {
      render(<MobileInput label="Email" required />);
      const requiredIndicator = screen.getByText('*');
      expect(requiredIndicator).toBeInTheDocument();
      expect(requiredIndicator.className).toContain('text-red-500');
    });

    it('generates unique id when not provided', () => {
      const { rerender } = render(<MobileInput label="Input 1" />);
      const input1 = screen.getByLabelText('Input 1');
      const id1 = input1.id;
      
      rerender(<MobileInput label="Input 2" />);
      const input2 = screen.getByLabelText('Input 2');
      const id2 = input2.id;
      
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('uses provided id', () => {
      render(<MobileInput id="custom-id" label="Custom Input" />);
      const input = screen.getByLabelText('Custom Input');
      expect(input.id).toBe('custom-id');
    });
  });

  describe('hint and error states', () => {
    it('renders hint text when provided', () => {
      render(<MobileInput hint="Enter your email address" />);
      expect(screen.getByText('Enter your email address')).toBeInTheDocument();
    });

    it('renders error message when provided', () => {
      render(<MobileInput error="Email is required" />);
      const error = screen.getByRole('alert');
      expect(error).toHaveTextContent('Email is required');
      expect(error.className).toContain('text-red-500');
    });

    it('hides hint when error is present', () => {
      render(<MobileInput hint="Enter email" error="Invalid email" />);
      expect(screen.queryByText('Enter email')).not.toBeInTheDocument();
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });

    it('applies error border styles', () => {
      render(<MobileInput error="Invalid input" />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('border-red-500');
    });

    it('sets aria-invalid when error exists', () => {
      render(<MobileInput error="Invalid input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('sets aria-describedby for error', () => {
      render(<MobileInput error="Invalid input" />);
      const input = screen.getByRole('textbox');
      const errorId = input.getAttribute('aria-describedby');
      expect(errorId).toBeTruthy();
      const errorElement = document.getElementById(errorId!);
      expect(errorElement).toHaveTextContent('Invalid input');
    });

    it('sets aria-describedby for hint', () => {
      render(<MobileInput hint="Helpful hint" />);
      const input = screen.getByRole('textbox');
      const hintId = input.getAttribute('aria-describedby');
      expect(hintId).toBeTruthy();
    });
  });

  describe('icons and right elements', () => {
    it('renders left icon', () => {
      const icon = <span data-testid="left-icon">📧</span>;
      render(<MobileInput icon={icon} />);
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('applies padding when icon is present', () => {
      const icon = <span>📧</span>;
      render(<MobileInput icon={icon} />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('pl-10');
    });

    it('renders right element', () => {
      const rightElement = <button data-testid="clear-btn">Clear</button>;
      render(<MobileInput rightElement={rightElement} />);
      expect(screen.getByTestId('clear-btn')).toBeInTheDocument();
    });

    it('applies padding when right element is present', () => {
      const rightElement = <button>Clear</button>;
      render(<MobileInput rightElement={rightElement} />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('pr-10');
    });

    it('renders both icon and right element', () => {
      const icon = <span data-testid="icon">📧</span>;
      const rightElement = <button data-testid="button">Clear</button>;
      render(<MobileInput icon={icon} rightElement={rightElement} />);
      
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByTestId('button')).toBeInTheDocument();
      
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('pl-10');
      expect(input.className).toContain('pr-10');
    });
  });

  describe('styling and customization', () => {
    it('applies custom className', () => {
      render(<MobileInput className="custom-class" />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('custom-class');
    });

    it('has mobile-optimized padding', () => {
      render(<MobileInput />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('px-4');
      expect(input.className).toContain('py-3');
    });

    it('has proper focus styles', () => {
      render(<MobileInput />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('focus:outline-none');
      expect(input.className).toContain('focus:ring-2');
      expect(input.className).toContain('focus:ring-primary');
    });

    it('has disabled styles', () => {
      render(<MobileInput disabled />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('disabled:bg-gray-100');
      expect(input.className).toContain('disabled:text-gray-500');
    });

    it('supports dark mode styles', () => {
      render(<MobileInput />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('dark:bg-gray-700');
      expect(input.className).toContain('dark:border-gray-600');
      expect(input.className).toContain('dark:text-white');
    });
  });

  describe('forwardRef functionality', () => {
    it('forwards ref to input element', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<MobileInput ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('allows focus via ref', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<MobileInput ref={ref} />);
      
      ref.current?.focus();
      expect(document.activeElement).toBe(ref.current);
    });
  });

  describe('input props forwarding', () => {
    it('forwards all standard input props', () => {
      const handleChange = vi.fn();
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();
      
      render(
        <MobileInput
          type="email"
          placeholder="Enter email"
          value="test@example.com"
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          maxLength={50}
          autoComplete="email"
          data-testid="email-input"
        />
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
      expect(input).toHaveAttribute('placeholder', 'Enter email');
      expect(input).toHaveValue('test@example.com');
      expect(input).toHaveAttribute('maxLength', '50');
      expect(input).toHaveAttribute('autoComplete', 'email');
      expect(input).toHaveAttribute('data-testid', 'email-input');
    });

    it('handles input events', async () => {
      const handleChange = vi.fn();
      render(<MobileInput onChange={handleChange} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Hello');
      
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('associates label with input', () => {
      render(<MobileInput label="Username" />);
      const input = screen.getByLabelText('Username');
      expect(input).toBeInTheDocument();
    });

    it('has proper ARIA attributes for errors', () => {
      render(<MobileInput error="Invalid input" />);
      const input = screen.getByRole('textbox');
      const errorId = input.getAttribute('aria-describedby');
      
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(errorId).toBeTruthy();
      
      const error = screen.getByRole('alert');
      expect(error).toHaveAttribute('id', errorId);
    });

    it('supports screen readers with hints', () => {
      render(<MobileInput hint="Format: xxx-xxx-xxxx" />);
      const input = screen.getByRole('textbox');
      const hintId = input.getAttribute('aria-describedby');
      
      expect(hintId).toBeTruthy();
      expect(screen.getByText('Format: xxx-xxx-xxxx')).toBeInTheDocument();
    });
  });

  describe('real-world usage', () => {
    it('works as email input with validation', async () => {
      const { rerender } = render(
        <MobileInput
          type="email"
          label="Email"
          placeholder="your@email.com"
          required
          hint="We'll never share your email"
        />
      );
      
      // Find input by its type since label has complex structure
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByText("We'll never share your email")).toBeInTheDocument();
      
      // Simulate validation error
      rerender(
        <MobileInput
          type="email"
          label="Email"
          placeholder="your@email.com"
          required
          error="Please enter a valid email"
        />
      );
      
      expect(screen.queryByText("We'll never share your email")).not.toBeInTheDocument();
      expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();
    });

    it('works as password input with toggle', () => {
      const PasswordInput = () => {
        const [showPassword, setShowPassword] = React.useState(false);
        
        return (
          <MobileInput
            type={showPassword ? 'text' : 'password'}
            label="Password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                data-testid="toggle-password"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            }
          />
        );
      };
      
      render(<PasswordInput />);
      
      const input = screen.getByLabelText('Password');
      expect(input).toHaveAttribute('type', 'password');
      
      const toggle = screen.getByTestId('toggle-password');
      fireEvent.click(toggle);
      
      // After clicking, type should change to text
      expect(input).toHaveAttribute('type', 'text');
    });

    it('works as search input with icon', () => {
      const handleSearch = vi.fn();
      
      render(
        <MobileInput
          type="search"
          placeholder="Search..."
          icon={<span>🔍</span>}
          onChange={handleSearch}
          className="rounded-full"
        />
      );
      
      const input = screen.getByRole('searchbox');
      expect(input).toHaveAttribute('placeholder', 'Search...');
      expect(input.className).toContain('rounded-full');
      expect(input.className).toContain('pl-10');
    });
  });
});

describe('MobileSelect', () => {
  const mockOptions = [
    { value: 'us', label: 'United States' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'ca', label: 'Canada' },
  ];

  describe('basic rendering', () => {
    it('renders select element', () => {
      render(<MobileSelect options={mockOptions} />);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<MobileSelect label="Country" options={mockOptions} />);
      expect(screen.getByLabelText('Country')).toBeInTheDocument();
    });

    it('renders required indicator', () => {
      render(<MobileSelect label="Country" options={mockOptions} required />);
      const requiredIndicator = screen.getByText('*');
      expect(requiredIndicator).toBeInTheDocument();
      expect(requiredIndicator.className).toContain('text-red-500');
    });

    it('renders all options', () => {
      render(<MobileSelect options={mockOptions} />);
      
      mockOptions.forEach(option => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      });
    });

    it('renders default "Select an option" when not required', () => {
      render(<MobileSelect options={mockOptions} />);
      expect(screen.getByText('Select an option')).toBeInTheDocument();
    });

    it('does not render default option when required', () => {
      render(<MobileSelect options={mockOptions} required />);
      expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
    });

    it('generates unique id when not provided', () => {
      render(<MobileSelect label="Select 1" options={mockOptions} />);
      const select = screen.getByLabelText('Select 1');
      expect(select.id).toBeTruthy();
      expect(select.id).toContain('select-');
    });
  });

  describe('hint and error states', () => {
    it('renders hint text', () => {
      render(<MobileSelect options={mockOptions} hint="Choose your country" />);
      expect(screen.getByText('Choose your country')).toBeInTheDocument();
    });

    it('renders error message', () => {
      render(<MobileSelect options={mockOptions} error="Country is required" />);
      const error = screen.getByRole('alert');
      expect(error).toHaveTextContent('Country is required');
    });

    it('hides hint when error is present', () => {
      render(
        <MobileSelect 
          options={mockOptions} 
          hint="Choose country" 
          error="Invalid selection" 
        />
      );
      expect(screen.queryByText('Choose country')).not.toBeInTheDocument();
      expect(screen.getByText('Invalid selection')).toBeInTheDocument();
    });

    it('applies error border styles', () => {
      render(<MobileSelect options={mockOptions} error="Required" />);
      const select = screen.getByRole('combobox');
      expect(select.className).toContain('border-red-500');
    });

    it('sets proper ARIA attributes for errors', () => {
      render(<MobileSelect options={mockOptions} error="Required field" />);
      const select = screen.getByRole('combobox');
      
      expect(select).toHaveAttribute('aria-invalid', 'true');
      const errorId = select.getAttribute('aria-describedby');
      expect(errorId).toBeTruthy();
      
      const error = document.getElementById(errorId!);
      expect(error).toHaveTextContent('Required field');
    });
  });

  describe('styling and customization', () => {
    it('applies custom className', () => {
      render(<MobileSelect options={mockOptions} className="custom-select" />);
      const select = screen.getByRole('combobox');
      expect(select.className).toContain('custom-select');
    });

    it('has mobile-optimized styles', () => {
      render(<MobileSelect options={mockOptions} />);
      const select = screen.getByRole('combobox');
      
      expect(select.className).toContain('px-4');
      expect(select.className).toContain('py-3');
      expect(select.className).toContain('text-base');
      expect(select.className).toContain('appearance-none');
    });

    it('has custom dropdown arrow', () => {
      render(<MobileSelect options={mockOptions} />);
      const select = screen.getByRole('combobox');
      
      // Check for custom arrow styles
      expect(select.className).toContain('bg-[url');
      expect(select.className).toContain('bg-no-repeat');
      expect(select.className).toContain('pr-10');
    });

    it('supports dark mode', () => {
      render(<MobileSelect options={mockOptions} />);
      const select = screen.getByRole('combobox');
      
      expect(select.className).toContain('dark:bg-gray-700');
      expect(select.className).toContain('dark:text-white');
    });
  });

  describe('forwardRef functionality', () => {
    it('forwards ref to select element', () => {
      const ref = React.createRef<HTMLSelectElement>();
      render(<MobileSelect ref={ref} options={mockOptions} />);
      expect(ref.current).toBeInstanceOf(HTMLSelectElement);
    });

    it('allows programmatic value setting via ref', () => {
      const ref = React.createRef<HTMLSelectElement>();
      render(<MobileSelect ref={ref} options={mockOptions} />);
      
      if (ref.current) {
        ref.current.value = 'uk';
      }
      
      expect(ref.current?.value).toBe('uk');
    });
  });

  describe('select props forwarding', () => {
    it('forwards all standard select props', () => {
      const handleChange = vi.fn();
      
      render(
        <MobileSelect
          options={mockOptions}
          value="ca"
          onChange={handleChange}
          disabled={false}
          name="country"
          data-testid="country-select"
        />
      );
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('ca');
      expect(select).toHaveAttribute('name', 'country');
      expect(select).toHaveAttribute('data-testid', 'country-select');
    });

    it('handles change events', () => {
      const handleChange = vi.fn();
      render(<MobileSelect options={mockOptions} onChange={handleChange} />);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'uk' } });
      
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('properly associates label with select', () => {
      render(<MobileSelect label="Choose Country" options={mockOptions} />);
      const select = screen.getByLabelText('Choose Country');
      expect(select).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      render(<MobileSelect options={mockOptions} />);
      const select = screen.getByRole('combobox');
      
      select.focus();
      expect(document.activeElement).toBe(select);
    });

    it('has proper ARIA attributes', () => {
      render(
        <MobileSelect 
          options={mockOptions} 
          error="Required"
          hint="Select your country"
        />
      );
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-invalid', 'true');
      expect(select.getAttribute('aria-describedby')).toBeTruthy();
    });
  });

  describe('real-world usage', () => {
    it('works as country selector', () => {
      const countries = [
        { value: '', label: 'Select a country' },
        { value: 'us', label: 'United States' },
        { value: 'uk', label: 'United Kingdom' },
        { value: 'ca', label: 'Canada' },
        { value: 'au', label: 'Australia' },
      ];
      
      render(
        <MobileSelect
          label="Country"
          options={countries}
          required
          hint="Select your country of residence"
        />
      );
      
      // Verify label elements are present
      expect(screen.getByText('Country')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByText('Select your country of residence')).toBeInTheDocument();
      
      // All countries should be available
      countries.forEach(country => {
        if (country.label !== 'Select a country') {
          expect(screen.getByText(country.label)).toBeInTheDocument();
        }
      });
    });

    it('works as language selector with value', () => {
      const languages = [
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' },
      ];
      
      const { rerender } = render(
        <MobileSelect
          label="Language"
          options={languages}
          value="en"
        />
      );
      
      const select = screen.getByLabelText('Language');
      expect(select).toHaveValue('en');
      
      // Change language
      rerender(
        <MobileSelect
          label="Language"
          options={languages}
          value="es"
        />
      );
      
      expect(select).toHaveValue('es');
    });

    it('works in a form with validation', () => {
      const FormWithSelect = () => {
        const [value, setValue] = React.useState('');
        const [error, setError] = React.useState('');
        
        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (!value) {
            setError('Please select an option');
          } else {
            setError('');
          }
        };
        
        return (
          <form onSubmit={handleSubmit}>
            <MobileSelect
              label="Category"
              options={[
                { value: 'food', label: 'Food' },
                { value: 'transport', label: 'Transport' },
                { value: 'utilities', label: 'Utilities' },
              ]}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              error={error}
              required
            />
            <button type="submit">Submit</button>
          </form>
        );
      };
      
      render(<FormWithSelect />);
      
      const submitButton = screen.getByText('Submit');
      fireEvent.click(submitButton);
      
      // Should show error since no selection made
      expect(screen.getByText('Please select an option')).toBeInTheDocument();
    });
  });
});
