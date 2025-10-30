import type { Database, Json } from '@app-types/supabase';
import type { Account, Transaction, Budget, Goal, Category } from '../types';
import { Decimal, toDecimal } from '@wealthtracker/utils';

type AccountsTable = Database['public']['Tables']['accounts'];
type TransactionsTable = Database['public']['Tables']['transactions'];
type BudgetsTable = Database['public']['Tables']['budgets'];
type GoalsTable = Database['public']['Tables']['goals'];
type CategoriesTable = Database['public']['Tables']['categories'];

export type AccountInsert = AccountsTable['Insert'];
export type AccountUpdate = AccountsTable['Update'];
export type TransactionInsert = TransactionsTable['Insert'];
export type TransactionUpdate = TransactionsTable['Update'];
export type BudgetInsert = BudgetsTable['Insert'];
export type BudgetUpdate = BudgetsTable['Update'];
export type BudgetRow = BudgetsTable['Row'];
export type GoalInsert = GoalsTable['Insert'];
export type GoalUpdate = GoalsTable['Update'];
export type GoalRow = GoalsTable['Row'];
export type CategoryInsert = CategoriesTable['Insert'];
export type CategoryUpdate = CategoriesTable['Update'];
export type CategoryRow = CategoriesTable['Row'];

export const toDate = (value: unknown, fallback: Date = new Date()): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
};

const normalizeAccountType = (type: Account['type']): AccountInsert['type'] => {
  switch (type) {
    case 'current':
    case 'checking':
      return 'checking';
    case 'savings':
      return 'savings';
    case 'credit':
      return 'credit';
    case 'investment':
      return 'investment';
    default:
      return 'other';
  }
};

const buildAccountMetadata = (account: Account): Json | undefined => {
  if (!account.tags || account.tags.length === 0) {
    return undefined;
  }

  return {
    tags: account.tags,
  };
};

export const buildAccountInsert = (account: Account, userId: string): AccountInsert => {
  const now = new Date();
  const metadata = buildAccountMetadata(account);

  const insert: AccountInsert = {
    id: account.id,
    user_id: userId,
    name: account.name,
    type: normalizeAccountType(account.type),
    balance: account.balance ?? 0,
    initial_balance: account.openingBalance ?? account.balance ?? 0,
    currency: account.currency ?? 'GBP',
    institution: account.institution ?? null,
    is_active: account.isActive !== false,
    account_number: account.accountNumber ?? null,
    sort_code: account.sortCode ?? null,
    created_at: now.toISOString(),
    updated_at: (account.lastUpdated ?? now).toISOString(),
  };

  if (metadata) {
    insert.metadata = metadata;
  }

  return insert;
};

export const buildAccountUpdate = (account: Account, userId: string): AccountUpdate => {
  const update: AccountUpdate = {
    id: account.id,
    user_id: userId,
    name: account.name,
    type: normalizeAccountType(account.type),
    balance: account.balance,
    currency: account.currency,
    institution: account.institution ?? null,
    is_active: account.isActive !== false,
    account_number: account.accountNumber ?? null,
    sort_code: account.sortCode ?? null,
    updated_at: (account.lastUpdated ?? new Date()).toISOString(),
  };

  if (account.openingBalance !== undefined) {
    update.initial_balance = account.openingBalance;
  }

  const metadata = buildAccountMetadata(account);
  if (metadata) {
    update.metadata = metadata;
  }

  return update;
};

const buildTransactionMetadata = (transaction: Transaction): Json | undefined => {
  const metadata: Record<string, Json> = {};

  if (transaction.categoryName) metadata.categoryName = transaction.categoryName;
  if (transaction.reconciledWith) metadata.reconciledWith = transaction.reconciledWith;
  if (transaction.reconciledNotes) metadata.reconciledNotes = transaction.reconciledNotes;
  if (transaction.reconciledDate) metadata.reconciledDate = transaction.reconciledDate.toISOString();
  if (transaction.bankReference) metadata.bankReference = transaction.bankReference;
  if (transaction.paymentChannel) metadata.paymentChannel = transaction.paymentChannel;
  if (transaction.merchant) metadata.merchant = transaction.merchant;
  if (transaction.accountName) metadata.accountName = transaction.accountName;
  if (transaction.goalId) metadata.goalId = transaction.goalId;
  if (transaction.addedBy) metadata.addedBy = transaction.addedBy;
  if (transaction.pending !== undefined) metadata.pending = transaction.pending;
  if (transaction.cleared !== undefined) metadata.cleared = transaction.cleared;
  if (transaction.isSplit !== undefined) metadata.isSplit = transaction.isSplit;
  if (transaction.isImported !== undefined) metadata.isImported = transaction.isImported;

  const location = transaction.location;
  if (location) {
    metadata.location = {
      city: location.city ?? null,
      region: location.region ?? null,
      country: location.country ?? null,
    };
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

export const buildTransactionInsert = (
  transaction: Transaction,
  userId: string,
  accountId: string,
): TransactionInsert => {
  const timestamp = new Date().toISOString();
  const metadata = buildTransactionMetadata(transaction);

  const insert: TransactionInsert = {
    id: transaction.id,
    user_id: userId,
    account_id: accountId,
    amount: transaction.amount,
    description: transaction.description,
    date: (transaction.date instanceof Date ? transaction.date : new Date(transaction.date)).toISOString(),
    category_id: transaction.category ?? null,
    type: transaction.type,
    is_recurring: transaction.isRecurring ?? false,
    notes: transaction.notes ?? null,
    tags: transaction.tags ?? [],
    created_at: timestamp,
    updated_at: timestamp,
  };

  if (metadata) {
    insert.metadata = metadata;
  }

  return insert;
};

export const buildTransactionUpdate = (
  transaction: Transaction,
  userId: string,
  accountId: string,
): TransactionUpdate => {
  const update: TransactionUpdate = {
    id: transaction.id,
    user_id: userId,
    account_id: accountId,
    amount: transaction.amount,
    description: transaction.description,
    date: (transaction.date instanceof Date ? transaction.date : new Date(transaction.date)).toISOString(),
    category_id: transaction.category ?? null,
    type: transaction.type,
    is_recurring: transaction.isRecurring ?? false,
    notes: transaction.notes ?? null,
    tags: transaction.tags ?? [],
    updated_at: new Date().toISOString(),
  };

  const metadata = buildTransactionMetadata(transaction);
  if (metadata) {
    update.metadata = metadata;
  }

  return update;
};

const toIsoString = (value: unknown, fallback: string): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallback;
};

const toNullableIsoString = (value: unknown): string | null => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
};

type BudgetMetadata = {
  spent?: number;
  notes?: string;
  color?: string;
  budgeted?: number;
  limit?: number;
};

const parseBudgetMetadata = (metadata: Json | undefined | null): BudgetMetadata => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  const record = metadata as Record<string, unknown>;
  const result: BudgetMetadata = {};
  if (typeof record.spent === 'number') result.spent = record.spent;
  if (typeof record.notes === 'string') result.notes = record.notes;
  if (typeof record.color === 'string') result.color = record.color;
  if (typeof record.budgeted === 'number') result.budgeted = record.budgeted;
  if (typeof record.limit === 'number') result.limit = record.limit;
  return result;
};

const serialiseBudgetMetadata = (metadata: BudgetMetadata): Json | undefined => {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return undefined;
  }
  const jsonObject: Record<string, Json> = {};
  for (const [key, value] of entries) {
    jsonObject[key] = (value ?? null) as Json;
  }
  return jsonObject;
};

const mapBudgetPeriodToSupabase = (period: Budget['period'] | undefined): BudgetInsert['period'] => {
  if (period === 'quarterly') {
    return 'custom';
  }
  return (period ?? 'monthly') as BudgetInsert['period'];
};

export const buildBudgetInsert = (budget: Budget, userId: string): BudgetInsert => {
  const nowIso = new Date().toISOString();
  const createdIso = toIsoString(budget.createdAt, nowIso);
  const updatedIso = toIsoString(budget.updatedAt, createdIso);

  const metadata: BudgetMetadata = {
    spent: budget.spent ?? 0,
  };

  if (budget.notes !== undefined) metadata.notes = budget.notes;
  if (budget.color !== undefined) metadata.color = budget.color;
  if (budget.budgeted !== undefined) metadata.budgeted = budget.budgeted;
  if (budget.limit !== undefined) metadata.limit = budget.limit;

  const insert: BudgetInsert = {
    id: budget.id,
    user_id: userId,
    name: budget.name ?? 'Untitled Budget',
    amount: budget.amount ?? 0,
    period: mapBudgetPeriodToSupabase(budget.period),
    category_id: budget.categoryId ?? null,
    start_date: budget.startDate ?? createdIso,
    end_date: budget.endDate ?? null,
    rollover_enabled: budget.rollover ?? false,
    rollover_amount: budget.rolloverAmount ?? 0,
    alert_enabled: (budget.alertThreshold ?? 0) > 0,
    alert_threshold: budget.alertThreshold ?? 0,
    is_active: budget.isActive ?? true,
    created_at: createdIso,
    updated_at: updatedIso,
  };

  const metadataPayload = serialiseBudgetMetadata(metadata);
  if (metadataPayload !== undefined) {
    insert.metadata = metadataPayload;
  }

  return insert;
};

export const buildBudgetUpdate = (
  updates: Partial<Budget>,
  existingRow: BudgetRow | null,
): BudgetUpdate | null => {
  const payload: BudgetUpdate = {
    updated_at: new Date().toISOString(),
  };

  let hasMutations = false;

  if (updates.name !== undefined) {
    payload.name = updates.name ?? 'Untitled Budget';
    hasMutations = true;
  }
  if (updates.amount !== undefined) {
    payload.amount = updates.amount;
    hasMutations = true;
  }
  if (updates.period !== undefined) {
    payload.period = mapBudgetPeriodToSupabase(updates.period);
    hasMutations = true;
  }
  if (updates.categoryId !== undefined) {
    payload.category_id = updates.categoryId ?? null;
    hasMutations = true;
  }
  if (updates.startDate !== undefined) {
    payload.start_date = updates.startDate ?? new Date().toISOString();
    hasMutations = true;
  }
  if (updates.endDate !== undefined) {
    payload.end_date = updates.endDate ?? null;
    hasMutations = true;
  }
  if (updates.isActive !== undefined) {
    payload.is_active = updates.isActive;
    hasMutations = true;
  }
  if (updates.rollover !== undefined) {
    payload.rollover_enabled = updates.rollover;
    hasMutations = true;
  }
  if (updates.rolloverAmount !== undefined) {
    payload.rollover_amount = updates.rolloverAmount ?? 0;
    hasMutations = true;
  }
  if (updates.alertThreshold !== undefined) {
    payload.alert_threshold = updates.alertThreshold ?? 0;
    payload.alert_enabled = (updates.alertThreshold ?? 0) > 0;
    hasMutations = true;
  }

  const existingMetadata = parseBudgetMetadata(existingRow?.metadata);
  const metadata: BudgetMetadata = { ...existingMetadata };

  let metadataChanged = false;

  if (updates.spent !== undefined) {
    metadata.spent = updates.spent;
    metadataChanged = true;
  }
  if (updates.notes !== undefined) {
    metadata.notes = updates.notes;
    metadataChanged = true;
  }
  if (updates.color !== undefined) {
    metadata.color = updates.color;
    metadataChanged = true;
  }
  if (updates.budgeted !== undefined) {
    metadata.budgeted = updates.budgeted;
    metadataChanged = true;
  }
  if (updates.limit !== undefined) {
    metadata.limit = updates.limit;
    metadataChanged = true;
  }

  if (metadataChanged) {
    const metadataPayload = serialiseBudgetMetadata(metadata);
    if (metadataPayload !== undefined) {
      payload.metadata = metadataPayload;
      hasMutations = true;
    }
  }

  return hasMutations ? payload : null;
};

export const mapBudgetRowToDomain = (row: BudgetRow): Budget => {
  const metadata = parseBudgetMetadata(row.metadata);
  const budget: Budget = {
    id: row.id,
    createdAt: toDate(row.created_at),
    name: row.name,
    categoryId: row.category_id ?? '',
    amount: row.amount,
    period: row.period as Budget['period'],
    isActive: row.is_active,
    spent: metadata.spent ?? 0,
    updatedAt: toDate(row.updated_at),
  };

  if (row.start_date) budget.startDate = row.start_date;
  if (row.end_date) budget.endDate = row.end_date;
  if (row.rollover_enabled !== null && row.rollover_enabled !== undefined) budget.rollover = row.rollover_enabled;
  if (row.rollover_amount !== null && row.rollover_amount !== undefined) budget.rolloverAmount = row.rollover_amount;
  if (row.alert_threshold !== null && row.alert_threshold !== undefined) budget.alertThreshold = row.alert_threshold;
  if (metadata.notes) budget.notes = metadata.notes;
  if (metadata.color) budget.color = metadata.color;
  if (metadata.budgeted !== undefined) budget.budgeted = metadata.budgeted;
  if (metadata.limit !== undefined) budget.limit = metadata.limit;

  return budget;
};

export const applyBudgetPatch = (base: Budget, updates: Partial<Budget>): Budget => ({
  ...base,
  ...updates,
  createdAt: updates.createdAt ? toDate(updates.createdAt, base.createdAt) : base.createdAt,
  updatedAt: updates.updatedAt ? toDate(updates.updatedAt, base.updatedAt) : base.updatedAt,
});

export const diffBudget = (base: Budget, target: Budget): Partial<Budget> => {
  const diff: Partial<Budget> = {};

  const compare = <K extends keyof Budget>(key: K) => {
    const baseValue = base[key];
    const targetValue = target[key];
    if (!isEqual(baseValue, targetValue)) {
      diff[key] = targetValue;
    }
  };

  const isEqual = (a: unknown, b: unknown): boolean => {
    if (a instanceof Date || b instanceof Date) {
      return toDate(a).getTime() === toDate(b).getTime();
    }
    return a === b;
  };

  compare('name');
  compare('amount');
  compare('categoryId');
  compare('period');
  compare('startDate');
  compare('endDate');
  compare('isActive');
  compare('rollover');
  compare('rolloverAmount');
  compare('alertThreshold');
  compare('spent');
  compare('notes');
  compare('color');
  compare('budgeted');
  compare('limit');

  return diff;
};

type GoalMetadata = {
  icon?: string;
  color?: string;
  progress?: number;
  achieved?: boolean;
  accountId?: string;
};

const parseGoalMetadata = (metadata: Json | undefined | null): GoalMetadata => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  const record = metadata as Record<string, unknown>;
  const result: GoalMetadata = {};
  if (typeof record.icon === 'string') result.icon = record.icon;
  if (typeof record.color === 'string') result.color = record.color;
  if (typeof record.progress === 'number') result.progress = record.progress;
  if (typeof record.achieved === 'boolean') result.achieved = record.achieved;
  if (typeof record.accountId === 'string') result.accountId = record.accountId;
  return result;
};

const serialiseGoalMetadata = (metadata: GoalMetadata): Json | undefined => {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return undefined;
  }
  const jsonObject: Record<string, Json> = {};
  for (const [key, value] of entries) {
    jsonObject[key] = (value ?? null) as Json;
  }
  return jsonObject;
};

const normaliseGoalStatus = (goal: Goal): 'active' | 'completed' | 'paused' => {
  const status = goal.status;
  if (status === 'active' || status === 'completed' || status === 'paused') {
    return status;
  }
  if (goal.achieved) {
    return 'completed';
  }
  return 'active';
};

const normaliseGoalFrequency = (frequency: Goal['contributionFrequency']): 'daily' | 'weekly' | 'monthly' | 'yearly' | null => {
  if (frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly' || frequency === 'yearly') {
    return frequency;
  }
  return null;
};

export const buildGoalInsert = (goal: Goal, userId: string): GoalInsert => {
  const nowIso = new Date().toISOString();
  const createdIso = toIsoString(goal.createdAt, nowIso);
  const updatedIso = toIsoString(goal.updatedAt, createdIso);

  const metadata: GoalMetadata = {};
  if (goal.icon !== undefined) metadata.icon = goal.icon;
  if (goal.color !== undefined) metadata.color = goal.color;
  if (goal.progress !== undefined) metadata.progress = goal.progress;
  if (goal.achieved !== undefined) metadata.achieved = goal.achieved;
  if (goal.accountId !== undefined) metadata.accountId = goal.accountId;

  const insert: GoalInsert = {
    id: goal.id,
    user_id: userId,
    name: goal.name ?? 'Untitled Goal',
    target_amount: goal.targetAmount ?? 0,
    current_amount: goal.currentAmount ?? 0,
    auto_contribute: goal.autoContribute ?? false,
    created_at: createdIso,
    updated_at: updatedIso,
  };

  insert.description = goal.description ?? null;
  insert.target_date = toNullableIsoString(goal.targetDate);
  insert.category = goal.category ?? null;
  insert.priority = goal.priority ?? null;
  insert.status = normaliseGoalStatus(goal);
  insert.contribution_amount = goal.contributionAmount ?? null;
  insert.contribution_frequency = normaliseGoalFrequency(goal.contributionFrequency);
  insert.completed_at = toNullableIsoString(goal.completedAt);

  const metadataPayload = serialiseGoalMetadata(metadata);
  if (metadataPayload !== undefined) {
    insert.metadata = metadataPayload;
  }

  return insert;
};

export const buildGoalUpdate = (
  updates: Partial<Goal>,
  existingRow: GoalRow | null,
): GoalUpdate | null => {
  const payload: GoalUpdate = {
    updated_at: new Date().toISOString(),
  };

  let hasMutations = false;

  if (updates.name !== undefined) {
    payload.name = updates.name ?? 'Untitled Goal';
    hasMutations = true;
  }
  if (updates.description !== undefined) {
    payload.description = updates.description ?? null;
    hasMutations = true;
  }
  if (updates.targetAmount !== undefined) {
    payload.target_amount = updates.targetAmount ?? 0;
    hasMutations = true;
  }
  if (updates.currentAmount !== undefined) {
    payload.current_amount = updates.currentAmount ?? 0;
    hasMutations = true;
  }
  if (updates.targetDate !== undefined) {
    payload.target_date = toNullableIsoString(updates.targetDate);
    hasMutations = true;
  }
  if (updates.category !== undefined) {
    payload.category = updates.category ?? null;
    hasMutations = true;
  }
  if (updates.priority !== undefined) {
    payload.priority = updates.priority ?? null;
    hasMutations = true;
  }
  if (updates.status !== undefined) {
    const status = updates.status;
    if (status === 'active' || status === 'completed' || status === 'paused') {
      payload.status = status;
      hasMutations = true;
    }
  } else if (updates.achieved !== undefined) {
    payload.status = updates.achieved ? 'completed' : 'active';
    hasMutations = true;
  }
  if (updates.autoContribute !== undefined) {
    payload.auto_contribute = updates.autoContribute ?? false;
    hasMutations = true;
  }
  if (updates.contributionAmount !== undefined) {
    payload.contribution_amount = updates.contributionAmount ?? null;
    hasMutations = true;
  }
  if (updates.contributionFrequency !== undefined) {
    const frequency = normaliseGoalFrequency(updates.contributionFrequency);
    payload.contribution_frequency = frequency;
    hasMutations = true;
  }
  if (updates.completedAt !== undefined) {
    payload.completed_at = toNullableIsoString(updates.completedAt);
    hasMutations = true;
  }

  const existingMetadata = parseGoalMetadata(existingRow?.metadata);
  const metadata: GoalMetadata = { ...existingMetadata };
  let metadataChanged = false;

  if (updates.icon !== undefined) {
    metadata.icon = updates.icon;
    metadataChanged = true;
  }
  if (updates.color !== undefined) {
    metadata.color = updates.color;
    metadataChanged = true;
  }
  if (updates.progress !== undefined) {
    metadata.progress = updates.progress;
    metadataChanged = true;
  }
  if (updates.achieved !== undefined) {
    metadata.achieved = updates.achieved;
    metadataChanged = true;
  }
  if (updates.accountId !== undefined) {
    metadata.accountId = updates.accountId;
    metadataChanged = true;
  }

  if (metadataChanged) {
    const metadataPayload = serialiseGoalMetadata(metadata);
    if (metadataPayload !== undefined) {
      payload.metadata = metadataPayload;
      hasMutations = true;
    }
  }

  return hasMutations ? payload : null;
};

export const mapGoalRowToDomain = (row: GoalRow): Goal => {
  const metadata = parseGoalMetadata(row.metadata);
  const createdAt = toDate(row.created_at);
  const updatedAt = toDate(row.updated_at, createdAt);
  const targetDate = toDate(row.target_date ?? row.created_at, createdAt);
  const status: Goal['status'] = row.status === 'paused' || row.status === 'completed'
    ? row.status
    : 'active';

  const progress = metadata.progress !== undefined
    ? metadata.progress
    : row.target_amount && row.target_amount > 0
      ? Math.min(
          100,
          toDecimal(row.current_amount ?? 0)
            .dividedBy(row.target_amount)
            .times(100)
            .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
            .toNumber()
        )
      : 0;

  const goal: Goal = {
    id: row.id,
    name: row.name,
    type: 'custom',
    targetAmount: row.target_amount ?? 0,
    currentAmount: row.current_amount ?? 0,
    targetDate,
    isActive: status !== 'completed',
    createdAt,
    progress,
    updatedAt,
  };

  goal.status = status;
  goal.achieved = metadata.achieved ?? (status === 'completed');

  if (row.description) goal.description = row.description;
  if (row.category) goal.category = row.category;
  if (row.priority) goal.priority = row.priority;
  if (row.auto_contribute !== null) goal.autoContribute = row.auto_contribute;
  if (row.contribution_amount !== null) goal.contributionAmount = row.contribution_amount;
  if (row.contribution_frequency) goal.contributionFrequency = row.contribution_frequency;
  if (row.completed_at) goal.completedAt = row.completed_at;
  if (metadata.icon) goal.icon = metadata.icon;
  if (metadata.color) goal.color = metadata.color;
  if (metadata.accountId) goal.accountId = metadata.accountId;

  return goal;
};

export const applyGoalPatch = (base: Goal, updates: Partial<Goal>): Goal => ({
  ...base,
  ...updates,
  createdAt: updates.createdAt ? toDate(updates.createdAt, base.createdAt) : base.createdAt,
  updatedAt: updates.updatedAt ? toDate(updates.updatedAt, base.updatedAt) : base.updatedAt,
  targetDate: updates.targetDate ? toDate(updates.targetDate, base.targetDate) : base.targetDate,
});

export const diffGoal = (base: Goal, target: Goal): Partial<Goal> => {
  const diff: Partial<Goal> = {};

  const compare = <K extends keyof Goal>(key: K) => {
    const baseValue = base[key];
    const targetValue = target[key];
    if (!isEqual(baseValue, targetValue)) {
      diff[key] = targetValue;
    }
  };

  const isEqual = (a: unknown, b: unknown): boolean => {
    if (a instanceof Date || b instanceof Date) {
      return toDate(a).getTime() === toDate(b).getTime();
    }
    return a === b;
  };

  compare('name');
  compare('type');
  compare('description');
  compare('linkedAccountIds');
  compare('isActive');
  compare('targetAmount');
  compare('currentAmount');
  compare('targetDate');
  compare('category');
  compare('priority');
  compare('status');
  compare('autoContribute');
  compare('contributionAmount');
  compare('contributionFrequency');
  compare('completedAt');
  compare('icon');
  compare('color');
  compare('progress');
  compare('achieved');
  compare('accountId');

  return diff;
};

const normaliseCategoryType = (type: Category['type']): 'income' | 'expense' | 'transfer' | null => {
  if (!type || type === 'both') {
    return null;
  }
  if (type === 'income' || type === 'expense' || type === 'transfer') {
    return type;
  }
  return null;
};

export const buildCategoryInsert = (category: Category, userId: string): CategoryInsert => {
  const nowIso = new Date().toISOString();
  const insert: CategoryInsert = {
    id: category.id,
    user_id: userId,
    parent_id: category.parentId ?? null,
    name: category.name,
    level: category.level ?? 'detail',
    icon: category.icon ?? null,
    color: category.color ?? null,
    is_system: category.isSystem ?? false,
    is_active: category.isActive ?? true,
    created_at: nowIso,
    updated_at: nowIso,
  };

  insert.type = normaliseCategoryType(category.type);

  return insert;
};

export const buildCategoryUpdate = (updates: Partial<Category>): CategoryUpdate | null => {
  const payload: CategoryUpdate = {
    updated_at: new Date().toISOString(),
  };

  let hasMutations = false;

  if (updates.name !== undefined) {
    payload.name = updates.name;
    hasMutations = true;
  }
  if (updates.parentId !== undefined) {
    payload.parent_id = updates.parentId ?? null;
    hasMutations = true;
  }
  if (updates.level !== undefined) {
    payload.level = updates.level;
    hasMutations = true;
  }
  if (updates.type !== undefined) {
    payload.type = normaliseCategoryType(updates.type);
    hasMutations = true;
  }
  if (updates.icon !== undefined) {
    payload.icon = updates.icon ?? null;
    hasMutations = true;
  }
  if (updates.color !== undefined) {
    payload.color = updates.color ?? null;
    hasMutations = true;
  }
  if (updates.isSystem !== undefined) {
    payload.is_system = updates.isSystem ?? false;
    hasMutations = true;
  }
  if (updates.isActive !== undefined) {
    payload.is_active = updates.isActive ?? true;
    hasMutations = true;
  }

  return hasMutations ? payload : null;
};

export const mapCategoryRowToDomain = (row: CategoryRow): Category => {
  const toDomainType = (value: string | null): Category['type'] => {
    if (value === 'income' || value === 'expense') {
      return value;
    }
    return 'both';
  };

  const category: Category = {
    id: row.id,
    name: row.name,
    type: toDomainType(row.type ?? null),
    level: row.level,
  };

  category.parentId = row.parent_id ?? null;
  if (row.color) category.color = row.color;
  if (row.icon) category.icon = row.icon;
  if (row.is_system !== null && row.is_system !== undefined) category.isSystem = row.is_system;
  if (row.is_active !== null && row.is_active !== undefined) category.isActive = row.is_active;

  return category;
};

export const applyCategoryPatch = (base: Category, updates: Partial<Category>): Category => ({
  ...base,
  ...updates,
});

export const diffCategory = (base: Category, target: Category): Partial<Category> => {
  const diff: Partial<Category> = {};

  const compare = <K extends keyof Category>(key: K) => {
    if (base[key] !== target[key]) {
      diff[key] = target[key];
    }
  };

  compare('name');
  compare('type');
  compare('level');
  compare('parentId');
  compare('color');
  compare('icon');
  compare('isSystem');
  compare('isActive');

  return diff;
};
