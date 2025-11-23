import { supabase } from '../../lib/supabase';
import { createScopedLogger } from '../../loggers/scopedLogger';
import type { RecurringTransaction } from '../../types';

type RecurringRow = {
  id: string;
  description?: string | null;
  amount?: number;
  type?: RecurringTransaction['type'];
  category?: string | null;
  account_id?: string | null;
  frequency?: RecurringTransaction['frequency'];
  interval?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  next_date?: string | null;
  last_processed?: string | null;
  is_active?: boolean | null;
  tags?: string[] | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const mapRecurring = (row: RecurringRow): RecurringTransaction => ({
  id: row.id,
  description: row.description ?? '',
  amount: Number(row.amount ?? 0),
  type: row.type ?? 'expense',
  category: row.category ?? '',
  accountId: row.account_id ?? '',
  frequency: row.frequency ?? 'monthly',
  interval: row.interval ?? 1,
  startDate: row.start_date ? new Date(row.start_date) : new Date(),
  endDate: row.end_date ? new Date(row.end_date) : undefined,
  nextDate: row.next_date ? new Date(row.next_date) : new Date(),
  lastProcessed: row.last_processed ? new Date(row.last_processed) : undefined,
  isActive: row.is_active ?? true,
  tags: row.tags ?? undefined,
  notes: row.notes ?? undefined,
  createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  updatedAt: row.updated_at ? new Date(row.updated_at) : new Date()
});

const logger = createScopedLogger('RecurringTransactionService');

export const RecurringTransactionService = {
  async getRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('getRecurringTransactions failed', error);
      return [];
    }

    return (data ?? []).map(mapRecurring);
  },

  async createRecurringTransaction(
    userId: string,
    transaction: Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RecurringTransaction> {
    if (!supabase) throw new Error('Supabase client not configured');
    const payload = {
      user_id: userId,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      account_id: transaction.accountId,
      frequency: transaction.frequency,
      interval: transaction.interval ?? 1,
      start_date: transaction.startDate ?? new Date(),
      end_date: transaction.endDate ?? null,
      next_date: transaction.nextDate ?? transaction.startDate ?? new Date(),
      is_active: transaction.isActive ?? true,
      tags: transaction.tags ?? null,
      notes: transaction.notes ?? null
    };

    const { data, error } = await supabase
      .from('recurring_transactions')
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to create recurring transaction');
    }

    return mapRecurring(data);
  },

  async updateRecurringTransaction(
    id: string,
    updates: Partial<RecurringTransaction>
  ): Promise<RecurringTransaction> {
    if (!supabase) throw new Error('Supabase client not configured');

    const payload = {
      description: updates.description,
      amount: updates.amount,
      type: updates.type,
      category: updates.category,
      account_id: updates.accountId,
      frequency: updates.frequency,
      interval: updates.interval,
      start_date: updates.startDate,
      end_date: updates.endDate ?? null,
      next_date: updates.nextDate,
      last_processed: updates.lastProcessed ?? null,
      is_active: updates.isActive,
      tags: updates.tags ?? null,
      notes: updates.notes ?? null
    };

    const { data, error } = await supabase
      .from('recurring_transactions')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to update recurring transaction');
    }

    return mapRecurring(data);
  },

  async deleteRecurringTransaction(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client not configured');
    const { error } = await supabase
      .from('recurring_transactions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
};
