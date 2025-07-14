import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useCurrency } from '../hooks/useCurrency';
import { getCurrencySymbol } from '../utils/currency';

interface AddInvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string;
}

export default function AddInvestmentModal({ isOpen, onClose, accountId }: AddInvestmentModalProps) {
  const { accounts, addTransaction } = useApp();
  const { formatCurrency } = useCurrency();
  
  // Form state
  const [selectedAccountId, setSelectedAccountId] = useState(accountId || '');
  const [investmentType, setInvestmentType] = useState<'fund' | 'share' | 'cash' | 'other'>('share');
  const [stockCode, setStockCode] = useState('');
  const [name, setName] = useState('');
  const [units, setUnits] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [fees, setFees] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // Filter to only show investment accounts
  const investmentAccounts = accounts.filter(acc => acc.type === 'investment');
  
  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setInvestmentType('share');
      setStockCode('');
      setName('');
      setUnits('');
      setPricePerUnit('');
      setFees('');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      if (!accountId) {
        setSelectedAccountId('');
      }
    }
  }, [isOpen, accountId]);
  
  // Calculate total cost
  const calculateTotal = () => {
    const unitsNum = parseFloat(units) || 0;
    const priceNum = parseFloat(pricePerUnit) || 0;
    const feesNum = parseFloat(fees) || 0;
    return unitsNum * priceNum + feesNum;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAccountId || !name || !units || !pricePerUnit) {
      alert('Please fill in all required fields');
      return;
    }
    
    const total = calculateTotal();
    const account = accounts.find(a => a.id === selectedAccountId);
    
    // Create the investment transaction
    const description = `${investmentType === 'share' ? 'Buy' : 'Investment'}: ${name}${stockCode ? ` (${stockCode})` : ''} - ${units} units @ ${formatCurrency(parseFloat(pricePerUnit), account?.currency || 'GBP')}/unit`;
    
    // Structure the notes in a parseable format
    const structuredNotes = [
      `Investment Type: ${investmentType}`,
      `Stock Code: ${stockCode || 'N/A'}`,
      `Units: ${units}`,
      `Price per unit: ${pricePerUnit}`,
      `Fees: ${fees || '0'}`
    ].join('\n');
    
    addTransaction({
      date: new Date(date),
      description,
      amount: total,
      type: 'expense',
      category: 'cat-27', // Investment category
      accountId: selectedAccountId,
      notes: notes ? `${structuredNotes}\n\nAdditional Notes: ${notes}` : structuredNotes,
      tags: ['investment', investmentType, stockCode].filter(Boolean)
    });
    
    onClose();
  };
  
  if (!isOpen) return null;
  
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const currencySymbol = selectedAccount ? getCurrencySymbol(selectedAccount.currency) : '£';
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Investment</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {/* Account Selection */}
          {!accountId && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Investment Account*
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Select an investment account</option>
                {investmentAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.institution || 'Investment'})
                  </option>
                ))}
              </select>
              {investmentAccounts.length === 0 && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  No investment accounts found. Please create an investment account first.
                </p>
              )}
            </div>
          )}
          
          {/* Investment Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category of Investment*
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'fund', label: 'Fund' },
                { value: 'share', label: 'Share' },
                { value: 'cash', label: 'Cash' },
                { value: 'other', label: 'Other' }
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setInvestmentType(type.value as any)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    investmentType === type.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stock/Fund Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {investmentType === 'fund' ? 'Fund Code' : investmentType === 'share' ? 'Stock Code' : 'Reference'} 
                {investmentType !== 'cash' && <span className="text-gray-400 text-xs ml-1">(e.g. AAPL)</span>}
              </label>
              <input
                type="text"
                value={stockCode}
                onChange={(e) => setStockCode(e.target.value.toUpperCase())}
                placeholder={investmentType === 'share' ? 'AAPL' : investmentType === 'fund' ? 'ISIN/SEDOL' : 'Optional'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                disabled={investmentType === 'cash'}
              />
            </div>
            
            {/* Investment Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Investment Name*
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={investmentType === 'share' ? 'Apple Inc.' : investmentType === 'fund' ? 'Fund Name' : 'Description'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            {/* Number of Units */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {investmentType === 'cash' ? 'Amount' : 'Number of Units/Shares'}*
              </label>
              <input
                type="number"
                step="0.0001"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder={investmentType === 'cash' ? '1000.00' : '100'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            {/* Price per Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {investmentType === 'cash' ? `Price per Unit (${currencySymbol})` : `Price per Unit/Share (${currencySymbol})`}*
              </label>
              <input
                type="number"
                step="0.01"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                placeholder={investmentType === 'cash' ? '1.00' : '150.00'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            {/* Fees */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Other Fees/Costs ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Purchase Date*
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
          </div>
          
          {/* Total Cost Display */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Cost:</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(calculateTotal(), selectedAccount?.currency || 'GBP')}
              </span>
            </div>
            {fees && parseFloat(fees) > 0 && (
              <div className="flex justify-between items-center mt-1 text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  ({units || '0'} × {currencySymbol}{pricePerUnit || '0'} + {currencySymbol}{fees} fees)
                </span>
              </div>
            )}
          </div>
          
          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional information about this investment..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              Add Investment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}