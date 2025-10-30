/**
 * Budget REAL DATABASE Tests
 * Tests with ACTUAL database operations, not mocks!
 */

import { it, expect } from 'vitest';
import { describeSupabase, withRealDatabase } from '@wealthtracker/testing/supabaseRealTest';

const describeIfSupabase = describeSupabase;

describeIfSupabase('Budget - REAL DATABASE TESTS', () => {
  it('creates minimal test data in REAL database', async () => {
    await withRealDatabase(async (db) => {
      const testData = await db.setupMinimalTest();
      
      expect(testData.user).toBeDefined();
      expect(testData.user.id).toBeTruthy();
      expect(testData.account).toBeDefined();
      expect(testData.account.balance).toBe(1000);
    });
  });
});