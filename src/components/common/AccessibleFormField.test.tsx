import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccessibleFormField } from './AccessibleFormField';

describe('AccessibleFormField', () => {
  const defaultProps = {
    label: 'Test Field',
    value: '',
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders with minimal props', () => {
      render(<AccessibleFormField {...defaultProps} />);
      
      expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders label correctly', () => {
      render(<AccessibleFormField {...defaultProps} />);
      
      const label = screen.getByText('Test Field');
      expect(label).toBeInTheDocument();
      expect(label).toHaveClass('text-sm', 'font-medium');
    });

    it('applies custom className', () => {
      const { container } = render(
        <AccessibleFormField {...defaultProps} className="custom-field" />
      );
      
      expect(container.firstChild).toHaveClass('custom-field');
    });
  });

  describe('Required field', () => {
    it('shows required indicator', () => {
      render(<AccessibleFormField {...defaultProps} required />);
      
      const asterisk = screen.getByLabelText('required');
      expect(asterisk).toBeInTheDocument();
      expect(asterisk).toHaveTextContent('*');
      expect(asterisk).toHaveClass('text-red-500');
    });

    it('sets aria-required on input', () => {
      render(<AccessibleFormField {...defaultProps} required />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('required');
    });
  });

  describe('Disabled state', () => {
    it('disables the input', () => {
      render(<AccessibleFormField {...defaultProps} disabled />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Hint text', () => {
    it('displays hint text', () => {
      render(<AccessibleFormField {...defaultProps} hint="This is a helpful hint" />);
      
      const hint = screen.getByText('This is a helpful hint');
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveClass('text-sm', 'text-gray-500');
    });

    it('associates hint with input via aria-describedby', () => {
      render(<AccessibleFormField {...defaultProps} hint="This is a helpful hint" />);
      
      const input = screen.getByRole('textbox');
      const hint = screen.getByText('This is a helpful hint');
      expect(input).toHaveAttribute('aria-describedby', hint.id);
    });
  });

  describe('Error handling', () => {
    it('displays error message', () => {
      render(<AccessibleFormField {...defaultProps} error="This field is required" />);
      
      const error = screen.getByRole('alert');
      expect(error).toBeInTheDocument();
      expect(error).toHaveTextContent('This field is required');
      expect(error).toHaveClass('text-red-500');
    });

    it('sets aria-invalid on input', () => {
      render(<AccessibleFormField {...defaultProps} error="This field is required" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('associates error with input via aria-describedby', () => {
      render(<AccessibleFormField {...defaultProps} error="This field is required" />);
      
      const input = screen.getByRole('textbox');
      const error = screen.getByRole('alert');
      expect(input).toHaveAttribute('aria-describedby', error.id);
    });

    it('applies error styling to input', () => {
      render(<AccessibleFormField {...defaultProps} error="This field is required" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-500');
    });

    it('combines hint and error in aria-describedby', () => {
      render(
        <AccessibleFormField 
          {...defaultProps} 
          hint="Helpful hint"
          error="Error message" 
        />
      );
      
      const input = screen.getByRole('textbox');
      const hint = screen.getByText('Helpful hint');
      const error = screen.getByRole('alert');
      const describedBy = input.getAttribute('aria-describedby');
      
      expect(describedBy).toContain(hint.id);
      expect(describedBy).toContain(error.id);
    });
  });

  describe('Input types', () => {
    it('renders text input by default', () => {
      render(<AccessibleFormField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('renders email input', () => {
      render(<AccessibleFormField {...defaultProps} type="email" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('renders password input', () => {
      render(<AccessibleFormField {...defaultProps} type="password" />);
      
      const input = screen.getByLabelText('Test Field');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('renders number input', () => {
      render(<AccessibleFormField {...defaultProps} type="number" value={0} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('renders date input', () => {
      render(<AccessibleFormField {...defaultProps} type="date" />);
      
      const input = screen.getByLabelText('Test Field');
      expect(input).toHaveAttribute('type', 'date');
    });
  });

  describe('Select field', () => {
    const selectOptions = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
      { value: 'option3', label: 'Option 3' },
    ];

    it('renders select element', () => {
      render(
        <AccessibleFormField 
          {...defaultProps} 
          type="select" 
          options={selectOptions}
        />
      );
      
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('renders default option when not required', () => {
      render(
        <AccessibleFormField 
          {...defaultProps} 
          type="select" 
          options={selectOptions}
        />
      );
      
      expect(screen.getByText('Select an option')).toBeInTheDocument();
    });

    it('does not render default option when required', () => {
      render(
        <AccessibleFormField 
          {...defaultProps} 
          type="select" 
          options={selectOptions}
          required
        />
      );
      
      expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
    });

    it('renders all options', () => {
      render(
        <AccessibleFormField 
          {...defaultProps} 
          type="select" 
          options={selectOptions}
        />
      );
      
      selectOptions.forEach(option => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      });
    });
  });

  describe('Textarea field', () => {
    it('renders textarea element', () => {
      render(<AccessibleFormField {...defaultProps} type="textarea" />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('applies custom rows', () => {
      render(<AccessibleFormField {...defaultProps} type="textarea" rows={5} />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '5');
    });

    it('applies default rows', () => {
      render(<AccessibleFormField {...defaultProps} type="textarea" />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '3');
    });
  });

  describe('Additional input attributes', () => {
    it('applies placeholder', () => {
      render(<AccessibleFormField {...defaultProps} placeholder="Enter text..." />);
      
      const input = screen.getByPlaceholderText('Enter text...');
      expect(input).toBeInTheDocument();
    });

    it('applies autoComplete', () => {
      render(<AccessibleFormField {...defaultProps} autoComplete="email" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('autoComplete', 'email');
    });

    it('applies min, max, and step for number input', () => {
      render(
        <AccessibleFormField 
          {...defaultProps} 
          type="number" 
          value={5}
          min={0}
          max={10}
          step={0.5}
        />
      );
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '10');
      expect(input).toHaveAttribute('step', '0.5');
    });
  });

  describe('User interactions', () => {
    it('calls onChange when input value changes', () => {
      const onChange = vi.fn();
      render(<AccessibleFormField {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'new value' } });
      
      expect(onChange).toHaveBeenCalledWith('new value');
    });

    it('calls onChange when select value changes', () => {
      const onChange = vi.fn();
      render(
        <AccessibleFormField 
          {...defaultProps} 
          type="select"
          options={[
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' },
          ]}
          onChange={onChange}
        />
      );
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'option2' } });
      
      expect(onChange).toHaveBeenCalledWith('option2');
    });

    it('calls onChange when textarea value changes', () => {
      const onChange = vi.fn();
      render(
        <AccessibleFormField 
          {...defaultProps} 
          type="textarea"
          onChange={onChange}
        />
      );
      
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'multiline\ntext' } });
      
      expect(onChange).toHaveBeenCalledWith('multiline\ntext');
    });
  });

  describe('Value handling', () => {
    it('displays string value', () => {
      render(<AccessibleFormField {...defaultProps} value="test value" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('test value');
    });

    it('displays number value', () => {
      render(
        <AccessibleFormField {...defaultProps} type="number" value={42} />
      );
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(42);
    });
  });

  describe('Styling', () => {
    it('applies base input classes', () => {
      render(<AccessibleFormField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('w-full', 'px-3', 'py-2', 'rounded-lg');
    });

    it('applies focus styles', () => {
      render(<AccessibleFormField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('focus:outline-none', 'focus:ring-2');
    });

    it('applies dark mode classes', () => {
      render(<AccessibleFormField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('dark:bg-gray-700', 'dark:text-white');
    });
  });
});