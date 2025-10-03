import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DataMigrationService } from '../dataMigrationService'
import type { Budget } from '../../types'

// Mock supabase client used by DataMigrationService
const insertSpy = vi.fn()
const fromSpy = vi.fn()

vi.mock('../../lib/supabase', () => {
  // Chain: supabase.from('budgets').insert(payload).select()
  const select = () => ({ data: [{ id: 'new-budget' }], error: null })
  insertSpy.mockReturnValue({ select })
  fromSpy.mockImplementation(() => ({ insert: insertSpy }))
  return {
    supabase: {
      from: fromSpy,
    },
  }
})

describe('DataMigrationService.migrateBudgets', () => {
  beforeEach(() => {
    insertSpy.mockClear()
    fromSpy.mockClear()
  })

  it('writes category_id (from categoryId) when migrating budgets', async () => {
    const userId = 'user-123'
    const budget: Budget = {
      id: 'b1',
      name: undefined,
      categoryId: 'groceries',
      amount: 500,
      period: 'monthly',
      isActive: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
      spent: 0,
    }

    const ok = await DataMigrationService.migrateBudgets(userId, [budget])

    expect(ok).toBe(true)
    expect(fromSpy).toHaveBeenCalledWith('budgets')
    expect(insertSpy).toHaveBeenCalledTimes(1)

    const payloadArg = insertSpy.mock.calls[0][0]
    expect(Array.isArray(payloadArg)).toBe(true)
    const record = payloadArg[0]

    // Ensure category_id is present and equals budget.categoryId
    expect(record.category_id).toBe('groceries')
    // Ensure the legacy field is not used
    expect('category' in record).toBe(false)
    // Name should fallback to categoryId when unset
    expect(record.name).toBe('groceries')
  })
})

