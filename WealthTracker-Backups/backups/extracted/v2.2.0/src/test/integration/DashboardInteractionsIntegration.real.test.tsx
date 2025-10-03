/**
 * DashboardInteractionsIntegration REAL DATABASE Tests
 * Tests with ACTUAL database operations, not mocks!
 */

import { describe, it, expect } from 'vitest';
import { RealTestDatabase, withRealDatabase } from '../setup/real-test-framework';

describe('DashboardInteractionsIntegration - REAL DATABASE TESTS', () => {
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