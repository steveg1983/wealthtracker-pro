import { memo } from 'react';
import { FileTextIcon, EditIcon, TrashIcon, PlayIcon } from '../../components/icons';
import type { ExportTemplate } from './types';

interface TemplatesTabProps {
  templates: ExportTemplate[];
  onUseTemplate: (template: ExportTemplate) => void;
  onDeleteTemplate: (id: string) => void;
}

/**
 * Tab for managing export templates
 * Displays saved templates and allows usage/deletion
 */
export const TemplatesTab = memo(function TemplatesTab({
  templates,
  onUseTemplate,
  onDeleteTemplate
}: TemplatesTabProps) {
  if (templates.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
        <FileTextIcon size={48} className="text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Templates Yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Save your current export settings as a template for quick access
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {templates.map((template) => (
        <div
          key={template.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {template.name}
              </h3>
              {template.isDefault && (
                <span className="inline-flex px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full mt-1">
                  Default
                </span>
              )}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => onUseTemplate(template)}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                title="Use Template"
              >
                <PlayIcon size={20} />
              </button>
              <button
                onClick={() => onDeleteTemplate(template.id)}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                title="Delete Template"
              >
                <TrashIcon size={20} />
              </button>
            </div>
          </div>
          
          {template.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {template.description}
            </p>
          )}
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Format:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {template.options.format.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Includes:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {[
                  template.options.includeTransactions && 'Transactions',
                  template.options.includeAccounts && 'Accounts',
                  template.options.includeInvestments && 'Investments',
                  template.options.includeBudgets && 'Budgets'
                ].filter(Boolean).join(', ') || 'None'}
              </span>
            </div>
            {template.options.groupBy && template.options.groupBy !== 'none' && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Group By:</span>
                <span className="text-gray-900 dark:text-white font-medium capitalize">
                  {template.options.groupBy}
                </span>
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Created {new Date(template.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
});