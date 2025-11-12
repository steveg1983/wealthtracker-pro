import React, { useState } from 'react';
import { PlusIcon, XIcon, FilterIcon, LayersIcon, ArrowUpIcon, CalendarIcon } from '../icons';

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

interface QueryBuilderProps {
  onSave: (query: Query) => void;
  onCancel: () => void;
  initialQuery?: Query;
}

const FIELD_OPTIONS = {
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

const OPERATOR_OPTIONS = [
  { value: 'equals', label: '=', types: ['text', 'number', 'date'] },
  { value: 'contains', label: 'contains', types: ['text'] },
  { value: 'greater', label: '>', types: ['number', 'date'] },
  { value: 'less', label: '<', types: ['number', 'date'] },
  { value: 'between', label: 'between', types: ['number', 'date'] },
  { value: 'in', label: 'in', types: ['text', 'array'] },
  { value: 'not_in', label: 'not in', types: ['text', 'array'] }
];

const AGGREGATION_OPTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'distinct', label: 'Distinct Count' }
];

export default function QueryBuilder({ onSave, onCancel, initialQuery }: QueryBuilderProps): React.JSX.Element {
  const [queryName, setQueryName] = useState(initialQuery?.name || '');
  const [dataSource, setDataSource] = useState<Query['dataSource']>(initialQuery?.dataSource || 'transactions');
  const [conditions, setConditions] = useState<QueryCondition[]>(initialQuery?.conditions || []);
  const [aggregations, setAggregations] = useState<QueryAggregation[]>(initialQuery?.aggregations || []);
  const [groupBy, setGroupBy] = useState<string[]>(initialQuery?.groupBy || []);
  const [sortBy, setSortBy] = useState<QuerySort[]>(initialQuery?.sortBy || []);
  const [limit, setLimit] = useState(initialQuery?.limit || 100);
  const [dateRange, setDateRange] = useState(initialQuery?.dateRange);

  const fields = FIELD_OPTIONS[dataSource];

  const addCondition = () => {
    setConditions([...conditions, {
      field: fields[0].value,
      operator: 'equals',
      value: ''
    }]);
  };

  const updateCondition = (index: number, updates: Partial<QueryCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const addAggregation = () => {
    setAggregations([...aggregations, {
      field: fields[0].value,
      function: 'sum',
      alias: ''
    }]);
  };

  const updateAggregation = (index: number, updates: Partial<QueryAggregation>) => {
    const newAggregations = [...aggregations];
    newAggregations[index] = { ...newAggregations[index], ...updates };
    setAggregations(newAggregations);
  };

  const removeAggregation = (index: number) => {
    setAggregations(aggregations.filter((_, i) => i !== index));
  };

  const addSort = () => {
    setSortBy([...sortBy, {
      field: fields[0].value,
      direction: 'asc'
    }]);
  };

  const updateSort = (index: number, updates: Partial<QuerySort>) => {
    const newSortBy = [...sortBy];
    newSortBy[index] = { ...newSortBy[index], ...updates };
    setSortBy(newSortBy);
  };

  const removeSort = (index: number) => {
    setSortBy(sortBy.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const query: Query = {
      id: initialQuery?.id || `query-${Date.now()}`,
      name: queryName || 'Untitled Query',
      dataSource,
      conditions,
      aggregations,
      groupBy,
      sortBy,
      limit,
      dateRange
    };
    onSave(query);
  };

  const getFieldType = (fieldValue: string) => {
    const field = fields.find(f => f.value === fieldValue);
    return field?.type || 'text';
  };

  const getValidOperators = (fieldValue: string) => {
    const fieldType = getFieldType(fieldValue);
    return OPERATOR_OPTIONS.filter(op => op.types.includes(fieldType));
  };

  return (
    <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Query Builder</h2>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Save Query
          </button>
        </div>
      </div>

      {/* Query Name */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Query Name
        </label>
        <input
          type="text"
          value={queryName}
          onChange={(e) => setQueryName(e.target.value)}
          className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Monthly Expense Analysis"
        />
      </div>

      {/* Data Source */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Data Source
        </label>
        <select
          value={dataSource}
          onChange={(e) => {
            setDataSource(e.target.value as Query['dataSource']);
            setConditions([]);
            setAggregations([]);
            setGroupBy([]);
            setSortBy([]);
          }}
          className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
        >
          <option value="transactions">Transactions</option>
          <option value="accounts">Accounts</option>
          <option value="budgets">Budgets</option>
          <option value="goals">Goals</option>
          <option value="investments">Investments</option>
        </select>
      </div>

      {/* Date Range */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <CalendarIcon size={20} className="text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">Date Range</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <select
            value={dateRange?.field || ''}
            onChange={(e) => setDateRange(e.target.value ? { ...dateRange!, field: e.target.value } : undefined)}
            className="px-3 py-2 bg-[#d4dce8] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
          >
            <option value="">No date filter</option>
            {fields.filter(f => f.type === 'date').map(field => (
              <option key={field.value} value={field.value}>{field.label}</option>
            ))}
          </select>
          {dateRange && (
            <>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-2 bg-[#d4dce8] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-2 bg-[#d4dce8] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
            </>
          )}
        </div>
      </div>

      {/* Conditions */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FilterIcon size={20} className="text-gray-600 dark:text-gray-400" />
            <h3 className="font-medium text-gray-900 dark:text-white">Filters</h3>
          </div>
          <button
            onClick={addCondition}
            className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
          >
            <PlusIcon size={16} />
            Add Filter
          </button>
        </div>
        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <select
                value={condition.field}
                onChange={(e) => updateCondition(index, { field: e.target.value })}
                className="px-3 py-2 bg-[#d4dce8] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
              >
                {fields.map(field => (
                  <option key={field.value} value={field.value}>{field.label}</option>
                ))}
              </select>
              <select
                value={condition.operator}
                onChange={(e) => updateCondition(index, { operator: e.target.value as QueryCondition['operator'] })}
                className="px-3 py-2 bg-[#d4dce8] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
              >
                {getValidOperators(condition.field).map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              <input
                type={getFieldType(condition.field) === 'number' ? 'number' : 'text'}
                value={(condition.value as string | number) || ''}
                onChange={(e) => updateCondition(index, { value: e.target.value })}
                className="flex-1 px-3 py-2 bg-[#d4dce8] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
                placeholder="Value"
              />
              {condition.operator === 'between' && (
                <input
                  type={getFieldType(condition.field) === 'number' ? 'number' : 'text'}
                  value={(condition.value2 as string | number) || ''}
                  onChange={(e) => updateCondition(index, { value2: e.target.value })}
                  className="px-3 py-2 bg-[#d4dce8] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
                  placeholder="To"
                />
              )}
              <button
                onClick={() => removeCondition(index)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <XIcon size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Aggregations */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LayersIcon size={20} className="text-gray-600 dark:text-gray-400" />
            <h3 className="font-medium text-gray-900 dark:text-white">Aggregations</h3>
          </div>
          <button
            onClick={addAggregation}
            className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
          >
            <PlusIcon size={16} />
            Add Aggregation
          </button>
        </div>
        <div className="space-y-2">
          {aggregations.map((agg, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <select
                value={agg.function}
                onChange={(e) => updateAggregation(index, { function: e.target.value as QueryAggregation['function'] })}
                className="px-3 py-2 bg-[#d4dce8] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
              >
                {AGGREGATION_OPTIONS.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              <select
                value={agg.field}
                onChange={(e) => updateAggregation(index, { field: e.target.value })}
                className="px-3 py-2 bg-[#d4dce8] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
              >
                {fields.map(field => (
                  <option key={field.value} value={field.value}>{field.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={agg.alias || ''}
                onChange={(e) => updateAggregation(index, { alias: e.target.value })}
                className="flex-1 px-3 py-2 bg-[#d4dce8] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
                placeholder="Alias (optional)"
              />
              <button
                onClick={() => removeAggregation(index)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <XIcon size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Group By */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Group By
        </label>
        <div className="flex flex-wrap gap-2">
          {fields.map(field => (
            <button
              key={field.value}
              onClick={() => {
                if (groupBy.includes(field.value)) {
                  setGroupBy(groupBy.filter(f => f !== field.value));
                } else {
                  setGroupBy([...groupBy, field.value]);
                }
              }}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                groupBy.includes(field.value)
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {field.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort By */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ArrowUpIcon size={20} className="text-gray-600 dark:text-gray-400" />
            <h3 className="font-medium text-gray-900 dark:text-white">Sort By</h3>
          </div>
          <button
            onClick={addSort}
            className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
          >
            <PlusIcon size={16} />
            Add Sort
          </button>
        </div>
        <div className="space-y-2">
          {sortBy.map((sort, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <select
                value={sort.field}
                onChange={(e) => updateSort(index, { field: e.target.value })}
                className="flex-1 px-3 py-2 bg-[#d4dce8] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
              >
                {fields.map(field => (
                  <option key={field.value} value={field.value}>{field.label}</option>
                ))}
              </select>
              <select
                value={sort.direction}
                onChange={(e) => updateSort(index, { direction: e.target.value as 'asc' | 'desc' })}
                className="px-3 py-2 bg-[#d4dce8] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
              <button
                onClick={() => removeSort(index)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <XIcon size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Limit */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Result Limit
        </label>
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
          min="1"
          max="10000"
          className="w-32 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
        />
      </div>
    </div>
  );
}
