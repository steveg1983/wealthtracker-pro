/**
 * BudgetModal.proper REAL DATABASE Tests
 * Tests with ACTUAL database operations, not mocks!
 */

import { describe, it, expect } from 'vitest';
import { withRealDatabase } from '../test/setup/real-test-framework';

describe('BudgetModal.proper - REAL DATABASE TESTS', () => {
  it('creates minimal test data in REAL database', async () => {
    await withRealDatabase(async (db) => {
      // Create minimal REAL test data
      const testData = await db.setupMinimalTest();
      
      // Verify data was created
      expect(testData.user).toBeDefined();
      expect(testData.user.id).toBeTruthy();
      expect(testData.account).toBeDefined();
      expect(testData.account.balance).toBe(1000);
    });
  });
});