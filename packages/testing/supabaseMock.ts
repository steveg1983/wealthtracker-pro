import { vi } from 'vitest';
import type { SupabaseClientLike } from '@wealthtracker/core';
import type { Database } from '@wealthtracker/types';

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;

type QueryMock = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
};

type FilterMock = {
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

export type SupabaseTableMock<Table extends TableName = TableName> = {
  query: QueryMock;
  filter: FilterMock;
};

export type SupabaseClientMock = SupabaseClientLike & {
  from<Table extends TableName>(table: Table): QueryMock;
  __mock: {
    table<Table extends TableName>(table: Table): SupabaseTableMock<Table>;
    reset(): void;
  };
};

const createFilterMock = (): FilterMock => {
  const filter: FilterMock = {
    eq: vi.fn(),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };

  filter.eq = vi.fn(() => filter) as FilterMock['eq'];

  return filter;
};

const createQueryMock = (filter: FilterMock): QueryMock => {
  const insertSelect = {
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };

  const insertBuilder = {
    select: vi.fn(() => insertSelect),
  };

  return {
    select: vi.fn(() => filter),
    insert: vi.fn(() => insertBuilder),
    upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
};

const createTableMock = (): SupabaseTableMock => {
  const filter = createFilterMock();
  const query = createQueryMock(filter);
  return { query, filter };
};

export const createSupabaseClientMock = (): SupabaseClientMock => {
  const tableMocks = new Map<TableName, SupabaseTableMock>();

  const ensureTableMock = (table: TableName): SupabaseTableMock => {
    if (!tableMocks.has(table)) {
      tableMocks.set(table, createTableMock());
    }
    return tableMocks.get(table)!;
  };

  const client = {
    from(table: TableName) {
      return ensureTableMock(table).query;
    },
    __mock: {
      table(table: TableName) {
        return ensureTableMock(table);
      },
      reset() {
        tableMocks.clear();
      },
    },
  } as SupabaseClientMock;

  return client;
};
