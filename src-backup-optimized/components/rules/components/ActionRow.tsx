/**
 * Action Row Component
 * Renders a single rule action editor
 */

import React, { useEffect, memo } from 'react';
import { XIcon } from '../../icons';
import { ruleEditorService } from '../../../services/ruleEditorService';
import type { ImportRuleAction } from '../../../types/importRules';
import type { Category, Account } from '../../../types';
import { useLogger } from '../services/ServiceProvider';

interface ActionRowProps {
  action: ImportRuleAction;
  categories: Category[];
  accounts: Account[];
  onChange: (action: Partial<ImportRuleAction>) => void;
  onRemove: () => void;
}

export const ActionRow = memo(function ActionRow({ action,
  categories,
  accounts,
  onChange,
  onRemove
 }: ActionRowProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ActionRow component initialized', {
      componentName: 'ActionRow'
    });
  }, []);

  const actionTypes = ruleEditorService.getActionTypes();
  const placeholder = ruleEditorService.getActionPlaceholder(action.type);

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <select
        value={action.type}
        onChange={(e) => onChange({ type: e.target.value as any })}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
      >
        {actionTypes.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {action.type === 'setCategory' && (
        <select
          value={action.value || ''}
          onChange={(e) => onChange({ value: e.target.value })}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
        >
          <option value="">Select category...</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {action.type === 'setAccount' && (
        <select
          value={action.value || ''}
          onChange={(e) => onChange({ value: e.target.value })}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
        >
          <option value="">Select account...</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}

      {(action.type === 'addTag' || action.type === 'modifyDescription') && (
        <input
          type="text"
          value={action.value || ''}
          onChange={(e) => onChange({ value: e.target.value })}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
          placeholder={placeholder}
        />
      )}

      <button
        onClick={onRemove}
        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
});