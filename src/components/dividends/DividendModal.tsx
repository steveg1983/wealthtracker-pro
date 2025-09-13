import React, { useEffect, memo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import type { Dividend, DividendModalProps, DividendFormData } from './types';
import { logger } from '../../services/loggingService';

export const DividendModal = memo(function DividendModal({ 
  dividend, 
  symbols, 
  onSave, 
  onClose 
}: DividendModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('DividendModal component initialized', {
      componentName: 'DividendModal'
    });
  }, []);

  const [formData, setFormData] = useState<DividendFormData>({
    symbol: dividend?.symbol || '',
    amount: dividend?.amount || 0,
    amountPerShare: dividend?.amountPerShare || 0,
    paymentDate: dividend?.paymentDate || new Date(),
    exDividendDate: dividend?.exDividendDate || new Date(),
    recordDate: dividend?.recordDate,
    declarationDate: dividend?.declarationDate,
    frequency: dividend?.frequency || 'quarterly',
    type: dividend?.type || 'regular',
    taxWithheld: dividend?.taxWithheld || 0,
    reinvested: dividend?.reinvested || false,
    reinvestmentPrice: dividend?.reinvestmentPrice || 0,
    reinvestmentShares: dividend?.reinvestmentShares || 0,
    notes: dividend?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...dividend,
      ...formData
    });
  };

  return (
    <Modal isOpen onClose={onClose} title={dividend ? 'Edit Dividend' : 'Add Dividend'}>
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Symbol</label>
              <select
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              >
                <option value="">Select symbol</option>
                {symbols.map(sym => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Total Amount</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Payment Date</label>
              <input
                type="date"
                value={formData.paymentDate.toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, paymentDate: new Date(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Ex-Dividend Date</label>
              <input
                type="date"
                value={formData.exDividendDate.toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, exDividendDate: new Date(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as Dividend['frequency'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semi-annual">Semi-Annual</option>
                <option value="annual">Annual</option>
                <option value="special">Special</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Dividend['type'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="regular">Regular</option>
                <option value="special">Special</option>
                <option value="qualified">Qualified</option>
                <option value="non-qualified">Non-Qualified</option>
                <option value="return-of-capital">Return of Capital</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Tax Withheld</label>
              <input
                type="number"
                step="0.01"
                value={formData.taxWithheld}
                onChange={(e) => setFormData({ ...formData, taxWithheld: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            
            <div className="flex items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.reinvested}
                  onChange={(e) => setFormData({ ...formData, reinvested: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm font-medium">Reinvested</span>
              </label>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              rows={2}
            />
          </div>
        </ModalBody>
        
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            {dividend ? 'Update' : 'Add'} Dividend
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
});