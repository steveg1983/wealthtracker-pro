/**
 * TEMPLATE: Real Component Test
 * Use this template to convert mock tests to REAL database tests
 * 
 * REPLACE:
 * - ComponentName with actual component name
 * - Adjust database operations for specific component needs
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComponentName from './ComponentName'; // REPLACE with actual component
import { 
  RealTestDatabase,
  renderWithRealData,
  withRealDatabase
} from '../test/setup/real-test-framework';

describe('ComponentName - REAL DATABASE TESTS', () => {
  let db: RealTestDatabase;
  let testUser: any;
  let testAccount: any;
  let testCategory: any;

  // Setup before all tests
  beforeAll(async () => {
    db = new RealTestDatabase();
    
    // Create REAL test data in database
    testUser = await db.createUser({
      email: 'component-test@example.com',
      name: 'Component Test User',
    });
    
    testAccount = await db.createAccount(testUser.id, {
      name: 'Test Account',
      type: 'checking',
      balance: 1000,
    });
    
    testCategory = await db.createCategory({
      name: 'Test Category',
      type: 'expense',
    });
  });

  // Cleanup after all tests
  afterAll(async () => {
    await db.cleanup();
  });

  // Clean up test-specific data after each test
  afterEach(async () => {
    // Clean up any data created during individual tests
    // Example: await db.db.from('table').delete().eq('test_field', 'test_value');
  });

  describe('REAL Data Creation', () => {
    it('creates REAL data in the database when action is performed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      renderWithRealData(
        <ComponentName 
          isOpen={true} 
          onClose={onClose}
          // Add other props as needed
        />
      );

      // Interact with the component
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);
      
      // Wait for REAL database operation
      await waitFor(async () => {
        // Verify REAL data was created in database
        const exists = await db.verifyExists('table_name', 'record_id');
        expect(exists).toBe(true);
        
        // Get and verify the REAL data
        const record = await db.getRecord('table_name', 'record_id');
        expect(record).toMatchObject({
          // Verify expected fields
        });
      });
    });
  });

  describe('REAL Data Loading', () => {
    it('loads and displays REAL data from the database', async () => {
      // Create REAL data first
      const realData = await db.createTransaction(testAccount.id, {
        amount: 100,
        description: 'Test Transaction',
      });
      
      renderWithRealData(
        <ComponentName 
          // Props that would load this data
        />
      );

      // Wait for component to load REAL data
      await waitFor(() => {
        expect(screen.getByText('Test Transaction')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
      });
      
      // Verify it's actually from the database
      const dbRecord = await db.getRecord('transactions', realData.id);
      expect(dbRecord.description).toBe('Test Transaction');
    });
  });

  describe('REAL Data Updates', () => {
    it('updates REAL data in the database', async () => {
      const user = userEvent.setup();
      
      // Create initial REAL data
      const initialData = await db.createBudget(testUser.id, testCategory.id, {
        amount: 500,
        period: 'monthly',
      });
      
      renderWithRealData(
        <ComponentName 
          data={initialData}
          // Other props
        />
      );

      // Modify data through UI
      const amountInput = screen.getByLabelText(/amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, '750');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      // Verify REAL database was updated
      await waitFor(async () => {
        const updated = await db.getRecord('budgets', initialData.id);
        expect(updated.amount).toBe(750);
      });
    });
  });

  describe('REAL Data Deletion', () => {
    it('deletes REAL data from the database', async () => {
      const user = userEvent.setup();
      
      // Create data to delete
      const dataToDelete = await db.createGoal(testUser.id, {
        name: 'Goal to Delete',
        target_amount: 1000,
      });
      
      renderWithRealData(
        <ComponentName 
          data={dataToDelete}
          // Other props
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);
      
      // Confirm deletion if needed
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      // Verify data was REALLY deleted from database
      await waitFor(async () => {
        const exists = await db.verifyExists('goals', dataToDelete.id);
        expect(exists).toBe(false);
      });
    });
  });

  describe('Database Constraints', () => {
    it('respects REAL database constraints', async () => {
      const user = userEvent.setup();
      
      renderWithRealData(<ComponentName />);

      // Try to violate a constraint (e.g., unique, foreign key, etc.)
      // This should fail at the database level
      
      // Example: Try to create duplicate unique field
      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, 'Duplicate Name');
      
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);
      
      // Should show error because of database constraint
      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });
      
      // Verify nothing was saved to database
      const { data } = await testDb.from('table').select('*').eq('name', 'Duplicate Name');
      expect(data).toHaveLength(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('handles complex REAL data relationships', async () => {
      await withRealDatabase(async (db) => {
        // Setup complex scenario
        const scenario = await db.setupCompleteTestScenario();
        
        renderWithRealData(
          <ComponentName 
            userId={scenario.user.id}
            accounts={scenario.accounts}
            // Other related data
          />
        );

        // Test complex interactions
        // All data is REAL and related in the database
        
        // Verify relationships are maintained
        const transactions = await db.getTransactions(scenario.accounts[0].id);
        expect(transactions).toHaveLength(2);
        
        // Verify cascade operations work
        await db.deleteAccount(scenario.accounts[0].id);
        const orphanedTransactions = await db.getTransactions(scenario.accounts[0].id);
        expect(orphanedTransactions).toHaveLength(0);
      });
    });
  });

  describe('Performance with REAL Data', () => {
    it('handles large amounts of REAL data efficiently', async () => {
      // Create many records
      const promises = Array.from({ length: 100 }, (_, i) => 
        db.createTransaction(testAccount.id, {
          amount: i * 10,
          description: `Transaction ${i}`,
        })
      );
      
      await Promise.all(promises);
      
      renderWithRealData(
        <ComponentName accountId={testAccount.id} />
      );

      // Should handle pagination/virtualization with REAL data
      await waitFor(() => {
        // Only visible items should be rendered
        const visibleTransactions = screen.getAllByText(/Transaction/);
        expect(visibleTransactions.length).toBeLessThan(100);
      });
    });
  });

  describe('Error Handling with REAL Database', () => {
    it('handles REAL database errors gracefully', async () => {
      const user = userEvent.setup();
      
      renderWithRealData(<ComponentName />);

      // Force a database error (e.g., invalid foreign key)
      const accountSelect = screen.getByLabelText(/account/i);
      await user.selectOptions(accountSelect, 'non-existent-id');
      
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);
      
      // Should show user-friendly error
      await waitFor(() => {
        expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
      });
      
      // Component should remain functional
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});