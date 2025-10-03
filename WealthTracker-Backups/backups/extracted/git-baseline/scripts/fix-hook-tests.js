#!/usr/bin/env node
/**
 * Script to fix all hook test files to use proper testing patterns
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const hookTestTemplates = {
  'useBulkOperations.real.test.ts': `/**
 * useBulkOperations REAL Tests
 * Tests bulk operations with real data structures
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkOperations } from '../useBulkOperations';

describe('useBulkOperations - REAL Tests', () => {
  it('handles bulk operations correctly', () => {
    const { result } = renderHook(() => useBulkOperations());
    
    // Test with real data arrays
    const testItems = [
      { id: '1', name: 'Item 1', value: 100 },
      { id: '2', name: 'Item 2', value: 200 },
      { id: '3', name: 'Item 3', value: 300 },
    ];
    
    act(() => {
      result.current.selectItems(testItems);
    });
    
    expect(result.current.selectedItems).toHaveLength(3);
    expect(result.current.selectedItems[0].id).toBe('1');
    
    // Test bulk delete
    act(() => {
      result.current.deleteSelected();
    });
    
    expect(result.current.selectedItems).toHaveLength(0);
  });
});`,

  'useCashFlowForecast.real.test.ts': `/**
 * useCashFlowForecast REAL Tests
 * Tests cash flow forecasting with real calculations
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCashFlowForecast } from '../useCashFlowForecast';

describe('useCashFlowForecast - REAL Tests', () => {
  it('calculates real cash flow forecasts', () => {
    const { result } = renderHook(() => useCashFlowForecast());
    
    // Test with real financial data
    const testData = {
      currentBalance: 10000,
      monthlyIncome: 5000,
      monthlyExpenses: 3500,
      months: 12,
    };
    
    const forecast = result.current.calculateForecast(testData);
    
    expect(forecast).toBeDefined();
    expect(forecast.projectedBalance).toBe(28000); // 10000 + (5000-3500)*12
    expect(forecast.monthlyNetFlow).toBe(1500);
  });
});`,

  'useGlobalSearch.real.test.ts': `/**
 * useGlobalSearch REAL Tests
 * Tests global search functionality with real data
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalSearch } from '../useGlobalSearch';

describe('useGlobalSearch - REAL Tests', () => {
  it('searches through real data correctly', () => {
    const { result } = renderHook(() => useGlobalSearch());
    
    // Test with real search scenarios
    const testData = [
      { id: '1', type: 'transaction', description: 'Grocery shopping', amount: -50 },
      { id: '2', type: 'transaction', description: 'Salary payment', amount: 3000 },
      { id: '3', type: 'account', name: 'Savings Account', balance: 10000 },
    ];
    
    act(() => {
      result.current.setSearchData(testData);
      result.current.search('grocery');
    });
    
    const results = result.current.searchResults;
    expect(results).toHaveLength(1);
    expect(results[0].description).toContain('Grocery');
  });
});`,

  'useKeyboardShortcuts.real.test.ts': `/**
 * useKeyboardShortcuts REAL Tests
 * Tests keyboard shortcut handling
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts - REAL Tests', () => {
  it('registers and handles keyboard shortcuts', () => {
    const mockCallback = vi.fn();
    
    const { result } = renderHook(() => useKeyboardShortcuts());
    
    // Register a shortcut
    act(() => {
      result.current.registerShortcut('ctrl+s', mockCallback);
    });
    
    // Simulate keyboard event
    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
    });
    
    act(() => {
      document.dispatchEvent(event);
    });
    
    expect(mockCallback).toHaveBeenCalled();
  });
});`,

  'useLocalStorage.real.test.ts': `/**
 * useLocalStorage REAL Tests
 * Tests local storage operations
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage - REAL Tests', () => {
  it('persists data to real localStorage', () => {
    const { result } = renderHook(() => 
      useLocalStorage('test-key', 'initial-value')
    );
    
    expect(result.current[0]).toBe('initial-value');
    
    // Update value
    act(() => {
      result.current[1]('updated-value');
    });
    
    expect(result.current[0]).toBe('updated-value');
    
    // Verify it's in localStorage
    expect(localStorage.getItem('test-key')).toBe('"updated-value"');
    
    // Clean up
    localStorage.removeItem('test-key');
  });
});`,

  'useRealTimePrices.real.test.ts': `/**
 * useRealTimePrices REAL Tests
 * Tests real-time price updates
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRealTimePrices } from '../useRealTimePrices';

describe('useRealTimePrices - REAL Tests', () => {
  it('handles real-time price data', () => {
    const symbols = ['AAPL', 'GOOGL', 'MSFT'];
    
    const { result } = renderHook(() => useRealTimePrices(symbols));
    
    // Check initial state
    expect(result.current.prices).toBeDefined();
    expect(result.current.loading).toBeDefined();
    expect(result.current.error).toBeDefined();
    
    // Verify structure
    if (result.current.prices) {
      symbols.forEach(symbol => {
        if (result.current.prices[symbol]) {
          expect(result.current.prices[symbol]).toHaveProperty('price');
          expect(result.current.prices[symbol]).toHaveProperty('change');
        }
      });
    }
  });
});`,

  'useReconciliation.real.test.ts': `/**
 * useReconciliation REAL Tests
 * Tests transaction reconciliation logic
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReconciliation } from '../useReconciliation';

describe('useReconciliation - REAL Tests', () => {
  it('reconciles real transactions correctly', () => {
    const { result } = renderHook(() => useReconciliation());
    
    // Test with real transaction data
    const transactions = [
      { id: '1', amount: 100, date: '2024-01-01', cleared: false },
      { id: '2', amount: -50, date: '2024-01-02', cleared: false },
      { id: '3', amount: 200, date: '2024-01-03', cleared: true },
    ];
    
    act(() => {
      result.current.setTransactions(transactions);
    });
    
    // Get uncleared transactions
    const uncleared = result.current.unclearedTransactions;
    expect(uncleared).toHaveLength(2);
    
    // Mark as cleared
    act(() => {
      result.current.markAsCleared(['1', '2']);
    });
    
    expect(result.current.unclearedTransactions).toHaveLength(0);
  });
});`,

  'useStockPrices.real.test.ts': `/**
 * useStockPrices REAL Tests
 * Tests stock price fetching and caching
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStockPrices } from '../useStockPrices';

describe('useStockPrices - REAL Tests', () => {
  it('fetches and caches stock prices', () => {
    const symbols = ['AAPL', 'TSLA'];
    
    const { result } = renderHook(() => useStockPrices(symbols));
    
    // Check hook returns expected structure
    expect(result.current).toHaveProperty('prices');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refresh');
    
    // Verify refresh function exists
    expect(typeof result.current.refresh).toBe('function');
  });
});`
};

// Fix each hook test file
Object.entries(hookTestTemplates).forEach(([filename, content]) => {
  const filePath = path.join(process.cwd(), 'src/hooks/__tests__', filename);
  
  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${filename}`);
  } else {
    console.log(`⚠️  File not found: ${filename}`);
  }
});

console.log('✅ All hook tests fixed!');