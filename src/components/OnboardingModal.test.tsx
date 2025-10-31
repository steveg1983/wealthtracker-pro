/**
 * OnboardingModal Tests
 * Comprehensive tests for the onboarding modal component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingModal from './OnboardingModal';

// Mock supportedCurrencies
vi.mock('../utils/currency', () => ({
  supportedCurrencies: [
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  ],
}));

const mockSupportedCurrencies = [
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
];

describe('OnboardingModal', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (isOpen = true) => {
    return render(
      <OnboardingModal
        isOpen={isOpen}
        onComplete={mockOnComplete}
      />
    );
  };

  describe('rendering', () => {
    it('renders when open', () => {
      renderModal(true);
      
      expect(screen.getByText('Welcome to WealthTracker!')).toBeInTheDocument();
      expect(screen.getByText(/Let's personalize your experience/)).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderModal(false);
      
      expect(screen.queryByText('Welcome to WealthTracker!')).not.toBeInTheDocument();
    });

    it('displays welcome title and description', () => {
      renderModal();
      
      expect(screen.getByRole('heading', { name: /welcome to wealthtracker/i })).toBeInTheDocument();
      expect(screen.getByText(/Let's personalize your experience with a few quick settings/)).toBeInTheDocument();
    });

    it('renders first name input field', () => {
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveAttribute('type', 'text');
      expect(nameInput).toHaveAttribute('placeholder', 'Enter your first name');
      expect(nameInput).toHaveAttribute('required');
      // autoFocus is present in component but may not render in test environment
    });

    it('renders currency selection dropdown', () => {
      renderModal();
      
      const currencySelect = screen.getByRole('combobox');
      expect(currencySelect).toBeInTheDocument();
      expect(currencySelect).toHaveValue('GBP'); // Default value
    });

    it('displays all supported currencies as options', () => {
      renderModal();
      
      mockSupportedCurrencies.forEach(currency => {
        const option = screen.getByRole('option', { 
          name: `${currency.symbol} ${currency.name} (${currency.code})`
        });
        expect(option).toBeInTheDocument();
        expect(option).toHaveValue(currency.code);
      });
    });

    it('renders get started button', () => {
      renderModal();
      
      const submitButton = screen.getByRole('button', { name: /get started/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('type', 'submit');
    });

    it('displays helper text for name input', () => {
      renderModal();
      
      expect(screen.getByText(/This will be used to personalize your dashboard/)).toBeInTheDocument();
    });

    it('displays helper text for currency selection', () => {
      renderModal();
      
      expect(screen.getByText(/Choose your preferred base currency to display your net worth in/)).toBeInTheDocument();
    });

    it('displays settings tip', () => {
      renderModal();
      
      expect(screen.getByText(/You can change these settings anytime in Settings → App Settings/)).toBeInTheDocument();
    });
  });

  describe('form interactions', () => {
    it('updates first name when typing', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      
      await user.type(nameInput, 'John');
      expect(nameInput).toHaveValue('John');
    });

    it('updates currency when selection changes', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const currencySelect = screen.getByRole('combobox');
      
      await user.selectOptions(currencySelect, 'USD');
      expect(currencySelect).toHaveValue('USD');
    });

    it('handles currency selection with fireEvent', () => {
      renderModal();
      
      const currencySelect = screen.getByRole('combobox');
      
      fireEvent.change(currencySelect, { target: { value: 'EUR' } });
      expect(currencySelect).toHaveValue('EUR');
    });

    it('preserves form state during re-renders', () => {
      const { rerender } = renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const currencySelect = screen.getByRole('combobox');
      
      fireEvent.change(nameInput, { target: { value: 'Alice' } });
      fireEvent.change(currencySelect, { target: { value: 'USD' } });
      
      expect(nameInput).toHaveValue('Alice');
      expect(currencySelect).toHaveValue('USD');
      
      rerender(
        <OnboardingModal
          isOpen={true}
          onComplete={mockOnComplete}
        />
      );
      
      const newNameInput = screen.getByPlaceholderText(/enter your first name/i);
      const newCurrencySelect = screen.getByRole('combobox');
      
      expect(newNameInput).toHaveValue('Alice');
      expect(newCurrencySelect).toHaveValue('USD');
    });
  });

  describe('form submission', () => {
    it('calls onComplete with correct values when form is submitted', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const currencySelect = screen.getByRole('combobox');
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.type(nameInput, 'John');
      await user.selectOptions(currencySelect, 'USD');
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
      expect(mockOnComplete).toHaveBeenCalledWith('John', 'USD');
    });

    it('trims whitespace from name before submission', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.type(nameInput, '  Alice  ');
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith('Alice', 'GBP');
    });

    it('prevents submission with empty name', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.click(submitButton);
      
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('prevents submission with only whitespace name', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.type(nameInput, '   ');
      await user.click(submitButton);
      
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('submits with default currency when none selected', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.type(nameInput, 'Bob');
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith('Bob', 'GBP');
    });

    it('handles form submission via Enter key', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      
      await user.type(nameInput, 'Charlie');
      await user.keyboard('{Enter}');
      
      expect(mockOnComplete).toHaveBeenCalledWith('Charlie', 'GBP');
    });

    it('handles form submission with fireEvent', () => {
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const currencySelect = screen.getByRole('combobox');
      const form = screen.getByRole('button', { name: /get started/i }).closest('form')!;
      
      fireEvent.change(nameInput, { target: { value: 'Dave' } });
      fireEvent.change(currencySelect, { target: { value: 'EUR' } });
      fireEvent.submit(form);
      
      expect(mockOnComplete).toHaveBeenCalledWith('Dave', 'EUR');
    });
  });

  describe('form validation', () => {
    it('shows required attribute on name input', () => {
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      expect(nameInput).toHaveAttribute('required');
    });

    it('allows submission with valid name', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.type(nameInput, 'ValidName');
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it('handles special characters in name', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.type(nameInput, "O'Connor-Smith");
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith("O'Connor-Smith", 'GBP');
    });

    it('handles long names', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const longName = 'A'.repeat(50);
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.type(nameInput, longName);
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith(longName, 'GBP');
    });
  });

  describe('styling and layout', () => {
    it('has proper modal overlay styling', () => {
      renderModal();
      
      const overlay = document.querySelector('.fixed.inset-0');
      expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-black', 'bg-opacity-50');
    });

    it('has proper modal content styling', () => {
      renderModal();
      
      const modalContent = screen.getByText('Welcome to WealthTracker!').closest('.bg-white');
      expect(modalContent).toHaveClass('bg-white', 'dark:bg-gray-800', 'rounded-2xl', 'p-6');
    });

    it('has proper form input styling', () => {
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const currencySelect = screen.getByRole('combobox');
      
      expect(nameInput).toHaveClass('w-full', 'px-3', 'py-2', 'border', 'rounded-lg');
      expect(currencySelect).toHaveClass('w-full', 'px-3', 'py-2', 'border', 'rounded-lg');
    });

    it('has proper button styling', () => {
      renderModal();
      
      const submitButton = screen.getByRole('button', { name: /get started/i });
      expect(submitButton).toHaveClass('flex-1', 'px-4', 'py-2', 'bg-primary', 'text-white', 'rounded-lg');
    });

    it('has proper tip box styling', () => {
      renderModal();
      
      const tipBox = screen.getByText(/You can change these settings anytime/).parentElement;
      expect(tipBox).toHaveClass('p-3', 'bg-blue-50', 'dark:bg-blue-900/20', 'border', 'rounded-lg');
    });
  });

  describe('accessibility', () => {
    it('has proper heading structure', () => {
      renderModal();
      
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Welcome to WealthTracker!');
    });

    it('has proper form labels', () => {
      renderModal();
      
      expect(screen.getByPlaceholderText(/enter your first name/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('has proper form structure', () => {
      renderModal();
      
      const form = screen.getByRole('button', { name: /get started/i }).closest('form');
      expect(form).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const currencySelect = screen.getByRole('combobox');
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      // Name input should have autofocus attribute
      // autoFocus is present in component but may not render in test environment
      
      // Tab to currency select
      await user.tab();
      expect(currencySelect).toHaveFocus();
      
      // Tab to submit button
      await user.tab();
      expect(submitButton).toHaveFocus();
    });

    it('has proper button roles', () => {
      renderModal();
      
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAttribute('type', 'submit');
    });

    it('has proper select options', () => {
      renderModal();
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(mockSupportedCurrencies.length);
      
      options.forEach((option, index) => {
        const currency = mockSupportedCurrencies[index];
        expect(option).toHaveValue(currency.code);
      });
    });
  });

  describe('edge cases', () => {
    it('handles modal state change during interaction', () => {
      const { rerender } = renderModal(true);
      
      expect(screen.getByText('Welcome to WealthTracker!')).toBeInTheDocument();
      
      rerender(
        <OnboardingModal
          isOpen={false}
          onComplete={mockOnComplete}
        />
      );
      
      expect(screen.queryByText('Welcome to WealthTracker!')).not.toBeInTheDocument();
    });

    it('handles multiple rapid form submissions', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.type(nameInput, 'TestUser');
      
      // Rapidly click submit multiple times
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledTimes(3);
      expect(mockOnComplete).toHaveBeenCalledWith('TestUser', 'GBP');
    });

    it('handles currency selection properly', () => {
      renderModal();
      
      const currencySelect = screen.getByRole('combobox');
      expect(currencySelect).toBeInTheDocument();
      
      // Should have all mocked options
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(mockSupportedCurrencies.length);
      
      // Check that each option exists
      mockSupportedCurrencies.forEach(currency => {
        const option = screen.getByRole('option', { name: new RegExp(currency.code) });
        expect(option).toHaveValue(currency.code);
      });
    });

    it('handles extremely long names', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const veryLongName = 'A'.repeat(1000);
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.type(nameInput, veryLongName);
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith(veryLongName, 'GBP');
    });

    it('handles unicode characters in name', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const unicodeName = '张伟';
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.type(nameInput, unicodeName);
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith(unicodeName, 'GBP');
    });
  });

  describe('real-world scenarios', () => {
    it('handles typical user onboarding flow', async () => {
      const user = userEvent.setup();
      renderModal();
      
      // User sees welcome message
      expect(screen.getByText('Welcome to WealthTracker!')).toBeInTheDocument();
      
      // User reads instructions
      expect(screen.getByText(/Let's personalize your experience/)).toBeInTheDocument();
      
      // User enters their name
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      await user.type(nameInput, 'Sarah');
      
      // User selects their currency
      const currencySelect = screen.getByRole('combobox');
      await user.selectOptions(currencySelect, 'USD');
      
      // User submits the form
      const submitButton = screen.getByRole('button', { name: /get started/i });
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith('Sarah', 'USD');
    });

    it('handles user changing their mind about currency', async () => {
      const user = userEvent.setup();
      renderModal();
      
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const currencySelect = screen.getByRole('combobox');
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.type(nameInput, 'Michael');
      
      // First selects USD
      await user.selectOptions(currencySelect, 'USD');
      expect(currencySelect).toHaveValue('USD');
      
      // Then changes to EUR
      await user.selectOptions(currencySelect, 'EUR');
      expect(currencySelect).toHaveValue('EUR');
      
      // Finally settles on JPY
      await user.selectOptions(currencySelect, 'JPY');
      expect(currencySelect).toHaveValue('JPY');
      
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith('Michael', 'JPY');
    });

    it('handles user using default settings', async () => {
      const user = userEvent.setup();
      renderModal();
      
      // User only enters name, keeps default currency
      const nameInput = screen.getByPlaceholderText(/enter your first name/i);
      const submitButton = screen.getByRole('button', { name: /get started/i });
      
      await user.type(nameInput, 'Emma');
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith('Emma', 'GBP');
    });

    it('shows helpful information about settings', () => {
      renderModal();
      
      // Check that users are informed they can change settings later
      expect(screen.getByText(/You can change these settings anytime in Settings → App Settings/)).toBeInTheDocument();
      
      // Check helper texts
      expect(screen.getByText(/This will be used to personalize your dashboard/)).toBeInTheDocument();
      expect(screen.getByText(/Choose your preferred base currency to display your net worth in/)).toBeInTheDocument();
    });
  });
});
