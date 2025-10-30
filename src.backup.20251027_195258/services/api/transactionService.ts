import { supabase, isSupabaseConfigured, handleSupabaseError } from '@wealthtracker/core';
import type { Transaction } from '../../types';
import type { Database, Json } from '@app-types/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { logger } from '../loggingService';

type TransactionsTable = Database['public']['Tables']['transactions'];
type TransactionRow = TransactionsTable['Row'];
type TransactionInsert = TransactionsTable['Insert'];
type TransactionUpdate = TransactionsTable['Update'];

type TransactionCreateInput = Omit<Transaction, 'id'> & { id?: string };

type ParsedMetadata = {
  categoryName?: string;
  reconciledWith?: string;
  reconciledNotes?: string;
  reconciledDate?: Date;
  bankReference?: string;
  paymentChannel?: string;
  merchant?: string;
  accountName?: string;
  goalId?: string;
  addedBy?: string;
  pending?: boolean;
  cleared?: boolean;
  isSplit?: boolean;
  isImported?: boolean;
  location?: Transaction['location'];
  transferMetadata?: Transaction['transferMetadata'];
  investmentData?: Transaction['investmentData'];
};

const toBoolean = (value: Json | undefined): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
};

const toNumber = (value: Json | undefined): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toDateOrUndefined = (value: Json | undefined): Date | undefined => {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
};

const parseTransferMetadata = (metadata: Json | undefined): Transaction['transferMetadata'] | undefined => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const raw = metadata as Record<string, Json>;

  const transferMetadata: Transaction['transferMetadata'] = {};

  const assignString = (key: keyof NonNullable<Transaction['transferMetadata']>) => {
    const value = raw[key as string];
    if (typeof value === 'string') {
      transferMetadata[key] = value as never;
    }
  };

  assignString('transferType');
  assignString('transferPurpose');
  assignString('originalCurrency');
  assignString('assetType');
  assignString('scheduleId');
  assignString('approvedBy');
  assignString('reference');
  assignString('taxImplications');
  assignString('reconciliationStatus');
  assignString('reconciliationNotes');

  const assignNumber = (key: keyof NonNullable<Transaction['transferMetadata']>) => {
    const value = toNumber(raw[key as string]);
    if (value !== undefined) {
      transferMetadata[key] = value as never;
    }
  };

  assignNumber('fees');
  assignNumber('exchangeRate');
  assignNumber('originalAmount');
  assignNumber('units');
  assignNumber('pricePerUnit');
  assignNumber('marketValue');
  assignNumber('costBasis');
  assignNumber('expectedAmount');
  assignNumber('actualAmount');
  assignNumber('discrepancy');

  const assignBoolean = (key: keyof NonNullable<Transaction['transferMetadata']>) => {
    const value = toBoolean(raw[key as string]);
    if (value !== undefined) {
      transferMetadata[key] = value as never;
    }
  };

  assignBoolean('isScheduled');

  const assignDate = (key: keyof NonNullable<Transaction['transferMetadata']>) => {
    const value = toDateOrUndefined(raw[key as string]);
    if (value) {
      transferMetadata[key] = value as never;
    }
  };

  assignDate('initiatedDate');
  assignDate('settlementDate');
  assignDate('approvalDate');

  const documentation = raw.documentation;
  if (Array.isArray(documentation)) {
    const docs = documentation.filter((item): item is string => typeof item === 'string');
    if (docs.length > 0) {
      transferMetadata.documentation = docs;
    }
  }

  return Object.keys(transferMetadata).length > 0 ? transferMetadata : undefined;
};

const parseInvestmentMetadata = (metadata: Json | undefined): Transaction['investmentData'] | undefined => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const raw = metadata as Record<string, Json>;
  const investmentMetadata: Transaction['investmentData'] = {};

  const assignString = (key: keyof NonNullable<Transaction['investmentData']>) => {
    const value = raw[key as string];
    if (typeof value === 'string') {
      investmentMetadata[key] = value as never;
    }
  };

  assignString('symbol');

  const assignNumber = (key: keyof NonNullable<Transaction['investmentData']>) => {
    const value = toNumber(raw[key as string]);
    if (value !== undefined) {
      investmentMetadata[key] = value as never;
    }
  };

  assignNumber('quantity');
  assignNumber('pricePerShare');
  assignNumber('transactionFee');
  assignNumber('stampDuty');
  assignNumber('totalCost');

  return Object.keys(investmentMetadata).length > 0 ? investmentMetadata : undefined;
};

const parseLocationMetadata = (metadata: Json | undefined): Transaction['location'] | undefined => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const raw = metadata as Record<string, Json>;
  const location = {
    city: typeof raw.city === 'string' ? raw.city : null,
    region: typeof raw.region === 'string' ? raw.region : null,
    country: typeof raw.country === 'string' ? raw.country : null,
  };

  if (!location.city && !location.region && !location.country) {
    return undefined;
  }

  return location;
};

const parseMetadata = (metadata: TransactionRow['metadata']): ParsedMetadata => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const raw = metadata as Record<string, Json>;

  const parsed: ParsedMetadata = {};

  if (typeof raw.categoryName === 'string') parsed.categoryName = raw.categoryName;
  if (typeof raw.reconciledWith === 'string') parsed.reconciledWith = raw.reconciledWith;
  if (typeof raw.reconciledNotes === 'string') parsed.reconciledNotes = raw.reconciledNotes;

  const reconciledDate = toDateOrUndefined(raw.reconciledDate);
  if (reconciledDate) parsed.reconciledDate = reconciledDate;

  if (typeof raw.bankReference === 'string') parsed.bankReference = raw.bankReference;
  if (typeof raw.paymentChannel === 'string') parsed.paymentChannel = raw.paymentChannel;
  if (typeof raw.merchant === 'string') parsed.merchant = raw.merchant;
  if (typeof raw.accountName === 'string') parsed.accountName = raw.accountName;
  if (typeof raw.goalId === 'string') parsed.goalId = raw.goalId;
  if (typeof raw.addedBy === 'string') parsed.addedBy = raw.addedBy;

  const pending = toBoolean(raw.pending);
  if (pending !== undefined) parsed.pending = pending;

  const cleared = toBoolean(raw.cleared);
  if (cleared !== undefined) parsed.cleared = cleared;

  const isSplit = toBoolean(raw.isSplit);
  if (isSplit !== undefined) parsed.isSplit = isSplit;

  const isImported = toBoolean(raw.isImported);
  if (isImported !== undefined) parsed.isImported = isImported;

  const location = parseLocationMetadata(raw.location);
  if (location) parsed.location = location;

  const transferMetadata = parseTransferMetadata(raw.transferMetadata);
  if (transferMetadata) parsed.transferMetadata = transferMetadata;

  const investmentData = parseInvestmentMetadata(raw.investmentData);
  if (investmentData) parsed.investmentData = investmentData;

  return parsed;
};

const serialiseTransferMetadata = (metadata: Transaction['transferMetadata'] | undefined): Json | undefined => {
  if (!metadata) return undefined;

  const result: Record<string, Json> = {};

  if (metadata.transferType) result.transferType = metadata.transferType;
  if (metadata.transferPurpose) result.transferPurpose = metadata.transferPurpose;
  if (metadata.fees !== undefined) result.fees = metadata.fees;
  if (metadata.feesCurrency) result.feesCurrency = metadata.feesCurrency;
  if (metadata.exchangeRate !== undefined) result.exchangeRate = metadata.exchangeRate;
  if (metadata.originalAmount !== undefined) result.originalAmount = metadata.originalAmount;
  if (metadata.originalCurrency) result.originalCurrency = metadata.originalCurrency;
  if (metadata.assetType) result.assetType = metadata.assetType;
  if (metadata.units !== undefined) result.units = metadata.units;
  if (metadata.pricePerUnit !== undefined) result.pricePerUnit = metadata.pricePerUnit;
  if (metadata.marketValue !== undefined) result.marketValue = metadata.marketValue;
  if (metadata.costBasis !== undefined) result.costBasis = metadata.costBasis;
  if (metadata.initiatedDate) result.initiatedDate = metadata.initiatedDate.toISOString();
  if (metadata.settlementDate) result.settlementDate = metadata.settlementDate.toISOString();
  if (metadata.isScheduled !== undefined) result.isScheduled = metadata.isScheduled;
  if (metadata.scheduleId) result.scheduleId = metadata.scheduleId;
  if (metadata.approvedBy) result.approvedBy = metadata.approvedBy;
  if (metadata.approvalDate) result.approvalDate = metadata.approvalDate.toISOString();
  if (metadata.reference) result.reference = metadata.reference;
  if (metadata.documentation) result.documentation = metadata.documentation;
  if (metadata.taxImplications) result.taxImplications = metadata.taxImplications;
  if (metadata.expectedAmount !== undefined) result.expectedAmount = metadata.expectedAmount;
  if (metadata.actualAmount !== undefined) result.actualAmount = metadata.actualAmount;
  if (metadata.discrepancy !== undefined) result.discrepancy = metadata.discrepancy;
  if (metadata.reconciliationStatus) result.reconciliationStatus = metadata.reconciliationStatus;
  if (metadata.reconciliationNotes) result.reconciliationNotes = metadata.reconciliationNotes;

  return Object.keys(result).length > 0 ? result : undefined;
};

const serialiseInvestmentMetadata = (metadata: Transaction['investmentData'] | undefined): Json | undefined => {
  if (!metadata) return undefined;

  const result: Record<string, Json> = {};

  if (metadata.symbol) result.symbol = metadata.symbol;
  if (metadata.quantity !== undefined) result.quantity = metadata.quantity;
  if (metadata.pricePerShare !== undefined) result.pricePerShare = metadata.pricePerShare;
  if (metadata.transactionFee !== undefined) result.transactionFee = metadata.transactionFee;
  if (metadata.stampDuty !== undefined) result.stampDuty = metadata.stampDuty;
  if (metadata.totalCost !== undefined) result.totalCost = metadata.totalCost;

  return Object.keys(result).length > 0 ? result : undefined;
};

const serialiseLocationMetadata = (location: Transaction['location'] | undefined): Json | undefined => {
  if (!location) return undefined;

  return {
    city: location.city ?? null,
    region: location.region ?? null,
    country: location.country ?? null,
  } satisfies Json;
};

const buildTransactionMetadata = (transaction: Partial<Transaction>): Json | undefined => {
  const metadata: Record<string, Json> = {};

  const assignString = (key: keyof ParsedMetadata, value?: string) => {
    if (value) metadata[key as string] = value;
  };

  assignString('categoryName', transaction.categoryName);
  assignString('reconciledWith', transaction.reconciledWith);
  assignString('reconciledNotes', transaction.reconciledNotes);
  assignString('bankReference', transaction.bankReference);
  assignString('paymentChannel', transaction.paymentChannel);
  assignString('merchant', transaction.merchant);
  assignString('accountName', transaction.accountName);
  assignString('goalId', transaction.goalId);
  assignString('addedBy', transaction.addedBy);

  if (transaction.reconciledDate) {
    metadata.reconciledDate = transaction.reconciledDate.toISOString();
  }

  const assignBoolean = (key: keyof ParsedMetadata, value?: boolean) => {
    if (value !== undefined) metadata[key as string] = value;
  };

  assignBoolean('pending', transaction.pending);
  assignBoolean('cleared', transaction.cleared);
  assignBoolean('isSplit', transaction.isSplit);
  assignBoolean('isImported', transaction.isImported);

  const locationMetadata = serialiseLocationMetadata(transaction.location);
  if (locationMetadata) metadata.location = locationMetadata as Json;

  const transferMetadata = serialiseTransferMetadata(transaction.transferMetadata);
  if (transferMetadata) metadata.transferMetadata = transferMetadata as Json;

  const investmentMetadata = serialiseInvestmentMetadata(transaction.investmentData);
  if (investmentMetadata) metadata.investmentData = investmentMetadata as Json;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

const mapTransactionRowToDomain = (row: TransactionRow): Transaction => {
  const metadata = parseMetadata(row.metadata);

  const transaction: Transaction = {
    id: row.id,
    date: new Date(row.date),
    amount: row.amount,
    description: row.description,
    category: row.category_id ?? '',
    accountId: row.account_id,
    type: row.type ?? 'expense',
  };

  if (row.tags && row.tags.length > 0) transaction.tags = [...row.tags];
  if (row.notes) transaction.notes = row.notes;
  if (row.is_recurring !== null && row.is_recurring !== undefined) {
    transaction.isRecurring = row.is_recurring;
  }
  if (row.recurring_template_id) {
    transaction.recurringTransactionId = row.recurring_template_id;
  }
  if (row.transfer_account_id) {
    transaction.linkedTransferId = row.transfer_account_id;
  }

  if (metadata.categoryName) transaction.categoryName = metadata.categoryName;
  if (metadata.reconciledWith) transaction.reconciledWith = metadata.reconciledWith;
  if (metadata.reconciledNotes) transaction.reconciledNotes = metadata.reconciledNotes;
  if (metadata.reconciledDate) transaction.reconciledDate = metadata.reconciledDate;
  if (metadata.bankReference) transaction.bankReference = metadata.bankReference;
  if (metadata.paymentChannel) transaction.paymentChannel = metadata.paymentChannel;
  if (metadata.merchant) transaction.merchant = metadata.merchant;
  if (metadata.accountName) transaction.accountName = metadata.accountName;
  if (metadata.goalId) transaction.goalId = metadata.goalId;
  if (metadata.addedBy) transaction.addedBy = metadata.addedBy;
  if (metadata.pending !== undefined) transaction.pending = metadata.pending;
  if (metadata.cleared !== undefined) transaction.cleared = metadata.cleared;
  if (metadata.isSplit !== undefined) transaction.isSplit = metadata.isSplit;
  if (metadata.isImported !== undefined) transaction.isImported = metadata.isImported;
  if (metadata.location) transaction.location = metadata.location;
  if (metadata.transferMetadata) transaction.transferMetadata = metadata.transferMetadata;
  if (metadata.investmentData) transaction.investmentData = metadata.investmentData;

  return transaction;
};

const normaliseTransactionInput = (transaction: TransactionCreateInput): TransactionCreateInput => ({
  ...transaction,
  description: transaction.description ?? '',
  category: transaction.category ?? '',
  tags: transaction.tags ?? [],
});

const buildTransactionInsert = (
  userId: string,
  transaction: TransactionCreateInput
): TransactionInsert => {
  const metadata = buildTransactionMetadata(transaction);

  const insert: TransactionInsert = {
    user_id: userId,
    account_id: transaction.accountId,
    category_id: transaction.category,
    description: transaction.description,
    amount: transaction.amount,
    type: transaction.type,
    date: transaction.date instanceof Date ? transaction.date.toISOString() : new Date(transaction.date).toISOString(),
    notes: transaction.notes ?? null,
    tags: transaction.tags ?? [],
    is_recurring: transaction.isRecurring ?? false,
    recurring_template_id: transaction.recurringTransactionId ?? null,
    transfer_account_id: transaction.linkedTransferId ?? null,
  };

  if (metadata) {
    insert.metadata = metadata;
  }

  return insert;
};

const buildTransactionUpdate = (updates: Partial<Transaction>): TransactionUpdate => {
  const payload: TransactionUpdate = {};

  if (updates.accountId !== undefined) payload.account_id = updates.accountId;
  if (updates.category !== undefined) payload.category_id = updates.category;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.type !== undefined) payload.type = updates.type;
  if (updates.date !== undefined) {
    payload.date = updates.date instanceof Date ? updates.date.toISOString() : new Date(updates.date).toISOString();
  }
  if (updates.notes !== undefined) payload.notes = updates.notes ?? null;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.isRecurring !== undefined) payload.is_recurring = updates.isRecurring;
  if (updates.recurringTransactionId !== undefined) {
    payload.recurring_template_id = updates.recurringTransactionId ?? null;
  }
  if (updates.linkedTransferId !== undefined) {
    payload.transfer_account_id = updates.linkedTransferId ?? null;
  }

  const metadata = buildTransactionMetadata(updates);
  if (metadata) {
    payload.metadata = metadata;
  }

  return payload;
};

const ensureSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }
  return supabase;
};

const createLocalTransaction = async (
  transaction: TransactionCreateInput
): Promise<Transaction> => {
  const localTransaction: Transaction = {
    ...transaction,
    id: transaction.id ?? crypto.randomUUID(),
    date: transaction.date instanceof Date ? transaction.date : new Date(transaction.date),
  };

  const existing = (await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS)) || [];
  existing.push(localTransaction);
  await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, existing);

  return localTransaction;
};

export class TransactionService {
  static async getTransactions(userId: string): Promise<Transaction[]> {
    if (!isSupabaseConfigured()) {
      const stored = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS);
      return stored ?? [];
    }

    const client = ensureSupabase();

    try {
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map(mapTransactionRowToDomain);
    } catch (error) {
      logger.error('TransactionService.getTransactions error', error);
      const stored = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS);
      return stored ?? [];
    }
  }

  static async createTransaction(userId: string, rawTransaction: TransactionCreateInput): Promise<Transaction> {
    if (!isSupabaseConfigured()) {
      return createLocalTransaction(rawTransaction);
    }

    const client = ensureSupabase();
    const transaction = normaliseTransactionInput(rawTransaction);

    try {
      const insertPayload = buildTransactionInsert(userId, transaction);

      const { data, error } = await client
        .from('transactions')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        throw new Error(handleSupabaseError(error));
      }

      if (!data) {
        throw new Error('Transaction creation returned no data');
      }

      await this.updateAccountBalance(transaction.accountId, transaction.amount);

      return mapTransactionRowToDomain(data);
    } catch (error) {
      logger.error('TransactionService.createTransaction error', error);
      throw error;
    }
  }

  static async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    if (!isSupabaseConfigured()) {
      const transactions = (await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS)) || [];
      const index = transactions.findIndex((transaction) => transaction.id === id);

      if (index === -1) {
        throw new Error('Transaction not found');
      }

      const next: Transaction = {
        ...transactions[index]!,
        ...updates,
      };

      transactions[index] = next;
      await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, transactions);

      return next;
    }

    const client = ensureSupabase();

    try {
      const { data: previous, error: fetchError } = await client
        .from('transactions')
        .select('amount, account_id')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const payload = buildTransactionUpdate(updates);

      const { data, error } = await client
        .from('transactions')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(handleSupabaseError(error));
      }

      if (!data) {
        throw new Error('Transaction update returned no data');
      }

      if (previous && updates.amount !== undefined && updates.amount !== previous.amount) {
        const difference = updates.amount - previous.amount;
        await this.updateAccountBalance(previous.account_id, difference);
      }

      return mapTransactionRowToDomain(data);
    } catch (error) {
      logger.error('TransactionService.updateTransaction error', error);
      throw error;
    }
  }

  static async deleteTransaction(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      const transactions = (await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS)) || [];
      const remaining = transactions.filter((transaction) => transaction.id !== id);
      await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, remaining);
      return;
    }

    const client = ensureSupabase();

    try {
      const { data: existing } = await client
        .from('transactions')
        .select('amount, account_id')
        .eq('id', id)
        .single();

      const { error } = await client
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(handleSupabaseError(error));
      }

      if (existing) {
        await this.updateAccountBalance(existing.account_id, -existing.amount);
      }
    } catch (error) {
      logger.error('TransactionService.deleteTransaction error', error);
      throw error;
    }
  }

  static async getTransactionsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Transaction[]> {
    if (!isSupabaseConfigured()) {
      const transactions = (await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS)) || [];
      return transactions.filter((transaction) => {
        const date = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
        return date >= startDate && date <= endDate;
      });
    }

    const client = ensureSupabase();

    try {
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map(mapTransactionRowToDomain);
    } catch (error) {
      logger.error('TransactionService.getTransactionsByDateRange error', error);
      throw error;
    }
  }

  static async getTransactionsByAccount(accountId: string): Promise<Transaction[]> {
    if (!isSupabaseConfigured()) {
      const transactions = (await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS)) || [];
      return transactions.filter((transaction) => transaction.accountId === accountId);
    }

    const client = ensureSupabase();

    try {
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map(mapTransactionRowToDomain);
    } catch (error) {
      logger.error('TransactionService.getTransactionsByAccount error', error);
      throw error;
    }
  }

  static async getTransactionsByCategory(categoryId: string): Promise<Transaction[]> {
    if (!isSupabaseConfigured()) {
      const transactions = (await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS)) || [];
      return transactions.filter((transaction) => transaction.category === categoryId);
    }

    const client = ensureSupabase();

    try {
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('category_id', categoryId)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map(mapTransactionRowToDomain);
    } catch (error) {
      logger.error('TransactionService.getTransactionsByCategory error', error);
      throw error;
    }
  }

  static async bulkCreateTransactions(
    userId: string,
    rawTransactions: TransactionCreateInput[]
  ): Promise<Transaction[]> {
    if (!isSupabaseConfigured()) {
      const stored = (await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS)) || [];
      const created = rawTransactions.map((transaction) => ({
        ...transaction,
        id: transaction.id ?? crypto.randomUUID(),
        date: transaction.date instanceof Date ? transaction.date : new Date(transaction.date),
      }));
      stored.push(...created);
      await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, stored);
      return created;
    }

    const client = ensureSupabase();

    try {
      const inserts = rawTransactions.map((transaction) =>
        buildTransactionInsert(userId, normaliseTransactionInput(transaction))
      );

      const { data, error } = await client
        .from('transactions')
        .insert(inserts)
        .select();

      if (error) {
        throw new Error(handleSupabaseError(error));
      }

      if (!data) {
        return [];
      }

      for (const row of data) {
        await this.updateAccountBalance(row.account_id, row.amount);
      }

      return data.map(mapTransactionRowToDomain);
    } catch (error) {
      logger.error('TransactionService.bulkCreateTransactions error', error);
      throw error;
    }
  }

  private static async updateAccountBalance(accountId: string, amount: number): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }

    const client = ensureSupabase();

    try {
      const { data } = await client
        .from('accounts')
        .select('balance')
        .eq('id', accountId)
        .single();

      if (!data) {
        return;
      }

      const newBalance = (data.balance ?? 0) + amount;

      await client
        .from('accounts')
        .update({ balance: newBalance })
        .eq('id', accountId);
    } catch (error) {
      logger.error('TransactionService.updateAccountBalance error', error);
    }
  }

  static subscribeToTransactions(
    userId: string,
    callback: (payload: RealtimePostgresChangesPayload<TransactionRow>) => void
  ): () => void {
    if (!isSupabaseConfigured()) {
      return () => {};
    }

    const client = ensureSupabase();

    const channel = client
      .channel(`transactions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }
}
