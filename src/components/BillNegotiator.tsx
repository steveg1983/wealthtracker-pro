import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { advancedAnalyticsService, type BillNegotiationSuggestion } from '../services/advancedAnalyticsService';
import { Modal } from './common/Modal';
import { 
  PhoneIcon, 
  CheckIcon, 
  InfoIcon,
  DollarSignIcon
} from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { format } from 'date-fns';

export default function BillNegotiator() {
  const { transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [suggestions, setSuggestions] = useState<BillNegotiationSuggestion[]>([]);
  const [selectedBill, setSelectedBill] = useState<BillNegotiationSuggestion | null>(null);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [completedNegotiations, setCompletedNegotiations] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCompletedNegotiations();
  }, []);

  const analyzeBills = useCallback(() => {
    const billSuggestions = advancedAnalyticsService.suggestBillNegotiations(transactions);
    setSuggestions(billSuggestions);
  }, [transactions]);

  useEffect(() => {
    analyzeBills();
  }, [analyzeBills]);

  const loadCompletedNegotiations = () => {
    const saved = localStorage.getItem('completedNegotiations');
    if (saved) {
      setCompletedNegotiations(new Set(JSON.parse(saved)));
    }
  };

  const markAsCompleted = (merchant: string) => {
    const updated = new Set(completedNegotiations).add(merchant);
    setCompletedNegotiations(updated);
    localStorage.setItem('completedNegotiations', JSON.stringify(Array.from(updated)));
  };

  const handleNegotiationClick = (bill: BillNegotiationSuggestion) => {
    setSelectedBill(bill);
    setShowTipsModal(true);
  };

  const totalPotentialSavings = suggestions.reduce(
    (sum, s) => sum.plus(s.potentialSavings), 
    toDecimal(0)
  );

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 70) return 'text-green-600 dark:text-green-400';
    if (rate >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">Bill Negotiation Assistant</h3>
            <p className="text-green-100">
              AI-powered suggestions to reduce your recurring bills
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-green-100">Potential Annual Savings</p>
            <p className="text-3xl font-bold">{formatCurrency(totalPotentialSavings.times(12))}</p>
          </div>
        </div>
      </div>

      {/* Suggestions List */}
      {suggestions.length > 0 ? (
        <div className="space-y-4">
          {suggestions.map((suggestion) => {
            const isCompleted = completedNegotiations.has(suggestion.merchant);
            
            return (
              <div
                key={suggestion.merchant}
                className={`bg-[#d4dce8] dark:bg-gray-800 rounded-xl p-6 border ${
                  isCompleted 
                    ? 'border-green-200 dark:border-green-800 opacity-75' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {suggestion.merchant}
                      </h4>
                      {isCompleted && (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                          <CheckIcon size={16} />
                          Negotiated
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Current Bill</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(suggestion.currentAmount)}/month
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Potential Savings</p>
                        <p className="font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(suggestion.potentialSavings)}/month
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Success Rate</p>
                        <p className={`font-medium ${getSuccessRateColor(suggestion.successRate)}`}>
                          {suggestion.successRate}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
                      <span>Category: {suggestion.category}</span>
                      <span>Last bill: {format(suggestion.lastTransactionDate, 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  <div className="ml-6">
                    {!isCompleted ? (
                      <button
                        onClick={() => handleNegotiationClick(suggestion)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <PhoneIcon size={16} />
                        Negotiate
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const updated = new Set(completedNegotiations);
                          updated.delete(suggestion.merchant);
                          setCompletedNegotiations(updated);
                          localStorage.setItem('completedNegotiations', JSON.stringify(Array.from(updated)));
                        }}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center">
          <DollarSignIcon size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Negotiable Bills Found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            We'll analyze your recurring bills and suggest ones that could be negotiated for better rates.
          </p>
        </div>
      )}

      {/* Negotiation Tips Modal */}
      {selectedBill && (
        <Modal
          isOpen={showTipsModal}
          onClose={() => {
            setShowTipsModal(false);
            setSelectedBill(null);
          }}
          title={`Negotiate ${selectedBill.merchant}`}
          size="md"
        >
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  Potential Monthly Savings
                </span>
                <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  {formatCurrency(selectedBill.potentialSavings)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  Success Rate
                </span>
                <span className={`font-medium ${getSuccessRateColor(selectedBill.successRate)}`}>
                  {selectedBill.successRate}%
                </span>
              </div>
            </div>

            {/* Negotiation Tips */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <InfoIcon size={20} />
                Negotiation Tips
              </h3>
              <ul className="space-y-2">
                {selectedBill.negotiationTips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckIcon size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Call Script */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Sample Script
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
                <p className="mb-2">
                  "Hi, I've been a loyal customer for [time period] and I'm reviewing my monthly expenses. 
                  I've noticed that competitors are offering similar services for less."
                </p>
                <p className="mb-2">
                  "I'd like to stay with {selectedBill.merchant}, but I need to reduce my monthly costs. 
                  What options do you have available for loyal customers?"
                </p>
                <p>
                  "If we can't find a solution, I'll need to consider switching to [competitor]."
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  markAsCompleted(selectedBill.merchant);
                  setShowTipsModal(false);
                  setSelectedBill(null);
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Mark as Negotiated
              </button>
              <button
                onClick={() => {
                  setShowTipsModal(false);
                  setSelectedBill(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
