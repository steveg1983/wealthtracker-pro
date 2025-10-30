/**
 * AppFlow REAL DATABASE Tests
 * Tests with ACTUAL database operations, not mocks!
 */

import { it, expect } from 'vitest';
import { describeSupabase, withRealDatabase } from '../setup/real-test-framework';

describeSupabase('AppFlow - REAL DATABASE TESTS', () => {
  it('can create test data in REAL database', async () => {
    await withRealDatabase(async (db) => {
      // Create REAL test data
      const testData = await db.setupCompleteTestScenario();
      
      // Verify data was created
      expect(testData.user).toBeDefined();
      expect(testData.accounts).toHaveLength(2);
      expect(testData.categories.all).toHaveLength(9);
    });
  });
});