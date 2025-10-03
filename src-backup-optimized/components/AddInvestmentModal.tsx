import { useEffect } from 'react';
import { PlusIcon } from './icons/PlusIcon';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { getCurrencySymbol } from '../utils/currency';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useModalForm } from '../hooks/useModalForm';

interface AddInvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string;
}

interface FormData {
  selectedAccountId: string;
  investmentType: 'fund' | 'share' | 'cash' | 'other';
  stockCode: string;
  name: string;
  units: string;
  pricePerUnit: string;
  fees: string;
  stampDuty: string;
  date: string;
  notes: string;
}

export default function AddInvestmentModal({ isOpen, onClose, accountId }: AddInvestmentModalProps) {
  const { accounts, addTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const { formData, updateField, handleSubmit, setFormData } = useModalForm<FormData>(
    {
      selectedAccountId: accountId || '',
      investmentType: 'share',
      stockCode: '',
      name: '',
      units: '',
      pricePerUnit: '',
      fees: '',
      stampDuty: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    },
    {
      onSubmit: (data) => {
        if (!data.selectedAccountId || !data.name || !data.units || !data.pricePerUnit) {
          alert('Please fill in all required fields');
          return;
        }
        
        const unitsNum = parseFloat(data.units) || 0;
        const priceNum = parseFloat(data.pricePerUnit) || 0;
        const feesNum = parseFloat(data.fees) || 0;
        const stampDutyNum = parseFloat(data.stampDuty) || 0;
        const total = unitsNum * priceNum + feesNum + stampDutyNum;
        const account = accounts.find(a => a.id === data.selectedAccountId);
        
        // Create the investment transaction
        const description = `${data.investmentType === 'share' ? 'Buy' : 'Investment'}: ${data.name}${data.stockCode ? ` (${data.stockCode})` : ''} - ${data.units} units @ ${formatCurrency(parseFloat(data.pricePerUnit), account?.currency || 'GBP')}/unit`;
        
        // Structure the notes in a parseable format
        const structuredNotes = [
          `Investment Type: ${data.investmentType}`,
          `Stock Code: ${data.stockCode || 'N/A'}`,
          `Units: ${data.units}`,
          `Price per unit: ${data.pricePerUnit}`,
          `Transaction Fee: ${data.fees || '0'}`,
          `Stamp Duty: ${data.stampDuty || '0'}`
        ].join('\n');
        
        addTransaction({
          date: new Date(data.date),
          description,
          amount: -total,
          type: 'expense',
          category: 'cat-27', // Investment category
          accountId: data.selectedAccountId,
          notes: data.notes ? `${structuredNotes}\n\nAdditional Notes: ${data.notes}` : structuredNotes,
          tags: ['investment', data.investmentType, data.stockCode].filter(Boolean),
          investmentData: {
            symbol: data.stockCode,
            quantity: unitsNum,
            pricePerShare: priceNum,
            transactionFee: feesNum,
            stampDuty: stampDutyNum,
            totalCost: total
          }
        });
      },
      onClose
    }
  );
  
  // Filter to only show investment accounts
  const investmentAccounts = accounts.filter(acc => acc.type === 'investment');
  
  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        selectedAccountId: accountId || '',
        investmentType: 'share',
        stockCode: '',
        name: '',
        units: '',
        pricePerUnit: '',
        fees: '',
        stampDuty: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
  }, [isOpen, accountId, setFormData]);
  
  // Calculate total cost
  const calculateTotal = () => {
    const unitsNum = parseFloat(formData.units) || 0;
    const priceNum = parseFloat(formData.pricePerUnit) || 0;
    const feesNum = parseFloat(formData.fees) || 0;
    const stampDutyNum = parseFloat(formData.stampDuty) || 0;
    return unitsNum * priceNum + feesNum + stampDutyNum;
  };
  
  
  const selectedAccount = accounts.find(a => a.id === formData.selectedAccountId);
  const currencySymbol = selectedAccount ? getCurrencySymbol(selectedAccount.currency) : '£';
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Investment" size="xl">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          {/* Account Selection */}
          {!accountId && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Investment Account*
              </label>
              <select
                value={formData.selectedAccountId}
                onChange={(e) => updateField('selectedAccountId', e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
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
                  onClick={() => updateField('investmentType', type.value as FormData['investmentType'])}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    formData.investmentType === type.value
                      ? 'bg-gray-600 text-white'
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
                {formData.investmentType === 'fund' ? 'Fund Code' : formData.investmentType === 'share' ? 'Stock Code' : 'Reference'} 
                {formData.investmentType !== 'cash' && <span className="text-gray-400 text-xs ml-1">(e.g. AAPL)</span>}
              </label>
              <input
                type="text"
                value={formData.stockCode}
                onChange={(e) => updateField('stockCode', e.target.value.toUpperCase())}
                placeholder={formData.investmentType === 'share' ? 'AAPL' : formData.investmentType === 'fund' ? 'ISIN/SEDOL' : 'Optional'}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                disabled={formData.investmentType === 'cash'}
              />
            </div>
            
            {/* Investment Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Investment Name*
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder={formData.investmentType === 'share' ? 'Apple Inc.' : formData.investmentType === 'fund' ? 'Fund Name' : 'Description'}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                required
              />
            </div>
            
            {/* Number of Units */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {formData.investmentType === 'cash' ? 'Amount' : 'Number of Units/Shares'}*
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.units}
                onChange={(e) => updateField('units', e.target.value)}
                placeholder={formData.investmentType === 'cash' ? '1000.00' : '100'}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                required
              />
            </div>
            
            {/* Price per Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {formData.investmentType === 'cash' ? `Price per Unit (${currencySymbol})` : `Price per Unit/Share (${currencySymbol})`}*
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.pricePerUnit}
                onChange={(e) => updateField('pricePerUnit', e.target.value)}
                placeholder={formData.investmentType === 'cash' ? '1.00' : '150.00'}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                required
              />
            </div>
            
            {/* Transaction Fee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Transaction Fee ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.fees}
                onChange={(e) => updateField('fees', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              />
            </div>
            
            {/* Stamp Duty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stamp Duty/Levy ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.stampDuty}
                onChange={(e) => updateField('stampDuty', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              />
            </div>
            
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Purchase Date*
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateField('date', e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
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
            {(formData.units && formData.pricePerUnit) && (
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Shares: {formData.units} × {currencySymbol}{formData.pricePerUnit}</span>
                  <span>{currencySymbol}{(parseFloat(formData.units) * parseFloat(formData.pricePerUnit)).toFixed(2)}</span>
                </div>
                {parseFloat(formData.fees) > 0 && (
                  <div className="flex justify-between">
                    <span>Transaction Fee:</span>
                    <span>{currencySymbol}{formData.fees}</span>
                  </div>
                )}
                {parseFloat(formData.stampDuty) > 0 && (
                  <div className="flex justify-between">
                    <span>Stamp Duty:</span>
                    <span>{currencySymbol}{formData.stampDuty}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              placeholder="Additional information about this investment..."
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            />
          </div>
          
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <PlusIcon size={20} />
              Add Investment
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}