import { supabase } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import type { Account } from '../../types';
import type { Database, Json } from '../../types/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '../loggingService';

type AccountsTable = Database['public']['Tables']['accounts'];
type AccountRow = AccountsTable['Row'];
type AccountInsert = AccountsTable['Insert'];
type AccountUpdate = AccountsTable['Update'];

type AccountCreateInput = Omit<Account, 'id' | 'lastUpdated' | 'updatedAt'> & {
  lastUpdated?: Date;
  updatedAt?: Date;
};

const ACCOUNT_TYPE_MAP: Record<Account['type'], AccountInsert['type']> = {
  current: 'checking',
  savings: 'savings',
  credit: 'credit',
  loan: 'other',
  investment: 'investment',
  asset: 'other',
  assets: 'other',
  mortgage: 'other',
  other: 'other',
  checking: 'checking',
};

const mapAccountTypeToDomain = (type: AccountRow['type']): Account['type'] => {
  switch (type) {
    case 'checking':
      return 'current';
    case 'savings':
      return 'savings';
    case 'credit':
      return 'credit';
    case 'cash':
      return 'asset';
    case 'investment':
      return 'investment';
    default:
      return 'other';
  }
};

const mapAccountTypeToSupabase = (type: Account['type']): AccountInsert['type'] =>
  ACCOUNT_TYPE_MAP[type] ?? 'other';

const parseDate = (value: string | null | undefined): Date | undefined =>
  value ? new Date(value) : undefined;

const parseMetadata = (metadata: AccountRow['metadata']): { tags?: string[] } => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const entries = metadata as Record<string, Json>;
  const rawTags = entries.tags;

  if (Array.isArray(rawTags)) {
    const tags = rawTags.filter((item): item is string => typeof item === 'string');
    if (tags.length > 0) {
      return { tags };
    }
  }

  return {};
};

const mapAccountRowToDomain = (row: AccountRow): Account => {
  const metadata = parseMetadata(row.metadata);
  const updatedAt = parseDate(row.updated_at);
  const createdAt = parseDate(row.created_at);
  const lastUpdated = updatedAt ?? createdAt ?? new Date();

  const account: Account = {
    id: row.id,
    name: row.name,
    type: mapAccountTypeToDomain(row.type),
    balance: row.balance ?? 0,
    currency: row.currency ?? 'GBP',
    lastUpdated,
  };

  if (row.institution) account.institution = row.institution;
  if (row.initial_balance !== null && row.initial_balance !== undefined) {
    account.openingBalance = row.initial_balance;
  }
  if (row.account_number) account.accountNumber = row.account_number;
  if (row.sort_code) account.sortCode = row.sort_code;
  if (metadata.tags) account.tags = metadata.tags;
  if (updatedAt) account.updatedAt = updatedAt;
  if (row.is_active !== undefined) account.isActive = row.is_active;

  return account;
};

const buildAccountInsert = (
  userId: string,
  account: AccountCreateInput
): AccountInsert => {
  const nowIso = new Date().toISOString();
  const metadata: Json | undefined = account.tags && account.tags.length > 0
    ? { tags: account.tags }
    : undefined;

  const insert: AccountInsert = {
    user_id: userId,
    name: account.name,
    type: mapAccountTypeToSupabase(account.type),
    currency: account.currency,
    balance: account.balance,
    initial_balance: account.openingBalance ?? account.balance,
    is_active: account.isActive ?? true,
    institution: account.institution ?? null,
    account_number: account.accountNumber ?? null,
    sort_code: account.sortCode ?? null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  if (metadata) {
    insert.metadata = metadata;
  }

  return insert;
};

const buildAccountUpdate = (updates: Partial<Account>): AccountUpdate => {
  const payload: AccountUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.type !== undefined) payload.type = mapAccountTypeToSupabase(updates.type);
  if (updates.balance !== undefined) payload.balance = updates.balance;
  if (updates.currency !== undefined) payload.currency = updates.currency;
  if (updates.openingBalance !== undefined) payload.initial_balance = updates.openingBalance;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  if (updates.institution !== undefined) payload.institution = updates.institution ?? null;
  if (updates.accountNumber !== undefined) payload.account_number = updates.accountNumber ?? null;
  if (updates.sortCode !== undefined) payload.sort_code = updates.sortCode ?? null;

  if (updates.tags !== undefined) {
    const tags = updates.tags;
    payload.metadata = { tags };
  }

  return payload;
};

const ensureSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }
  return supabase;
};

const normaliseAccountInput = (account: AccountCreateInput): AccountCreateInput => ({
  ...account,
  balance: account.balance ?? 0,
  currency: account.currency ?? 'GBP',
  type: account.type ?? 'other',
});

const createLocalAccount = async (account: AccountCreateInput): Promise<Account> => {
  const now = new Date();
  const localAccount: Account = {
    ...account,
    id: crypto.randomUUID(),
    lastUpdated: account.lastUpdated ?? now,
  };

  const accounts = (await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS)) || [];
  accounts.push(localAccount);
  await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);

  const categories = (await storageAdapter.get<Json[]>(STORAGE_KEYS.CATEGORIES)) || [];
  categories.push({
    id: crypto.randomUUID(),
    name: `To/From ${localAccount.name}`,
    type: 'both',
    level: 'detail',
    parentId: 'type-transfer',
    isSystem: false,
    isTransferCategory: true,
    accountId: localAccount.id,
    isActive: true,
  });
  await storageAdapter.set(STORAGE_KEYS.CATEGORIES, categories);

  return localAccount;
};

export async function createAccount(
  clerkId: string,
  rawAccount: AccountCreateInput
): Promise<Account> {
  const account = normaliseAccountInput(rawAccount);
  const client = supabase;

  try {
    if (!client) {
      throw new Error('Supabase not configured');
    }

    let userId = await userIdService.getDatabaseUserId(clerkId);
    if (!userId) {
      userId = await userIdService.ensureUserExists(clerkId, account.institution ?? '');
      if (!userId) {
        throw new Error('Unable to resolve database user ID');
      }
    }

    const insertPayload = buildAccountInsert(userId, account);

    const { data, error } = await client
      .from('accounts')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Account creation returned no data');
    }

    return mapAccountRowToDomain(data);
  } catch (error) {
    logger.error('[SimpleAccountService] createAccount fallback', error);
    return createLocalAccount(account);
  }
}

export async function getAccounts(userIdentifier: string): Promise<Account[]> {
  const client = supabase;

  try {
    if (!client) {
      throw new Error('Supabase not configured');
    }

    const userId = userIdentifier.startsWith('user_')
      ? await userIdService.getDatabaseUserId(userIdentifier)
      : userIdentifier;

    if (!userId) {
      return [];
    }

    const { data, error } = await client
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapAccountRowToDomain);
  } catch (error) {
    logger.warn('[SimpleAccountService] getAccounts fallback', error);
    const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS);
    return accounts ?? [];
  }
}

export async function updateAccount(
  accountId: string,
  updates: Partial<Account>
): Promise<Account> {
  const client = supabase;

  try {
    if (!client) {
      throw new Error('Supabase not configured');
    }

    const updatePayload = buildAccountUpdate(updates);

    const { data, error } = await client
      .from('accounts')
      .update(updatePayload)
      .eq('id', accountId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Account update returned no data');
    }

    return mapAccountRowToDomain(data);
  } catch (error) {
    logger.warn('[SimpleAccountService] updateAccount fallback', error);

    const accounts = (await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS)) || [];
    const index = accounts.findIndex((account) => account.id === accountId);

    if (index === -1) {
      throw new Error('Account not found');
    }

    const next: Account = {
      ...accounts[index]!,
      ...updates,
      lastUpdated: updates.lastUpdated ?? new Date(),
    };

    accounts[index] = next;
    await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);

    return next;
  }
}

export async function deleteAccount(accountId: string): Promise<void> {
  const client = supabase;

  try {
    if (!client) {
      throw new Error('Supabase not configured');
    }

    await client
      .from('categories')
      .update({ is_active: false })
      .eq('account_id', accountId)
      .eq('is_transfer_category', true);

    const { error } = await client
      .from('accounts')
      .delete()
      .eq('id', accountId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.warn('[SimpleAccountService] deleteAccount fallback', error);

    const accounts = (await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS)) || [];
    const remaining = accounts.filter((account) => account.id !== accountId);
    await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, remaining);

    const categories = (await storageAdapter.get<Json[]>(STORAGE_KEYS.CATEGORIES)) || [];
    const updatedCategories = categories.map((category) => {
      if (
        category &&
        typeof category === 'object' &&
        'accountId' in category &&
        'isTransferCategory' in category &&
        category.accountId === accountId &&
        category.isTransferCategory
      ) {
        return { ...category, isActive: false };
      }
      return category;
    });
    await storageAdapter.set(STORAGE_KEYS.CATEGORIES, updatedCategories);
  }
}

export async function subscribeToAccountChanges(
  clerkId: string,
  callback: (payload: RealtimePostgresChangesPayload<AccountRow>) => void
): Promise<() => void> {
  const client = supabase;

  if (!client) {
    return () => {};
  }

  try {
    const userId = await userIdService.getDatabaseUserId(clerkId);

    if (!userId) {
      return () => {};
    }

    const channel = client
      .channel(`accounts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (error) {
    logger.error('[SimpleAccountService] subscribeToAccountChanges error', error);
    return () => {};
  }
}
