import { describe, it, expect } from 'vitest';
import { budgetFromDTO, budgetToDTO } from '../mappers';
import type { BudgetDTO } from '../dto';

describe('Budget Mappers', () => {
  describe('budgetFromDTO', () => {
    it('should handle legacy DTOs with category field', () => {
      const legacyBudgetDTO = {
        id: '1',
        category: 'groceries', // Legacy field name
        amount: 500,
        period: 'monthly' as const,
        isActive: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        spent: 0,
        updatedAt: '2023-01-01T00:00:00.000Z',
      } as any; // Cast to bypass TypeScript for testing

      const result = budgetFromDTO(legacyBudgetDTO);

      expect(result.categoryId).toBe('groceries');
      expect(result.id).toBe('1');
      expect(result.amount).toBe(500);
    });

    it('should handle modern DTOs with categoryId field', () => {
      const modernBudgetDTO: BudgetDTO = {
        id: '1',
        categoryId: 'groceries', // Modern field name
        amount: 500,
        period: 'monthly',
        isActive: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        spent: 0,
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      const result = budgetFromDTO(modernBudgetDTO);

      expect(result.categoryId).toBe('groceries');
      expect(result.id).toBe('1');
      expect(result.amount).toBe(500);
    });

    it('should prioritize categoryId over category when both are present', () => {
      const conflictingBudgetDTO = {
        id: '1',
        category: 'old-value', // Legacy field
        categoryId: 'new-value', // Modern field should take priority
        amount: 500,
        period: 'monthly' as const,
        isActive: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        spent: 0,
        updatedAt: '2023-01-01T00:00:00.000Z',
      } as any;

      const result = budgetFromDTO(conflictingBudgetDTO);

      expect(result.categoryId).toBe('new-value'); // Should use categoryId, not category
    });

    it('should handle date conversion correctly', () => {
      const budgetDTO: BudgetDTO = {
        id: '1',
        categoryId: 'groceries',
        amount: 500,
        period: 'monthly',
        isActive: true,
        createdAt: '2023-01-01T12:30:45.123Z',
        spent: 0,
        updatedAt: '2023-01-02T08:15:30.456Z',
      };

      const result = budgetFromDTO(budgetDTO);

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.createdAt.getTime()).toBe(new Date('2023-01-01T12:30:45.123Z').getTime());
      expect(result.updatedAt?.getTime()).toBe(new Date('2023-01-02T08:15:30.456Z').getTime());
    });
  });

  describe('budgetToDTO', () => {
    it('should convert Budget to DTO with proper date strings', () => {
      const budget = {
        id: '1',
        categoryId: 'groceries',
        amount: 500,
        period: 'monthly' as const,
        isActive: true,
        createdAt: new Date('2023-01-01T12:30:45.123Z'),
        spent: 0,
        updatedAt: new Date('2023-01-02T08:15:30.456Z'),
      };

      const result = budgetToDTO(budget);

      expect(result.categoryId).toBe('groceries');
      expect(result.createdAt).toBe('2023-01-01T12:30:45.123Z');
      expect(result.updatedAt).toBe('2023-01-02T08:15:30.456Z');
    });
  });
});