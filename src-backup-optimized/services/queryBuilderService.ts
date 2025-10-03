export interface QueryCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between' | 'in' | 'not_in';
  value: unknown;
  value2?: unknown; // For 'between' operator
}

export interface QueryAggregation {
  field: string;
  function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct';
  alias?: string;
}

export interface QuerySort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface Query {
  id: string;
  name: string;
  dataSource: 'transactions' | 'accounts' | 'budgets' | 'goals' | 'investments';
  conditions: QueryCondition[];
  aggregations: QueryAggregation[];
  groupBy: string[];
  sortBy: QuerySort[];
  limit?: number;
  dateRange?: {
    field: string;
    start: string;
    end: string;
  };
}

export interface FieldOption {
  value: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'array';
}

/**
 * Service for managing query builder logic
 */
export class QueryBuilderService {
  static readonly FIELD_OPTIONS: Record<Query['dataSource'], FieldOption[]> = {
    transactions: [
      { value: 'date', label: 'Date', type: 'date' },
      { value: 'description', label: 'Description', type: 'text' },
      { value: 'amount', label: 'Amount', type: 'number' },
      { value: 'category', label: 'Category', type: 'text' },
      { value: 'account_id', label: 'Account', type: 'text' },
      { value: 'type', label: 'Type', type: 'text' },
      { value: 'tags', label: 'Tags', type: 'array' }
    ],
    accounts: [
      { value: 'name', label: 'Account Name', type: 'text' },
      { value: 'type', label: 'Account Type', type: 'text' },
      { value: 'balance', label: 'Balance', type: 'number' },
      { value: 'currency', label: 'Currency', type: 'text' },
      { value: 'institution', label: 'Institution', type: 'text' }
    ],
    budgets: [
      { value: 'category', label: 'Category', type: 'text' },
      { value: 'amount', label: 'Budget Amount', type: 'number' },
      { value: 'spent', label: 'Amount Spent', type: 'number' },
      { value: 'period', label: 'Period', type: 'text' }
    ],
    goals: [
      { value: 'name', label: 'Goal Name', type: 'text' },
      { value: 'target_amount', label: 'Target Amount', type: 'number' },
      { value: 'current_amount', label: 'Current Amount', type: 'number' },
      { value: 'target_date', label: 'Target Date', type: 'date' },
      { value: 'category', label: 'Category', type: 'text' }
    ],
    investments: [
      { value: 'symbol', label: 'Symbol', type: 'text' },
      { value: 'name', label: 'Investment Name', type: 'text' },
      { value: 'shares', label: 'Shares', type: 'number' },
      { value: 'purchase_price', label: 'Purchase Price', type: 'number' },
      { value: 'current_price', label: 'Current Price', type: 'number' },
      { value: 'value', label: 'Total Value', type: 'number' },
      { value: 'gain_loss', label: 'Gain/Loss', type: 'number' }
    ]
  };

  static readonly OPERATOR_OPTIONS = [
    { value: 'equals', label: '=', types: ['text', 'number', 'date'] },
    { value: 'contains', label: 'contains', types: ['text'] },
    { value: 'greater', label: '>', types: ['number', 'date'] },
    { value: 'less', label: '<', types: ['number', 'date'] },
    { value: 'between', label: 'between', types: ['number', 'date'] },
    { value: 'in', label: 'in', types: ['text', 'array'] },
    { value: 'not_in', label: 'not in', types: ['text', 'array'] }
  ];

  static readonly AGGREGATION_OPTIONS = [
    { value: 'sum', label: 'Sum' },
    { value: 'avg', label: 'Average' },
    { value: 'count', label: 'Count' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
    { value: 'distinct', label: 'Distinct Count' }
  ];

  /**
   * Get field type for a given field
   */
  static getFieldType(dataSource: Query['dataSource'], fieldValue: string): string {
    const fields = this.FIELD_OPTIONS[dataSource];
    const field = fields.find(f => f.value === fieldValue);
    return field?.type || 'text';
  }

  /**
   * Get valid operators for a field
   */
  static getValidOperators(dataSource: Query['dataSource'], fieldValue: string) {
    const fieldType = this.getFieldType(dataSource, fieldValue);
    return this.OPERATOR_OPTIONS.filter(op => op.types.includes(fieldType));
  }

  /**
   * Create a new query with defaults
   */
  static createNewQuery(initialQuery?: Query): Query {
    return initialQuery || {
      id: `query-${Date.now()}`,
      name: '',
      dataSource: 'transactions',
      conditions: [],
      aggregations: [],
      groupBy: [],
      sortBy: [],
      limit: 100
    };
  }

  /**
   * Create a default condition
   */
  static createDefaultCondition(dataSource: Query['dataSource']): QueryCondition {
    const fields = this.FIELD_OPTIONS[dataSource];
    return {
      field: fields[0].value,
      operator: 'equals',
      value: ''
    };
  }

  /**
   * Create a default aggregation
   */
  static createDefaultAggregation(dataSource: Query['dataSource']): QueryAggregation {
    const fields = this.FIELD_OPTIONS[dataSource];
    return {
      field: fields[0].value,
      function: 'sum',
      alias: ''
    };
  }

  /**
   * Create a default sort
   */
  static createDefaultSort(dataSource: Query['dataSource']): QuerySort {
    const fields = this.FIELD_OPTIONS[dataSource];
    return {
      field: fields[0].value,
      direction: 'asc'
    };
  }
}

export const queryBuilderService = new QueryBuilderService();