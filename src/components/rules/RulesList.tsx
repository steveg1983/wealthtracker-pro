import React, { useEffect, memo } from 'react';
import {
  EditIcon,
  DeleteIcon,
  CheckIcon,
  XIcon,
  PlayIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '../icons';
import type { ImportRule } from '../../types/importRules';
import { logger } from '../../services/loggingService';

interface RulesListProps {
  rules: ImportRule[];
  testResults: Map<string, boolean>;
  onEdit: (rule: ImportRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onChangePriority: (id: string, direction: 'up' | 'down') => void;
  onTest: (rule: ImportRule) => void;
}

export const RulesList = memo(function RulesList({
  rules,
  testResults,
  onEdit,
  onDelete,
  onToggle,
  onChangePriority,
  onTest
}: RulesListProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RulesList component initialized', {
      componentName: 'RulesList'
    });
  }, []);

  if (rules.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400 mb-4">No import rules configured</p>
        <button className="text-primary hover:underline">
          Create your first rule
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <RuleCard
          key={rule.id}
          rule={rule}
          testResult={testResults.get(rule.id)}
          canMoveUp={rule.priority > 1}
          canMoveDown={rule.priority < rules.length}
          onEdit={() => onEdit(rule)}
          onDelete={() => onDelete(rule.id)}
          onToggle={() => onToggle(rule.id, !rule.enabled)}
          onMoveUp={() => onChangePriority(rule.id, 'up')}
          onMoveDown={() => onChangePriority(rule.id, 'down')}
          onTest={() => onTest(rule)}
        />
      ))}
    </div>
  );
});

interface RuleCardProps {
  rule: ImportRule;
  testResult?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTest: () => void;
}

const RuleCard = memo(function RuleCard({
  rule,
  testResult,
  canMoveUp,
  canMoveDown,
  onEdit,
  onDelete,
  onToggle,
  onMoveUp,
  onMoveDown,
  onTest
}: RuleCardProps) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        rule.enabled
          ? 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-gray-900 dark:text-white">{rule.name}</h3>
            <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">
              Priority: {rule.priority}
            </span>
            {testResult !== undefined && (
              <span
                className={`text-xs px-2 py-1 rounded ${
                  testResult
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}
              >
                {testResult ? 'Matches found' : 'No matches'}
              </span>
            )}
          </div>

          {rule.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {rule.description}
            </p>
          )}

          <div className="text-sm">
            <RuleConditions conditions={rule.conditions} />
            <RuleActions actions={rule.actions} />
          </div>
        </div>

        <RuleControls
          enabled={rule.enabled}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onTest={onTest}
          onEdit={onEdit}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
});

const RuleConditions = memo(function RuleConditions({
  conditions
}: {
  conditions: ImportRule['conditions'];
}) {
  return (
    <div className="mb-1">
      <span className="font-medium text-gray-700 dark:text-gray-300">Conditions:</span>
      <ul className="ml-4 mt-1">
        {conditions.map((condition, i) => (
          <li key={i} className="text-gray-600 dark:text-gray-400">
            • {condition.field} {condition.operator} "{condition.value}"
            {condition.value2 && ` and "${condition.value2}"`}
          </li>
        ))}
      </ul>
    </div>
  );
});

const RuleActions = memo(function RuleActions({
  actions
}: {
  actions: ImportRule['actions'];
}) {
  return (
    <div>
      <span className="font-medium text-gray-700 dark:text-gray-300">Actions:</span>
      <ul className="ml-4 mt-1">
        {actions.map((action, i) => (
          <li key={i} className="text-gray-600 dark:text-gray-400">
            • {action.type}
            {action.value && `: "${action.value}"`}
          </li>
        ))}
      </ul>
    </div>
  );
});

const RuleControls = memo(function RuleControls({
  enabled,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onTest,
  onEdit,
  onToggle,
  onDelete
}: {
  enabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTest: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 ml-4">
      <button
        onClick={onMoveUp}
        className="p-1 text-gray-600 dark:text-gray-400 hover:text-primary disabled:opacity-50"
        disabled={!canMoveUp}
      >
        <ArrowUpIcon size={16} />
      </button>
      <button
        onClick={onMoveDown}
        className="p-1 text-gray-600 dark:text-gray-400 hover:text-primary disabled:opacity-50"
        disabled={!canMoveDown}
      >
        <ArrowDownIcon size={16} />
      </button>
      <button
        onClick={onTest}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary"
        title="Test rule"
      >
        <PlayIcon size={16} />
      </button>
      <button
        onClick={onEdit}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary"
      >
        <EditIcon size={16} />
      </button>
      <button
        onClick={onToggle}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary"
      >
        {enabled ? <CheckIcon size={16} /> : <XIcon size={16} />}
      </button>
      <button
        onClick={onDelete}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600"
      >
        <DeleteIcon size={16} />
      </button>
    </div>
  );
});