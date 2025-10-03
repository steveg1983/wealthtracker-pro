/**
 * Rule Form Component
 * Form fields for rule basic information
 */

import React, { useEffect } from 'react';
import type { ImportRule } from '../../types/importRules';
import { useLogger } from '../services/ServiceProvider';

interface RuleFormProps {
  formData: Partial<ImportRule>;
  onChange: (updates: Partial<ImportRule>) => void;
}

const RuleForm = React.memo(({ formData, onChange }: RuleFormProps) => {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Rule Name *
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary dark:bg-gray-700"
            placeholder="e.g., Categorize Groceries"
            aria-label="Rule name"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Priority
          </label>
          <input
            type="number"
            value={formData.priority || 1}
            onChange={(e) => onChange({ priority: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary dark:bg-gray-700"
            min="1"
            aria-label="Rule priority"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary dark:bg-gray-700"
          rows={2}
          placeholder="Optional description of what this rule does"
          aria-label="Rule description"
        />
      </div>
    </>
  );
});

RuleForm.displayName = 'RuleForm';

export default RuleForm;