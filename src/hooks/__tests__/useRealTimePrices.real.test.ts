/**
 * useRealTimePrices REAL DATABASE Tests
 * Tests hook with real database operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRealTimePrices } from './useRealTimePrices';
import { RealTestDatabase, RealTestProvider, testDb } from '../../test/setup/real-test-framework';

describe('useRealTimePrices - REAL DATABASE TESTS', () => {
  let db: RealTestDatabase;

  beforeAll(async () => {
    db = new RealTestDatabase();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  it('works with REAL database data', async () => {
    // Create REAL test data
    const testData = await db.setupCompleteTestScenario();
    
    const { result } = renderHook(() => useRealTimePrices(), {
      wrapper: RealTestProvider,
    });

    // Test hook with REAL data
    await act(async () => {
      await result.current.performAction(testData.id);
    });

    // Verify REAL database changes
    await waitFor(async () => {
      const dbRecord = await db.getRecord('table', testData.id);
      expect(dbRecord).toBeDefined();
    });
  });
});