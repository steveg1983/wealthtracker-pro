#!/usr/bin/env node

/**
 * Batch Test Generator
 * Generates test files for multiple components at once
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Priority files to generate tests for
const BATCH_FILES = {
  components: [
    'AccountSettingsModal',
    'BalanceReconciliationModal',
    'BudgetRollover',
    'BulkTransactionEdit',
    'CategorySelector',
    'DashboardWidget',
    'DataValidation',
    'DuplicateDetection',
    'GlobalSearch',
    'RecurringTransactionModal',
    'SplitTransactionModal',
    'TransactionRow',
    'VirtualizedTransactionList'
  ],
  pages: [
    'Accounts',
    'Budget',
    'Dashboard',
    'Transactions',
    'Analytics',
    'Reports'
  ],
  hooks: [
    'useAdvancedSearch',
    'useBulkOperations',
    'useCashFlowForecast',
    'useGlobalSearch',
    'useKeyboardShortcuts'
  ],
  utils: [
    'formatters',
    'csvImport',
    'reconciliation',
    'decimal-converters',
    'dateUtils'
  ]
};

// Test template generator
function generateTestTemplate(filePath, fileType) {
  const fileName = path.basename(filePath, path.extname(filePath));
  const isComponent = fileType === 'components' || fileType === 'pages';
  const importPath = filePath.replace(/\.(ts|tsx)$/, '');
  
  if (isComponent) {
    return `/**
 * ${fileName} Tests
 * Tests for the ${fileName} component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ${fileName} } from '../${fileName}';
import { renderWithProviders, createMockAccount, createMockTransaction } from '../../test/testUtils';

describe('${fileName}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('renders correctly with default props', () => {
      renderWithProviders(<${fileName} />);
      
      // Add specific assertions based on component
      expect(screen.getByTestId('${fileName.toLowerCase()}')).toBeInTheDocument();
    });

    it('renders loading state when data is loading', () => {
      renderWithProviders(<${fileName} isLoading={true} />);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('renders error state when error occurs', () => {
      renderWithProviders(<${fileName} error="Test error" />);
      
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('renders empty state when no data', () => {
      renderWithProviders(<${fileName} data={[]} />);
      
      expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('handles click events correctly', async () => {
      const mockOnClick = vi.fn();
      renderWithProviders(<${fileName} onClick={mockOnClick} />);
      
      const element = screen.getByTestId('clickable-element');
      await userEvent.click(element);
      
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('handles form submission', async () => {
      const mockOnSubmit = vi.fn();
      renderWithProviders(<${fileName} onSubmit={mockOnSubmit} />);
      
      // Fill form fields
      const input = screen.getByLabelText(/name/i);
      await userEvent.type(input, 'Test Value');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Test Value'
        }));
      });
    });

    it('validates user input', async () => {
      renderWithProviders(<${fileName} />);
      
      const input = screen.getByLabelText(/amount/i);
      await userEvent.type(input, '-100');
      
      await waitFor(() => {
        expect(screen.getByText(/must be positive/i)).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithProviders(<${fileName} />);
      
      const mainElement = screen.getByRole('main');
      expect(mainElement).toHaveAttribute('aria-label');
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<${fileName} />);
      
      const firstButton = screen.getAllByRole('button')[0];
      firstButton.focus();
      
      await userEvent.keyboard('{Tab}');
      
      const secondButton = screen.getAllByRole('button')[1];
      expect(secondButton).toHaveFocus();
    });

    it('announces changes to screen readers', async () => {
      renderWithProviders(<${fileName} />);
      
      const button = screen.getByRole('button', { name: /update/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/updated successfully/i);
      });
    });
  });

  describe('edge cases', () => {
    it('handles large datasets efficiently', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: \`Item \${i}\`
      }));
      
      renderWithProviders(<${fileName} data={largeData} />);
      
      // Should use virtualization for large lists
      const visibleItems = screen.getAllByTestId('list-item');
      expect(visibleItems.length).toBeLessThan(50);
    });

    it('handles network errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      renderWithProviders(<${fileName} onFetch={mockFetch} />);
      
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('prevents double submission', async () => {
      const mockSubmit = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      renderWithProviders(<${fileName} onSubmit={mockSubmit} />);
      
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);
      await userEvent.click(submitButton);
      
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });
  });
});`;
  } else if (fileType === 'hooks') {
    return `/**
 * ${fileName} Tests
 * Tests for the ${fileName} hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ${fileName} } from '../${fileName}';
import { AllProviders } from '../../test/testUtils';

describe('${fileName}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('returns initial state correctly', () => {
      const { result } = renderHook(() => ${fileName}(), {
        wrapper: AllProviders
      });

      expect(result.current).toMatchObject({
        // Add expected initial state
        data: null,
        loading: false,
        error: null
      });
    });

    it('loads data on mount when autoLoad is true', async () => {
      const { result } = renderHook(() => ${fileName}({ autoLoad: true }), {
        wrapper: AllProviders
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.data).toBeDefined();
      });
    });
  });

  describe('actions', () => {
    it('performs search correctly', async () => {
      const { result } = renderHook(() => ${fileName}(), {
        wrapper: AllProviders
      });

      act(() => {
        result.current.search('test query');
      });

      await waitFor(() => {
        expect(result.current.results).toHaveLength(3);
        expect(result.current.results[0]).toMatchObject({
          title: expect.stringContaining('test')
        });
      });
    });

    it('handles errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('API Error'));
      
      const { result } = renderHook(() => ${fileName}({ fetcher: mockFetch }), {
        wrapper: AllProviders
      });

      act(() => {
        result.current.load();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('API Error');
        expect(result.current.loading).toBe(false);
      });
    });

    it('cancels pending requests on unmount', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
      
      const { result, unmount } = renderHook(() => ${fileName}(), {
        wrapper: AllProviders
      });

      act(() => {
        result.current.load();
      });

      unmount();

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe('memoization', () => {
    it('memoizes expensive calculations', () => {
      const expensiveCalculation = vi.fn();
      
      const { result, rerender } = renderHook(
        ({ value }) => ${fileName}({ value, calculate: expensiveCalculation }),
        {
          wrapper: AllProviders,
          initialProps: { value: 10 }
        }
      );

      expect(expensiveCalculation).toHaveBeenCalledTimes(1);

      // Same props, should not recalculate
      rerender({ value: 10 });
      expect(expensiveCalculation).toHaveBeenCalledTimes(1);

      // Different props, should recalculate
      rerender({ value: 20 });
      expect(expensiveCalculation).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('handles rapid updates correctly', async () => {
      const { result } = renderHook(() => ${fileName}(), {
        wrapper: AllProviders
      });

      // Rapid fire multiple updates
      act(() => {
        result.current.update('value1');
        result.current.update('value2');
        result.current.update('value3');
      });

      await waitFor(() => {
        // Should only process the latest update
        expect(result.current.value).toBe('value3');
      });
    });

    it('handles concurrent operations', async () => {
      const { result } = renderHook(() => ${fileName}(), {
        wrapper: AllProviders
      });

      // Start multiple operations
      const promises = [
        act(() => result.current.operation1()),
        act(() => result.current.operation2()),
        act(() => result.current.operation3())
      ];

      await Promise.all(promises);

      // All operations should complete successfully
      expect(result.current.status).toBe('completed');
    });
  });
});`;
  } else {
    return `/**
 * ${fileName} Tests
 * Tests for ${fileName} utility functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as ${fileName} from '../${fileName}';

describe('${fileName}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('core functionality', () => {
    it('performs expected operations', () => {
      const result = ${fileName}.process({ value: 'test' });
      expect(result).toBe('processed: test');
    });

    it('handles edge cases correctly', () => {
      expect(${fileName}.process(null)).toBe('');
      expect(${fileName}.process(undefined)).toBe('');
      expect(${fileName}.process('')).toBe('');
    });

    it('validates input correctly', () => {
      expect(() => ${fileName}.validate(-1)).toThrow('Invalid input');
      expect(() => ${fileName}.validate(101)).toThrow('Out of range');
      expect(${fileName}.validate(50)).toBe(true);
    });
  });

  describe('formatting functions', () => {
    it('formats currency correctly', () => {
      expect(${fileName}.formatCurrency(1234.56)).toBe('$1,234.56');
      expect(${fileName}.formatCurrency(0)).toBe('$0.00');
      expect(${fileName}.formatCurrency(-100)).toBe('-$100.00');
    });

    it('formats dates correctly', () => {
      const date = new Date('2025-01-21');
      expect(${fileName}.formatDate(date)).toBe('01/21/2025');
      expect(${fileName}.formatDate(date, 'long')).toBe('January 21, 2025');
    });

    it('handles invalid formats gracefully', () => {
      expect(${fileName}.formatCurrency('invalid')).toBe('$0.00');
      expect(${fileName}.formatDate('invalid')).toBe('Invalid Date');
    });
  });

  describe('calculations', () => {
    it('calculates totals correctly', () => {
      const items = [
        { amount: 100 },
        { amount: 200 },
        { amount: 300 }
      ];
      
      expect(${fileName}.calculateTotal(items)).toBe(600);
    });

    it('handles decimal precision', () => {
      const items = [
        { amount: 0.1 },
        { amount: 0.2 },
        { amount: 0.3 }
      ];
      
      expect(${fileName}.calculateTotal(items)).toBe(0.6);
    });

    it('filters data correctly', () => {
      const data = [
        { type: 'income', amount: 100 },
        { type: 'expense', amount: 50 },
        { type: 'income', amount: 200 }
      ];
      
      const filtered = ${fileName}.filterByType(data, 'income');
      expect(filtered).toHaveLength(2);
      expect(filtered[0].amount).toBe(100);
      expect(filtered[1].amount).toBe(200);
    });
  });

  describe('async operations', () => {
    it('fetches data successfully', async () => {
      const mockData = { id: 1, name: 'Test' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const result = await ${fileName}.fetchData('/api/test');
      expect(result).toEqual(mockData);
    });

    it('handles fetch errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(${fileName}.fetchData('/api/test')).rejects.toThrow('Network error');
    });

    it('implements retry logic', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        });
      });

      const result = await ${fileName}.fetchWithRetry('/api/test', { maxRetries: 3 });
      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });
  });

  describe('performance', () => {
    it('caches results appropriately', () => {
      const expensiveOperation = vi.fn().mockReturnValue('result');
      const cached = ${fileName}.createCached(expensiveOperation);

      // First call
      expect(cached('key')).toBe('result');
      expect(expensiveOperation).toHaveBeenCalledTimes(1);

      // Second call with same key - should use cache
      expect(cached('key')).toBe('result');
      expect(expensiveOperation).toHaveBeenCalledTimes(1);

      // Different key - should call function again
      expect(cached('different')).toBe('result');
      expect(expensiveOperation).toHaveBeenCalledTimes(2);
    });

    it('handles large datasets efficiently', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);
      
      const start = performance.now();
      const result = ${fileName}.processLargeDataset(largeArray);
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});`;
  }
}

// Generate test files
async function generateTests() {
  console.log('🚀 Batch Test File Generator\n');
  console.log('============================\n');

  let totalGenerated = 0;
  let totalSkipped = 0;

  for (const [category, files] of Object.entries(BATCH_FILES)) {
    console.log(`\n📂 ${category.charAt(0).toUpperCase() + category.slice(1)}`);
    console.log('-'.repeat(30));

    for (const fileName of files) {
      const srcPath = path.join(__dirname, '..', 'src', category, `${fileName}.tsx`);
      const altSrcPath = path.join(__dirname, '..', 'src', category, `${fileName}.ts`);
      
      // Check if source file exists
      const sourceExists = fs.existsSync(srcPath) || fs.existsSync(altSrcPath);
      if (!sourceExists) {
        console.log(`⚠️  ${fileName} - Source file not found`);
        totalSkipped++;
        continue;
      }

      // Determine test file path
      let testPath;
      if (category === 'components') {
        testPath = path.join(__dirname, '..', 'src', 'components', '__tests__', `${fileName}.test.tsx`);
      } else if (category === 'pages') {
        testPath = path.join(__dirname, '..', 'src', 'pages', `${fileName}.test.tsx`);
      } else if (category === 'hooks') {
        testPath = path.join(__dirname, '..', 'src', 'hooks', '__tests__', `${fileName}.test.ts`);
      } else {
        testPath = path.join(__dirname, '..', 'src', 'utils', '__tests__', `${fileName}.test.ts`);
      }

      // Check if test already exists
      if (fs.existsSync(testPath)) {
        console.log(`✓  ${fileName} - Test already exists`);
        continue;
      }

      // Ensure directory exists
      const testDir = path.dirname(testPath);
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Generate and write test file
      const testContent = generateTestTemplate(fileName, category);
      fs.writeFileSync(testPath, testContent);
      
      console.log(`✅ ${fileName} - Test generated`);
      totalGenerated++;
    }
  }

  console.log('\n📊 Summary');
  console.log('==========');
  console.log(`✅ Generated: ${totalGenerated} test files`);
  console.log(`⚠️  Skipped: ${totalSkipped} files`);
  console.log(`📁 Total: ${totalGenerated + totalSkipped} files processed`);
  
  console.log('\n📝 Next Steps:');
  console.log('1. Review generated test files');
  console.log('2. Update test assertions for each component');
  console.log('3. Add component-specific test cases');
  console.log('4. Run tests: npm run test:unit');
  console.log('5. Check coverage: npm run test:coverage');
}

// Run the generator
generateTests().catch(console.error);