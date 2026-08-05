import React, { useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal, toStorageNumber } from '../utils/decimal';
import {
  PlusIcon,
  PlayIcon,
  StopIcon,
  CopyIcon,
  TrashIcon,
  SettingsIcon,
  RepeatIcon
} from './icons';

type RecurringFrequency = 'monthly' | 'weekly' | 'biweekly' | 'quarterly' | 'yearly';

interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  budgetItems: Array<{
    name: string;
    amount: number;
    categoryIds: string[];
    color: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  totalAmount: number;
  isActive: boolean;
  frequency: RecurringFrequency;
  nextApplicationDate: Date;
  createdAt: Date;
  lastApplied?: Date;
}

interface RecurringSettings {
  autoApply: boolean;
  notificationDays: number;
  skipWeekends: boolean;
}

export default function RecurringBudgetTemplates() {
  const { categories, budgets, addBudget, updateBudget } = useApp();
  const { showSuccess, showError } = useToast();
  const { formatCurrency } = useCurrencyDecimal();

  const [templates, setTemplates] = useLocalStorage<BudgetTemplate[]>('budget-templates', []);
  const [recurringSettings, setRecurringSettings] = useLocalStorage<RecurringSettings>('recurring-settings', {
    autoApply: false,
    notificationDays: 3,
    skipWeekends: true
  });

  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    frequency: 'monthly' as RecurringFrequency
  });

  const createTemplateFromCurrent = () => {
    if (!newTemplate.name) return;

    const budgetItems = budgets.map(budget => {
      // Find category name for the budget
      const categoryName = categories.find(c => c.id === budget.categoryId)?.name || budget.categoryId;
      
      return {
        name: categoryName,
        amount: budget.amount,
        categoryIds: [budget.categoryId],
        color: '#3B82F6', // Default color
        priority: 'medium' as const
      };
    });

    const totalAmount = toStorageNumber(
      budgetItems.reduce((sum, item) => sum.plus(toDecimal(item.amount)), toDecimal(0))
    );
    const nextApplicationDate = calculateNextDate(newTemplate.frequency);

    const template: BudgetTemplate = {
      id: Date.now().toString(),
      name: newTemplate.name,
      description: newTemplate.description,
      budgetItems,
      totalAmount,
      isActive: false,
      frequency: newTemplate.frequency,
      nextApplicationDate,
      createdAt: new Date()
    };

    setTemplates([...templates, template]);
    setNewTemplate({ name: '', description: '', frequency: 'monthly' });
    setShowCreateTemplate(false);
  };

  const calculateNextDate = (frequency: RecurringFrequency): Date => {
    const now = new Date();
    const next = new Date(now);
    
    switch (frequency) {
      case 'weekly':
        next.setDate(now.getDate() + 7);
        break;
      case 'biweekly':
        next.setDate(now.getDate() + 14);
        break;
      case 'monthly':
        next.setMonth(now.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(now.getMonth() + 3);
        break;
      case 'yearly':
        next.setFullYear(now.getFullYear() + 1);
        break;
      default:
        next.setMonth(now.getMonth() + 1);
    }
    
    // Skip weekends if enabled
    if (recurringSettings.skipWeekends) {
      const day = next.getDay();
      if (day === 0) next.setDate(next.getDate() + 1); // Sunday -> Monday
      if (day === 6) next.setDate(next.getDate() + 2); // Saturday -> Monday
    }
    
    return next;
  };

  /**
   * Apply a template by UPSERTING one budget per category.
   *
   * This used to delete every budget first whenever "rollover unspent" was off.
   * Against the localStorage store that was merely rude; against the real store
   * it would wipe the owner's budgets — including categories the template has
   * never heard of — with no undo. A template now sets the amount for the
   * categories it names and leaves every other budget alone.
   */
  const applyTemplate = async (template: BudgetTemplate) => {
    if (applyingTemplateId !== null) return;
    setApplyingTemplateId(template.id);

    const now = new Date();

    try {
      for (const item of template.budgetItems) {
        const categoryId = item.categoryIds[0];
        if (!categoryId) continue;

        const amount = toStorageNumber(toDecimal(item.amount));
        const existing = budgets.find(budget => budget.categoryId === categoryId);

        if (existing) {
          if (existing.amount === amount && existing.isActive) continue;
          // `updatedAt` is stamped by the persistence layer, not passed in.
          await updateBudget(existing.id, { amount, isActive: true });
        } else {
          await addBudget({
            categoryId,
            amount,
            period: 'monthly',
            isActive: true,
            createdAt: now,
            updatedAt: now
          });
        }
      }

      // Update template
      const updatedTemplate = {
        ...template,
        lastApplied: new Date(),
        nextApplicationDate: calculateNextDate(template.frequency)
      };

      setTemplates(templates.map(t => t.id === template.id ? updatedTemplate : t));
      showSuccess(
        `${template.budgetItems.length} budget${template.budgetItems.length === 1 ? '' : 's'} set from “${template.name}”`,
        'Template applied'
      );
    } catch (error) {
      showError(error);
    } finally {
      setApplyingTemplateId(null);
    }
  };

  const toggleTemplateActive = (templateId: string) => {
    setTemplates(templates.map(template => 
      template.id === templateId 
        ? { ...template, isActive: !template.isActive }
        : template
    ));
  };

  const deleteTemplate = (templateId: string) => {
    setTemplates(templates.filter(t => t.id !== templateId));
  };

  const duplicateTemplate = (template: BudgetTemplate) => {
    const newTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Copy)`,
      isActive: false,
      createdAt: new Date(),
      lastApplied: undefined
    };
    setTemplates([...templates, newTemplate]);
  };

  const getFrequencyText = (frequency: string) => {
    switch (frequency) {
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Bi-weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'yearly': return 'Yearly';
      default: return 'Monthly';
    }
  };

  const getStatusColor = (template: BudgetTemplate) => {
    if (!template.isActive) return 'bg-gray-100 text-gray-800 border-gray-200';
    
    const now = new Date();
    const nextDate = new Date(template.nextApplicationDate);
    const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= recurringSettings.notificationDays) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStatusText = (template: BudgetTemplate) => {
    if (!template.isActive) return 'Inactive';
    
    const now = new Date();
    const nextDate = new Date(template.nextApplicationDate);
    const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 0) return 'Ready to Apply';
    if (daysUntil <= recurringSettings.notificationDays) return `Due in ${daysUntil} days`;
    
    return 'Active';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Budget Templates</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create recurring budget templates to automatically apply budgets
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <SettingsIcon size={16} />
            Settings
          </button>
          <button
            onClick={() => setShowCreateTemplate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            <PlusIcon size={16} />
            Create Template
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">{template.name}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(template)}`}>
                {getStatusText(template)}
              </span>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{template.description}</p>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(template.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Frequency:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {getFrequencyText(template.frequency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Next Application:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {new Date(template.nextApplicationDate).toLocaleDateString()}
                </span>
              </div>
              {template.lastApplied && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Last Applied:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(template.lastApplied).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Budget Items Preview */}
            <div className="mb-4">
              <span className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">
                Budget Items ({template.budgetItems.length}):
              </span>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {template.budgetItems.slice(0, 3).map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
                {template.budgetItems.length > 3 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    +{template.budgetItems.length - 3} more
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => applyTemplate(template)}
                disabled={applyingTemplateId !== null}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  applyingTemplateId !== null
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <PlayIcon size={14} />
                {applyingTemplateId === template.id ? 'Applying…' : 'Apply'}
              </button>
              <button
                onClick={() => toggleTemplateActive(template.id)}
                className={`flex items-center justify-center p-2 rounded-lg ${
                  template.isActive
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                {template.isActive ? <StopIcon size={16} /> : <PlayIcon size={16} />}
              </button>
              <button
                onClick={() => duplicateTemplate(template)}
                className="flex items-center justify-center p-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d]"
              >
                <CopyIcon size={16} />
              </button>
              <button
                onClick={() => deleteTemplate(template.id)}
                className="flex items-center justify-center p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <TrashIcon size={16} />
              </button>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {templates.length === 0 && (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 text-center">
            <RepeatIcon className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Templates Yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create budget templates to automatically apply recurring budgets
            </p>
            <button
              onClick={() => setShowCreateTemplate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              <PlusIcon size={16} />
              Create Your First Template
            </button>
          </div>
        )}
      </div>

      {/* Create Template Modal */}
      {showCreateTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Budget Template</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Monthly Budget"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Brief description of this template..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Frequency
                </label>
                <select
                  value={newTemplate.frequency}
                  onChange={(e) =>
                    setNewTemplate({
                      ...newTemplate,
                      frequency: e.target.value as RecurringFrequency
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Template Preview</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  This template will include {budgets.length} budget items with a total of {formatCurrency(budgets.reduce((sum, b) => sum.plus(toDecimal(b.amount)), toDecimal(0)))}
                </p>
                <p className="mt-2 text-xs text-blue-800 dark:text-blue-200">
                  Applying a template sets the amount for the categories it names. Budgets for other
                  categories are left untouched.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateTemplate(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={createTemplateFromCurrent}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recurring Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Auto-apply templates
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Automatically apply templates on schedule
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={recurringSettings.autoApply}
                  onChange={(e) => setRecurringSettings({
                    ...recurringSettings,
                    autoApply: e.target.checked
                  })}
                  className="rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notification days before application
                </label>
                <input
                  type="number"
                  value={recurringSettings.notificationDays}
                  onChange={(e) => setRecurringSettings({
                    ...recurringSettings,
                    notificationDays: parseInt(e.target.value) || 3
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Skip weekends
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Move weekend dates to Monday
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={recurringSettings.skipWeekends}
                  onChange={(e) => setRecurringSettings({
                    ...recurringSettings,
                    skipWeekends: e.target.checked
                  })}
                  className="rounded"
                />
              </div>

            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
