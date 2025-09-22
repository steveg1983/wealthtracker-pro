import React, { useEffect } from 'react';
import { RadioCheckbox } from '../../common/RadioCheckbox';
import CategorySelect from '../../CategorySelect';
import { IconButton } from '../../icons/IconButton';
import { EditIcon, CheckCircleIcon, CircleDotIcon, ChevronLeftIcon, ChevronRightIcon } from '../../icons';
import type { Transaction, Category } from '../../../types';
import { useLogger } from '../services/ServiceProvider';

interface ReconciliationTableProps {
  transactions: Transaction[];
  selectedTransactions: Set<string>;
  editingFields: Record<string, Partial<Transaction>>;
  categories: Category[];
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  formatCurrency: (amount: number) => string;
  onToggleSelection: (transactionId: string) => void;
  onFieldEdit: (transactionId: string, field: keyof Transaction, value: string | number | Date) => void;
  onSaveInlineEdits: (transactionId: string) => void;
  onSplitToggle: (transactionId: string) => void;
  onEdit: (transaction: Transaction) => void;
  onReconcile: (transactionId: string) => void;
  onPageChange: (page: number) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
}

export function ReconciliationTable({ transactions,
  selectedTransactions,
  editingFields,
  categories,
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  formatCurrency,
  onToggleSelection,
  onFieldEdit,
  onSaveInlineEdits,
  onSplitToggle,
  onEdit,
  onReconcile,
  onPageChange,
  onSelectAll,
  onDeselectAll
 }: ReconciliationTableProps): React.JSX.Element {
  const logger = useLogger();
  const isAllSelected = transactions.length > 0 && transactions.every(t => selectedTransactions.has(t.id));
  const isSomeSelected = selectedTransactions.size > 0;

  return (
    <>
      {/* Bulk Actions */}
      {isSomeSelected && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-900 dark:text-blue-100">
              {selectedTransactions.size} transaction{selectedTransactions.size === 1 ? '' : 's'} selected
            </span>
            <div className="flex gap-2">
              {isAllSelected && onDeselectAll ? (
                <button
                  onClick={onDeselectAll}
                  className="text-sm text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                >
                  Deselect All
                </button>
              ) : onSelectAll && (
                <button
                  onClick={onSelectAll}
                  className="text-sm text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                >
                  Select All
                </button>
              )}
              <button
                onClick={() => selectedTransactions.forEach(id => onReconcile(id))}
                className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
              >
                Reconcile Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Cards */}
      <div className="space-y-4">
        {transactions.map((transaction) => {
          const edits = editingFields[transaction.id] || {};
          const currentDate = edits.date || transaction.date;
          const currentDescription = edits.description !== undefined ? edits.description : transaction.description;
          const currentCategory = edits.category !== undefined ? edits.category : transaction.category;
          const isSplit = edits.isSplit !== undefined ? edits.isSplit : transaction.isSplit;
          
          return (
            <div
              key={transaction.id}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <div className="pt-5">
                  <RadioCheckbox
                    checked={selectedTransactions.has(transaction.id)}
                    onChange={() => onToggleSelection(transaction.id)}
                  />
                </div>
                
                {/* Transaction Details */}
                <div className="flex-1 grid grid-cols-12 gap-3">
                  {/* Date */}
                  <div className="col-span-12 md:col-span-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Date</label>
                    <input
                      type="date"
                      value={currentDate instanceof Date ? currentDate.toISOString().split('T')[0] : currentDate}
                      onChange={(e) => onFieldEdit(transaction.id, 'date', e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  
                  {/* Description */}
                  <div className="col-span-12 md:col-span-4">
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Description</label>
                    <input
                      type="text"
                      value={currentDescription}
                      onChange={(e) => onFieldEdit(transaction.id, 'description', e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  
                  {/* Category */}
                  <div className="col-span-12 md:col-span-5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-500 dark:text-gray-400">Category</label>
                      <div className="flex items-center gap-1">
                        <RadioCheckbox
                          id={`split-${transaction.id}`}
                          checked={isSplit || false}
                          onChange={() => onSplitToggle(transaction.id)}
                          className="h-3 w-3"
                        />
                        <label htmlFor={`split-${transaction.id}`} className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                          Split
                        </label>
                      </div>
                    </div>
                    <CategorySelect
                      value={currentCategory || ''}
                      onChange={(value) => onFieldEdit(transaction.id, 'category', value)}
                      categories={categories}
                      className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isSplit}
                      showMultiple={isSplit}
                    />
                  </div>
                </div>
                
                {/* Amount and Actions */}
                <div className="flex flex-col items-end ml-auto">
                  <div className="flex items-center gap-2 mb-2">
                    {edits && Object.keys(edits).length > 0 && (
                      <div className="relative group">
                        <button
                          onClick={() => onSaveInlineEdits(transaction.id)}
                          className="text-gray-600 hover:text-blue-700 dark:text-gray-500 dark:hover:text-gray-300"
                        >
                          <CheckCircleIcon size={18} />
                        </button>
                        <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
                          Save changes
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                            <div className="border-4 border-transparent border-t-gray-800"></div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="relative group">
                      <button
                        className={`${transaction.isImported ? 'text-gray-600 dark:text-gray-500' : 'text-gray-300 dark:text-gray-600'} cursor-default`}
                      >
                        <CircleDotIcon size={18} className={transaction.isImported ? 'fill-current' : ''} />
                      </button>
                      {transaction.isImported && (
                        <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
                          Bank Statement
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                            <div className="border-4 border-transparent border-t-gray-800"></div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="relative group">
                      <IconButton
                        onClick={() => onEdit(transaction)}
                        icon={<EditIcon size={18} />}
                        variant="ghost"
                        size="sm"
                        className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      />
                      <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
                        Advanced edit
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    </div>
                    <div className="relative group">
                      <button
                        onClick={() => onReconcile(transaction.id)}
                        className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                      >
                        <CheckCircleIcon size={20} className="font-bold" />
                      </button>
                      <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
                        Mark as reconciled
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={`text-lg font-bold whitespace-nowrap text-right ${
                    transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </div>
                </div>
              </div>
              
              {/* Notes section if exists */}
              {transaction.notes && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Notes:</span> {transaction.notes}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Showing {startIndex + 1} to {Math.min(endIndex, transactions.length)} of {transactions.length} transactions
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
              <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}