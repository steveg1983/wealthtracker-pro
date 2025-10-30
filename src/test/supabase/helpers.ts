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

export async function cleanupProfile(userId: string) {
  if (!supabaseService) return;
  await supabaseService.from('transactions').delete().eq('user_id', userId);
  await supabaseService.from('accounts').delete().eq('user_id', userId);
  await supabaseService.from('users').delete().eq('id', userId);
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

export async function tryDeleteTransactionAsAnon(id: string) {
  const { error } = await supabaseAnon
    .from('transactions')
    .delete()
    .eq('id', id);
  return error;
}
