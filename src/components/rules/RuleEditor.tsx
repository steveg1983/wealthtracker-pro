import React, { memo, useState, useEffect, useCallback } from 'react';
import { PlusIcon, XIcon } from '../icons';
import { ruleEditorService } from '../../services/ruleEditorService';
import ConditionRow from './ConditionRow';
import ActionRow from './ActionRow';
import type { ImportRule, ImportRuleCondition, ImportRuleAction } from '../../types/importRules';
import type { Category, Account } from '../../types';
import { logger } from '../../services/loggingService';

interface RuleEditorProps {
  rule: Partial<ImportRule> | null;
  categories: Category[];
  accounts: Account[];
  onSave: (rule: Partial<ImportRule>) => void;
  onCancel: () => void;
}

export const RuleEditor = memo(function RuleEditor({
  rule,
  categories,
  accounts,
  onSave,
  onCancel
}: RuleEditorProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RuleEditor component initialized', {
      componentName: 'RuleEditor'
    });
  }, []);

  const [formData, setFormData] = useState<Partial<ImportRule>>(
    ruleEditorService.getDefaultFormData(rule)
  );

  useEffect(() => {
    if (rule) {
      setFormData(ruleEditorService.getDefaultFormData(rule));
    }
  }, [rule]);

  // Condition handlers
  const addCondition = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      conditions: [...(prev.conditions || []), ruleEditorService.createDefaultCondition()]
    }));
  }, []);

  const updateCondition = useCallback((index: number, condition: Partial<ImportRuleCondition>) => {
    setFormData(prev => ({
      ...prev,
      conditions: ruleEditorService.updateConditionAtIndex(prev.conditions || [], index, condition)
    }));
  }, []);

  const removeCondition = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      conditions: (prev.conditions || []).filter((_, i) => i !== index)
    }));
  }, []);

  // Action handlers
  const addAction = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      actions: [...(prev.actions || []), ruleEditorService.createDefaultAction()]
    }));
  }, []);

  const updateAction = useCallback((index: number, action: Partial<ImportRuleAction>) => {
    setFormData(prev => ({
      ...prev,
      actions: ruleEditorService.updateActionAtIndex(prev.actions || [], index, action)
    }));
  }, []);

  const removeAction = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      actions: (prev.actions || []).filter((_, i) => i !== index)
    }));
  }, []);

  // Form submit
  const handleSubmit = useCallback(() => {
    const validation = ruleEditorService.validateRule(formData as any);
    const errors = validation.errors;
    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }
    onSave(formData);
  }, [formData, onSave]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {rule ? 'Edit Rule' : 'Create Rule'}
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close editor"
            >
              <XIcon size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rule Name
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                placeholder="e.g., Categorize groceries"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                rows={2}
                placeholder="Optional description of what this rule does"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.enabled ?? true}
                  onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="h-4 w-4 text-primary rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
              </label>
              
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700 dark:text-gray-300">Priority:</label>
                <input
                  type="number"
                  value={formData.priority || 1}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 dark:text-white">
                Conditions
              </h3>
              <button
                onClick={addCondition}
                className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-lg hover:bg-secondary text-sm"
              >
                <PlusIcon size={14} />
                Add Condition
              </button>
            </div>
            
            <div className="space-y-2">
              {formData.conditions?.map((condition, index) => (
                <ConditionRow
                  key={index}
                  condition={condition}
                  onChange={(c) => updateCondition(index, c)}
                  onRemove={() => removeCondition(index)}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 dark:text-white">
                Actions
              </h3>
              <button
                onClick={addAction}
                className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-lg hover:bg-secondary text-sm"
              >
                <PlusIcon size={14} />
                Add Action
              </button>
            </div>
            
            <div className="space-y-2">
              {formData.actions?.map((action, index) => (
                <ActionRow
                  key={index}
                  action={action}
                  categories={categories}
                  accounts={accounts}
                  onChange={(a) => updateAction(index, a)}
                  onRemove={() => removeAction(index)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
          >
            {rule ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
});