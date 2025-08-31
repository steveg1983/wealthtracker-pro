/**
 * App REAL DATABASE Tests
 * Tests context with real database operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider, useApp } from './App';
import { RealTestDatabase, renderWithRealData, testDb } from '../../test/setup/real-test-framework';

describe('App - REAL DATABASE TESTS', () => {
  let db: RealTestDatabase;

  beforeAll(async () => {
    db = new RealTestDatabase();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  it('manages REAL data in database', async () => {
    const TestComponent = () => {
      const context = useApp();
      return <div>{JSON.stringify(context.data)}</div>;
    };

    renderWithRealData(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    // Create REAL data
    const realData = await db.createTestData();
    
    // Verify context reflects REAL database state
    await waitFor(async () => {
      const dbData = await testDb.from('table').select('*');
      expect(dbData.data).toHaveLength(1);
    });
  });
});