/**
 * ValidationService Tests
 * Comprehensive tests for validation logic and schemas
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { validationService } from '../validationService';

describe('ValidationService', () => {
  beforeEach(() => {
    // Reset any state if needed
  });

  describe('Transaction Validation', () => {
    it('validates valid transaction data', () => {
      const validTransaction = {
        amount: 100.50,
        type: 'expense',
        category: 'groceries',
        description: 'Weekly shopping',
        date: new Date('2025-01-20'),
        accountId: 'acc-123',
      };

      const result = validationService.validateTransaction(validTransaction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(100.50);
        expect(result.data.type).toBe('expense');
      }
    });

    it('rejects transaction with invalid amount', () => {
      const invalidTransaction = {
        amount: -50, // Negative amount should be invalid for most cases
        type: 'expense',
        category: 'groceries',
        description: 'Test',
        date: new Date(),
        accountId: 'acc-123',
      };

      const result = validationService.validateTransaction(invalidTransaction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('amount')
        )).toBe(true);
      }
    });

    it('rejects transaction with invalid type', () => {
      const invalidTransaction = {
        amount: 100,
        type: 'invalid-type',
        category: 'groceries',
        description: 'Test',
        date: new Date(),
        accountId: 'acc-123',
      };

      const result = validationService.validateTransaction(invalidTransaction);
      expect(result.success).toBe(false);
    });

    it('rejects transaction with missing required fields', () => {
      const incompleteTransaction = {
        amount: 100,
        // Missing type, category, description, date, accountId
      };

      const result = validationService.validateTransaction(incompleteTransaction);
      expect(result.success).toBe(false);
    });

    it('validates transaction with optional fields', () => {
      const transactionWithOptionals = {
        amount: 100,
        type: 'expense',
        category: 'groceries',
        description: 'Test transaction',
        date: new Date(),
        accountId: 'acc-123',
        tags: ['food', 'essential'],
        notes: 'Additional notes',
        pending: true,
        isReconciled: false,
      };

      const result = validationService.validateTransaction(transactionWithOptionals);
      expect(result.success).toBe(true);
    });

    it('trims and sanitizes string fields', () => {
      const transactionWithWhitespace = {
        amount: 100,
        type: 'expense',
        category: '  groceries  ',
        description: '  Test transaction  ',
        date: new Date(),
        accountId: 'acc-123',
      };

      const result = validationService.validateTransaction(transactionWithWhitespace);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('groceries');
        expect(result.data.description).toBe('Test transaction');
      }
    });
  });

  describe('Account Validation', () => {
    it('validates valid account data', () => {
      const validAccount = {
        name: 'Main Checking',
        type: 'current',
        balance: 1500.75,
        currency: 'GBP',
      };

      const result = validationService.validateAccount(validAccount);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Main Checking');
        expect(result.data.type).toBe('current');
        expect(result.data.balance).toBe(1500.75);
      }
    });

    it('rejects account with invalid type', () => {
      const invalidAccount = {
        name: 'Test Account',
        type: 'invalid-type',
        balance: 1000,
      };

      const result = validationService.validateAccount(invalidAccount);
      expect(result.success).toBe(false);
    });

    it('allows negative balance for credit accounts', () => {
      const creditAccount = {
        name: 'Credit Card',
        type: 'credit',
        balance: -500.25,
      };

      const result = validationService.validateAccount(creditAccount);
      expect(result.success).toBe(true);
    });

    it('validates account name length restrictions', () => {
      const longNameAccount = {
        name: 'A'.repeat(101), // Exceeds 100 character limit
        type: 'current',
        balance: 1000,
      };

      const result = validationService.validateAccount(longNameAccount);
      expect(result.success).toBe(false);
    });
  });

  describe('Budget Validation', () => {
    it('validates valid budget data', () => {
      const validBudget = {
        name: 'Groceries Budget',
        category: 'groceries',
        amount: 500,
        period: 'monthly',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      };

      const result = validationService.validateBudget(validBudget);
      expect(result.success).toBe(true);
    });

    it('rejects budget with invalid period', () => {
      const invalidBudget = {
        name: 'Test Budget',
        category: 'groceries',
        amount: 500,
        period: 'invalid-period',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      };

      const result = validationService.validateBudget(invalidBudget);
      expect(result.success).toBe(false);
    });

    it('rejects budget with end date before start date', () => {
      const invalidBudget = {
        name: 'Test Budget',
        category: 'groceries',
        amount: 500,
        period: 'monthly',
        startDate: new Date('2025-12-31'),
        endDate: new Date('2025-01-01'), // End before start
      };

      const result = validationService.validateBudget(invalidBudget);
      expect(result.success).toBe(false);
    });

    it('rejects budget with zero or negative amount', () => {
      const invalidBudget = {
        name: 'Test Budget',
        category: 'groceries',
        amount: 0,
        period: 'monthly',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      };

      const result = validationService.validateBudget(invalidBudget);
      expect(result.success).toBe(false);
    });
  });

  describe('Goal Validation', () => {
    it('validates valid goal data', () => {
      const validGoal = {
        name: 'Emergency Fund',
        targetAmount: 10000,
        currentAmount: 2500,
        targetDate: new Date('2025-12-31'),
        category: 'savings',
        priority: 'high',
      };

      const result = validationService.validateGoal(validGoal);
      expect(result.success).toBe(true);
    });

    it('rejects goal with invalid priority', () => {
      const invalidGoal = {
        name: 'Test Goal',
        targetAmount: 5000,
        currentAmount: 1000,
        targetDate: new Date('2025-12-31'),
        category: 'savings',
        priority: 'invalid-priority',
      };

      const result = validationService.validateGoal(invalidGoal);
      expect(result.success).toBe(false);
    });

    it('rejects goal with current amount greater than target', () => {
      const invalidGoal = {
        name: 'Test Goal',
        targetAmount: 1000,
        currentAmount: 1500, // Current > target
        targetDate: new Date('2025-12-31'),
        category: 'savings',
        priority: 'medium',
      };

      const result = validationService.validateGoal(invalidGoal);
      expect(result.success).toBe(false);
    });

    it('rejects goal with past target date', () => {
      const invalidGoal = {
        name: 'Test Goal',
        targetAmount: 5000,
        currentAmount: 1000,
        targetDate: new Date('2020-01-01'), // Past date
        category: 'savings',
        priority: 'medium',
      };

      const result = validationService.validateGoal(invalidGoal);
      expect(result.success).toBe(false);
    });
  });

  describe('Category Validation', () => {
    it('validates valid category data', () => {
      const validCategory = {
        name: 'Groceries',
        color: '#3B82F6',
        type: 'expense',
        isActive: true,
      };

      const result = validationService.validateCategory(validCategory);
      expect(result.success).toBe(true);
    });

    it('rejects category with invalid color format', () => {
      const invalidCategory = {
        name: 'Test Category',
        color: 'not-a-hex-color',
        type: 'expense',
        isActive: true,
      };

      const result = validationService.validateCategory(invalidCategory);
      expect(result.success).toBe(false);
    });

    it('validates hierarchical categories', () => {
      const parentCategory = {
        name: 'Food & Dining',
        color: '#3B82F6',
        type: 'expense',
        isActive: true,
      };

      const childCategory = {
        name: 'Restaurants',
        color: '#3B82F6',
        type: 'expense',
        parentId: 'parent-category-id',
        isActive: true,
      };

      const parentResult = validationService.validateCategory(parentCategory);
      const childResult = validationService.validateCategory(childCategory);

      expect(parentResult.success).toBe(true);
      expect(childResult.success).toBe(true);
    });
  });

  describe('Import Data Validation', () => {
    it('validates CSV row data', () => {
      const csvRow = {
        date: '2025-01-20',
        description: 'Test transaction',
        amount: '100.50',
        type: 'expense',
        category: 'groceries',
      };

      const result = validationService.validateImportRow(csvRow);
      expect(result.success).toBe(true);
    });

    it('handles different date formats', () => {
      const formats = [
        '2025-01-20',
        '20/01/2025',
        '01/20/2025',
        '20-Jan-2025',
        'January 20, 2025',
      ];

      formats.forEach(dateFormat => {
        const csvRow = {
          date: dateFormat,
          description: 'Test',
          amount: '100',
          type: 'expense',
          category: 'test',
        };

        const result = validationService.validateImportRow(csvRow);
        expect(result.success).toBe(true, `Failed for date format: ${dateFormat}`);
      });
    });

    it('handles different amount formats', () => {
      const amounts = [
        '100',
        '100.50',
        '1,000.50',
        '£100.50',
        '$100.50',
        '100.50 GBP',
      ];

      amounts.forEach(amount => {
        const csvRow = {
          date: '2025-01-20',
          description: 'Test',
          amount,
          type: 'expense',
          category: 'test',
        };

        const result = validationService.validateImportRow(csvRow);
        expect(result.success).toBe(true, `Failed for amount format: ${amount}`);
      });
    });
  });

  describe('Settings Validation', () => {
    it('validates user preferences', () => {
      const preferences = {
        currency: 'GBP',
        dateFormat: 'DD/MM/YYYY',
        theme: 'dark',
        language: 'en',
        notifications: {
          email: true,
          push: false,
          budgetAlerts: true,
          goalReminders: true,
        },
      };

      const result = validationService.validateSettings(preferences);
      expect(result.success).toBe(true);
    });

    it('rejects invalid currency code', () => {
      const invalidPreferences = {
        currency: 'INVALID',
        dateFormat: 'DD/MM/YYYY',
        theme: 'light',
      };

      const result = validationService.validateSettings(invalidPreferences);
      expect(result.success).toBe(false);
    });
  });

  describe('Email and Password Validation', () => {
    it('validates email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user123@subdomain.example.com',
      ];

      validEmails.forEach(email => {
        const result = validationService.validateEmail(email);
        expect(result.success).toBe(true, `Failed for email: ${email}`);
      });
    });

    it('rejects invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@.com',
      ];

      invalidEmails.forEach(email => {
        const result = validationService.validateEmail(email);
        expect(result.success).toBe(false, `Should fail for email: ${email}`);
      });
    });

    it('validates password strength', () => {
      const strongPassword = 'StrongP@ssw0rd123';
      const result = validationService.validatePassword(strongPassword);
      expect(result.success).toBe(true);
    });

    it('rejects weak passwords', () => {
      const weakPasswords = [
        'password', // Too common
        '123456', // Too simple
        'short', // Too short
        'NOLOWERCASE123!', // No lowercase
        'nouppercase123!', // No uppercase
        'NoNumbers!', // No numbers
        'NoSpecialChars123', // No special characters
      ];

      weakPasswords.forEach(password => {
        const result = validationService.validatePassword(password);
        expect(result.success).toBe(false, `Should fail for password: ${password}`);
      });
    });
  });

  describe('Batch Validation', () => {
    it('validates multiple transactions', () => {
      const transactions = [
        {
          amount: 100,
          type: 'expense',
          category: 'groceries',
          description: 'Transaction 1',
          date: new Date(),
          accountId: 'acc-1',
        },
        {
          amount: 200,
          type: 'income',
          category: 'salary',
          description: 'Transaction 2',
          date: new Date(),
          accountId: 'acc-1',
        },
      ];

      const results = validationService.validateTransactionBatch(transactions);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('handles mixed valid and invalid data', () => {
      const transactions = [
        {
          amount: 100,
          type: 'expense',
          category: 'groceries',
          description: 'Valid transaction',
          date: new Date(),
          accountId: 'acc-1',
        },
        {
          amount: -100, // Invalid
          type: 'invalid-type', // Invalid
          description: 'Invalid transaction',
          // Missing required fields
        },
      ];

      const results = validationService.validateTransactionBatch(transactions);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('Custom Validation Rules', () => {
    it('allows custom validation rules', () => {
      const customRule = (data: any) => {
        if (data.amount > 10000) {
          return { success: false, error: 'Amount exceeds limit' };
        }
        return { success: true, data };
      };

      const validData = { amount: 5000 };
      const invalidData = { amount: 15000 };

      expect(customRule(validData).success).toBe(true);
      expect(customRule(invalidData).success).toBe(false);
    });

    it('composes validation rules', () => {
      const amountRule = (data: any) => data.amount > 0;
      const typeRule = (data: any) => ['income', 'expense'].includes(data.type);
      
      const composedValidation = (data: any) => {
        return amountRule(data) && typeRule(data);
      };

      const validData = { amount: 100, type: 'expense' };
      const invalidData = { amount: -100, type: 'invalid' };

      expect(composedValidation(validData)).toBe(true);
      expect(composedValidation(invalidData)).toBe(false);
    });
  });
});