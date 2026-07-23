import { supabaseService, supabaseAnon } from './client';
import { faker } from '@faker-js/faker';

export async function ensureProfile() {
  if (!supabaseService) {
    throw new Error('[supabase-smoke] Service role key required to seed data');
  }

  const userId = faker.string.uuid();
  const email = faker.internet.email();

  const { data, error } = await supabaseService
    .from('users')
    .insert({
      id: userId,
      clerk_id: `smoke_${userId}`,
      email,
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove the fixture user and everything it owns.
 *
 * This runs against a REAL database — the same one that holds real accounts —
 * so a delete that quietly fails leaves a synthetic user, account and
 * transactions sitting in production for good. That is exactly what happened
 * on 2026-07-20: the residue was found three days later during an unrelated
 * audit, because the three deletes below ignored their errors. Each one is now
 * checked, and the tables are re-read to confirm the rows are actually gone.
 */
export async function cleanupProfile(userId: string) {
  if (!supabaseService) return;

  for (const [table, column] of [
    ['transactions', 'user_id'],
    ['accounts', 'user_id'],
    ['users', 'id'],
  ] as const) {
    const { error } = await supabaseService.from(table).delete().eq(column, userId);
    if (error) {
      throw new Error(`[supabase-smoke] failed to clean up ${table} for ${userId}: ${error.message}`);
    }
  }

  for (const [table, column] of [
    ['transactions', 'user_id'],
    ['accounts', 'user_id'],
    ['users', 'id'],
  ] as const) {
    const { data, error } = await supabaseService.from(table).select('id').eq(column, userId);
    if (error) {
      throw new Error(`[supabase-smoke] could not verify ${table} cleanup for ${userId}: ${error.message}`);
    }
    if ((data ?? []).length > 0) {
      throw new Error(
        `[supabase-smoke] ${(data ?? []).length} row(s) survived cleanup in ${table} for ${userId} — ` +
        'left behind in a real database. Remove them before this suite is trusted again.'
      );
    }
  }
}

export async function createAccount(userId: string) {
  if (!supabaseService) throw new Error('Service role required');
  const { data, error } = await supabaseService
    .from('accounts')
    .insert({
      user_id: userId,
      name: 'Smoke Test Account',
      type: 'checking',
      balance: 0,
      currency: 'USD',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function recordTransaction(userId: string, accountId: string) {
  if (!supabaseService) throw new Error('Service role required');
  const { data, error } = await supabaseService
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: accountId,
      amount: 123.45,
      description: 'Smoke Test Transaction',
      category_id: null,
      type: 'expense',
      date: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTransactionsAsUser(userId: string) {
  const { data, error } = await supabaseAnon
    .from('transactions')
    .select()
    .eq('user_id', userId);
  if (error) throw error;
  return data;
}

export async function fetchTransactionByIdService(id: string) {
  if (!supabaseService) {
    throw new Error('Service role required');
  }

  const { data, error } = await supabaseService
    .from('transactions')
    .select()
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function tryDeleteTransactionAsAnon(id: string) {
  const { data, error } = await supabaseAnon
    .from('transactions')
    .delete()
    .eq('id', id)
    .select('id');

  return { data, error };
}
