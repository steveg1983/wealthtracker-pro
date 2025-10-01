import React, { useState, useEffect } from 'react';
import { 
  CalendarIcon as Calendar,
  Repeat as Repeat,
  PlusIcon as Plus,
  EditIcon as Edit2,
  DeleteIcon as Trash2,
  PlayIcon as Play,
  PauseIcon as Pause,
  ClockIcon as Clock,
  AlertCircleIcon as AlertCircle,
  CheckIcon as Check
} from './icons';
import { useApp } from '../contexts/AppContextSupabase';
import { toMoney } from '../types/money';
import type { Transaction } from '../types';
import { format, addDays, addWeeks, addMonths, addYears, isBefore, isAfter } from 'date-fns';
import { formatCurrency } from '../utils/formatters';
import { logger } from '../services/loggingService';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringTemplate {
  id: string;
  name: string;
  description: string;
  amount: string;
  category: string;
  accountId: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string;
  nextDate: string;
  isActive: boolean;
  lastProcessed?: string;
  occurrences: number;
  maxOccurrences?: number;
  dayOfMonth?: number; // For monthly recurrence
  dayOfWeek?: number; // For weekly recurrence (0-6)
  tags?: string[];
  notes?: string;
}

export default function RecurringTransactions(): React.JSX.Element {
  const { accounts, categories, addTransaction } = useApp();
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null);
  const [processingTemplates, setProcessingTemplates] = useState<Set<string>>(new Set());

  // Load templates from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recurringTemplates');
    if (stored) {
      setTemplates(JSON.parse(stored));
    }
  }, []);

  // Save templates to localStorage
  useEffect(() => {
    localStorage.setItem('recurringTemplates', JSON.stringify(templates));
  }, [templates]);

  // Check and process due templates on mount and daily
  useEffect(() => {
    processDueTemplates();
    
    // Check every hour
    const interval = setInterval(processDueTemplates, 3600000);
    return () => clearInterval(interval);
  }, [templates]);

  const processDueTemplates = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const dueTemplates = templates.filter(t => 
      t.isActive && 
      t.nextDate <= today && 
      (!t.endDate || t.nextDate <= t.endDate)
    );

    dueTemplates.forEach(template => {
      if (!processingTemplates.has(template.id)) {
        processTemplate(template);
      }
    });
  };

  const processTemplate = async (template: RecurringTemplate) => {
    setProcessingTemplates(prev => new Set(prev).add(template.id));

    try {
      // Create transaction from template
      const normalized = toMoney(template.amount);
      const baseTransaction = {
        date: new Date(template.nextDate),
        description: template.description,
        amount: Number(normalized),
        category: template.category,
        accountId: template.accountId,
        type: Number(normalized) > 0 ? 'income' as const : 'expense' as const,
        notes: `Recurring: ${template.name}${template.notes ? '\n' + template.notes : ''}`,
        cleared: false
      };

      const tags = template.tags;
      const transaction: Omit<Transaction, 'id'> =
        tags && tags.length > 0
          ? { ...baseTransaction, tags }
          : baseTransaction;

      // Add transaction
      await addTransaction(transaction);

      // Update template
      const nextDate = calculateNextDate(template.nextDate, template.frequency);
      setTemplates(prev => prev.map(t => 
        t.id === template.id
          ? {
              ...t,
              nextDate,
              lastProcessed: template.nextDate,
              occurrences: t.occurrences + 1,
              isActive: t.maxOccurrences ? t.occurrences + 1 < t.maxOccurrences : true
            }
          : t
      ));
    } catch (error) {
      logger.error('Failed to process recurring template:', error);
    } finally {
      setProcessingTemplates(prev => {
        const next = new Set(prev);
        next.delete(template.id);
        return next;
      });
    }
  };

  const calculateNextDate = (currentDate: string, frequency: RecurrenceFrequency): string => {
    const date = new Date(currentDate);
    
    switch (frequency) {
      case 'daily':
        return format(addDays(date, 1), 'yyyy-MM-dd');
      case 'weekly':
        return format(addWeeks(date, 1), 'yyyy-MM-dd');
      case 'biweekly':
        return format(addWeeks(date, 2), 'yyyy-MM-dd');
      case 'monthly':
        return format(addMonths(date, 1), 'yyyy-MM-dd');
      case 'quarterly':
        return format(addMonths(date, 3), 'yyyy-MM-dd');
      case 'yearly':
        return format(addYears(date, 1), 'yyyy-MM-dd');
      default:
        return currentDate;
    }
  };

  const handleAddTemplate = (template: Omit<RecurringTemplate, 'id' | 'occurrences'>) => {
    const newTemplate: RecurringTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      occurrences: 0
    };
    setTemplates(prev => [...prev, newTemplate]);
    setShowAddModal(false);
  };

  const handleUpdateTemplate = (template: RecurringTemplate) => {
    setTemplates(prev => prev.map(t => t.id === template.id ? template : t));
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this recurring transaction?')) {
      setTemplates(prev => prev.filter(t => t.id !== id));
    }
  };

  const toggleTemplateActive = (id: string) => {
    setTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, isActive: !t.isActive } : t
    ));
  };

  const getFrequencyLabel = (frequency: RecurrenceFrequency): string => {
    const labels: Record<RecurrenceFrequency, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly'
    };
    return labels[frequency];
  };

  const getStatusColor = (template: RecurringTemplate): string => {
    if (!template.isActive) return 'text-gray-500';
    if (processingTemplates.has(template.id)) return 'text-gray-500';
    
    const today = new Date();
    const nextDate = new Date(template.nextDate);
    const daysUntilNext = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilNext <= 0) return 'text-red-500';
    if (daysUntilNext <= 3) return 'text-orange-500';
    if (daysUntilNext <= 7) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Recurring Transactions
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Automate regular transactions like bills and subscriptions
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Add Recurring
        </button>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
          <Repeat size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Recurring Transactions
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Set up recurring transactions for regular bills, subscriptions, and income
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map(template => (
            <div
              key={template.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Repeat size={20} className={getStatusColor(template)} />
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {template.name}
                    </h3>
                    {!template.isActive && (
                      <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                        Paused
                      </span>
                    )}
                    {processingTemplates.has(template.id) && (
                      <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-500 rounded-full">
                        Processing...
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {template.description}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                      <p className={`font-medium ${
                        parseFloat(template.amount) > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(parseFloat(template.amount))}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Frequency:</span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {getFrequencyLabel(template.frequency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Next Date:</span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {format(new Date(template.nextDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Occurrences:</span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {template.occurrences}
                        {template.maxOccurrences && ` / ${template.maxOccurrences}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => toggleTemplateActive(template.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      template.isActive
                        ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title={template.isActive ? 'Pause' : 'Resume'}
                  >
                    {template.isActive ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button
                    onClick={() => setEditingTemplate(template)}
                    className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal would go here - keeping this simple for now */}
      {(showAddModal || editingTemplate) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingTemplate ? 'Edit' : 'Add'} Recurring Transaction
            </h3>
            {/* Form would go here */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
