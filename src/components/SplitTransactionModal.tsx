import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Plus, Trash2 } from 'lucide-react';

interface SplitTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
}

interface SplitItem {
  category: string;
  amount: number;
  description: string;
}

export default function SplitTransactionModal({ isOpen, onClose, transaction }: SplitTransactionModalProps) {
  const { updateTransaction, addTransaction, deleteTransaction } = useApp();
  const [splits, setSplits] = useState<SplitItem[]>([
    { category: '', amount: 0, description: '' }
  ]);
  const [remainingAmount, setRemainingAmount] = useState(0);

  useEffect(() => {
    if (transaction) {
      // If transaction already has splits, load them
      if (transaction.splits) {
        setSplits(transaction.splits);
      } else {
        // Initialize with transaction amount
        setSplits([{ 
          category: transaction.category, 
          amount: transaction.amount, 
          description: transaction.description 
        }]);
      }
    }
  }, [transaction]);

  useEffect(() => {
    if (transaction) {
      const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0);
      setRemainingAmount(transaction.amount - totalSplit);
    }
  }, [splits, transaction]);

  const handleAddSplit = () => {
    setSplits([...splits, { category: '', amount: remainingAmount > 0 ? remainingAmount : 0, description: '' }]);
  };

  const handleRemoveSplit = (index: number) => {
    setSplits(splits.filter((_, i) => i !== index));
  };

  const handleSplitChange = (index: number, field: keyof SplitItem, value: any) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setSplits(newSplits);
  };

  const handleSave = () => {
    if (Math.abs(remainingAmount) > 0.01) {
      alert('Split amounts must equal the transaction total');
      return;
    }

    if (splits.length === 1) {
      // Just update the original transaction
      updateTransaction(transaction.id, {
        ...transaction,
        category: splits[0].category,
        description: splits[0].description
      });
    } else {
      // Delete original transaction and create split transactions
      deleteTransaction(transaction.id);
      
      splits.forEach((split, index) => {
        addTransaction({
          date: transaction.date,
          amount: split.amount,
          description: `${split.description} (Split ${index + 1}/${splits.length})`,
          type: transaction.type,
          category: split.category,
          accountId: transaction.accountId,
          originalTransactionId: transaction.id,
          isSplit: true
        });
      });
    }

    onClose();
  };

  if (!isOpen || !transaction) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Split Transaction</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Original Amount: <span className="font-semibold">{formatCurrency(transaction.amount)}</span>
          </p>
          <p className={`text-sm ${Math.abs(remainingAmount) > 0.01 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            Remaining: <span className="font-semibold">{formatCurrency(remainingAmount)}</span>
          </p>
        </div>

        <div className="space-y-3 mb-4">
          {splits.map((split, index) => (
            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <input
                    type="text"
                    placeholder="Category"
                    value={split.category}
                    onChange={(e) => handleSplitChange(index, 'category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    placeholder="Amount"
                    value={split.amount}
                    onChange={(e) => handleSplitChange(index, 'amount', parseFloat(e.target.value) || 0)}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="text"
                    placeholder="Description"
                    value={split.description}
                    onChange={(e) => handleSplitChange(index, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="col-span-1 flex items-center">
                  {splits.length > 1 && (
                    <button
                      onClick={() => handleRemoveSplit(index)}
                      className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleAddSplit}
          className="mb-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
        >
          <Plus size={20} />
          Add Split
        </button>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={Math.abs(remainingAmount) > 0.01}
            className={`flex-1 px-4 py-2 rounded-lg ${
              Math.abs(remainingAmount) <= 0.01
                ? 'bg-primary text-white hover:bg-secondary'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            Save Split
          </button>
        </div>
      </div>
    </div>
  );
}
