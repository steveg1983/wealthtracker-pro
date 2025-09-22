/**
 * QueryBuilder Component - Advanced query builder for analytics
 *
 * Features:
 * - Visual query building interface
 * - Filter conditions and operators
 * - Date range selection
 * - Category and tag filtering
 */

import React, { useState } from 'react';

export interface QueryFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in';
  value: string | number | string[] | [number, number];
}

export interface QueryConfig {
  filters: QueryFilter[];
  dateRange: {
    start: Date;
    end: Date;
  };
  groupBy?: string;
  orderBy?: string;
  limit?: number;
}

interface QueryBuilderProps {
  onQueryChange: (query: QueryConfig) => void;
  availableFields?: string[];
  className?: string;
}

const defaultFields = [
  'amount',
  'category',
  'description',
  'date',
  'account',
  'merchant',
  'type'
];

const operators = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'between', label: 'Between' },
  { value: 'in', label: 'In' }
];

export default function QueryBuilder({
  onQueryChange,
  availableFields = defaultFields,
  className = ''
}: QueryBuilderProps): React.JSX.Element {
  const [filters, setFilters] = useState<QueryFilter[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  });

  const addFilter = () => {
    const newFilter: QueryFilter = {
      field: availableFields[0],
      operator: 'equals',
      value: ''
    };

    const newFilters = [...filters, newFilter];
    setFilters(newFilters);
    updateQuery(newFilters, dateRange);
  };

  const removeFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters);
    updateQuery(newFilters, dateRange);
  };

  const updateFilter = (index: number, updates: Partial<QueryFilter>) => {
    const newFilters = filters.map((filter, i) =>
      i === index ? { ...filter, ...updates } : filter
    );
    setFilters(newFilters);
    updateQuery(newFilters, dateRange);
  };

  const updateQuery = (newFilters: QueryFilter[], newDateRange: typeof dateRange) => {
    const query: QueryConfig = {
      filters: newFilters,
      dateRange: newDateRange
    };

    onQueryChange(query);
  };

  const handleDateRangeChange = (field: 'start' | 'end', date: string) => {
    const newDateRange = {
      ...dateRange,
      [field]: new Date(date)
    };
    setDateRange(newDateRange);
    updateQuery(filters, newDateRange);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Date Range */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
          Date Range
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start.toISOString().split('T')[0]}
              onChange={(e) => handleDateRangeChange('start', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end.toISOString().split('T')[0]}
              onChange={(e) => handleDateRangeChange('end', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Filters
          </h3>
          <button
            onClick={addFilter}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
          >
            Add Filter
          </button>
        </div>

        {filters.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No filters applied. Click "Add Filter" to create conditions.
          </p>
        ) : (
          <div className="space-y-3">
            {filters.map((filter, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                {/* Field */}
                <select
                  value={filter.field}
                  onChange={(e) => updateFilter(index, { field: e.target.value })}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                >
                  {availableFields.map(field => (
                    <option key={field} value={field}>
                      {field.charAt(0).toUpperCase() + field.slice(1)}
                    </option>
                  ))}
                </select>

                {/* Operator */}
                <select
                  value={filter.operator}
                  onChange={(e) => updateFilter(index, { operator: e.target.value as QueryFilter['operator'] })}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                >
                  {operators.map(op => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {/* Value */}
                <input
                  type={filter.field === 'amount' ? 'number' : 'text'}
                  value={typeof filter.value === 'string' || typeof filter.value === 'number' ? filter.value : ''}
                  onChange={(e) => updateFilter(index, {
                    value: filter.field === 'amount' ? parseFloat(e.target.value) || 0 : e.target.value
                  })}
                  placeholder="Enter value..."
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                />

                {/* Remove */}
                <button
                  onClick={() => removeFilter(index)}
                  className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Query Summary */}
      {(filters.length > 0 || dateRange) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
            Query Summary
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {filters.length > 0 ? `${filters.length} filter(s) applied` : 'No filters'}
            {' • '}
            Date range: {dateRange.start.toLocaleDateString()} to {dateRange.end.toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}