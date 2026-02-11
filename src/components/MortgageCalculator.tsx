import React, { useState, useEffect, useCallback } from 'react';
import { financialPlanningService } from '../services/financialPlanningService';
import { 
  HomeIcon,
  CalculatorIcon,
  TrashIcon,
  DollarSignIcon,
  TrendingUpIcon,
  PlusIcon
} from './icons';
import type { MortgageCalculation } from '../services/financialPlanningService';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';

interface MortgageCalculatorProps {
  onDataChange: () => void;
}

export default function MortgageCalculator({ onDataChange }: MortgageCalculatorProps) {
  const [calculations, setCalculations] = useState<MortgageCalculation[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [formData, setFormData] = useState({
    loanAmount: 400000,
    interestRate: 6.5,
    loanTermYears: 30
  });
  const [selectedCalculation, setSelectedCalculation] = useState<MortgageCalculation | null>(null);
  const { formatCurrency } = useCurrencyDecimal();

  const loadCalculations = useCallback(() => {
    const mortgageCalculations = financialPlanningService.getMortgageCalculations();
    setCalculations(mortgageCalculations);
    setSelectedCalculation((previous) => {
      if (previous) {
        const stillExists = mortgageCalculations.find(calc => calc.id === previous.id);
        if (stillExists) {
          return stillExists;
        }
      }
      return mortgageCalculations[0] ?? null;
    });
  }, []);

  useEffect(() => {
    loadCalculations();
  }, [loadCalculations]);

  const handleCalculate = () => {
    const calculation = financialPlanningService.calculateMortgage(
      formData.loanAmount,
      formData.interestRate / 100,
      formData.loanTermYears
    );
    setSelectedCalculation(calculation);
    setShowCalculator(false);
    loadCalculations();
    onDataChange();
  };

  const handleDeleteCalculation = (calculation: MortgageCalculation) => {
    if (window.confirm('Are you sure you want to delete this mortgage calculation?')) {
      financialPlanningService.deleteMortgageCalculation(calculation.id);
      loadCalculations();
      onDataChange();
    }
  };

  const formatPercentage = (value: number) => `${formatDecimal(value * 100, 2)}%`;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mortgage Calculator</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Calculate mortgage payments and view amortization schedules
          </p>
        </div>
        <button
          onClick={() => setShowCalculator(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <CalculatorIcon size={16} />
          New Calculation
        </button>
      </div>

      {calculations.length === 0 ? (
        <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-sm p-12 text-center">
          <HomeIcon size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No mortgage calculations yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Calculate your mortgage payments and view detailed amortization schedules
          </p>
          <button
            onClick={() => setShowCalculator(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            <CalculatorIcon size={16} />
            Calculate Mortgage
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calculations List */}
          <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Your Calculations</h3>
              <button
                onClick={() => setShowCalculator(true)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <PlusIcon size={16} />
              </button>
            </div>
            
            <div className="space-y-3">
              {calculations.map((calc) => (
                <div
                  key={calc.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedCalculation?.id === calc.id
                      ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedCalculation(calc)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(toDecimal(calc.loanAmount))}
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCalculation(calc);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <div>{formatPercentage(calc.interestRate)} • {calc.loanTermYears} years</div>
                    <div>{formatCurrency(toDecimal(calc.monthlyPayment))}/month</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Calculation Details */}
          <div className="lg:col-span-2 space-y-6">
            {selectedCalculation && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Payment</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(toDecimal(selectedCalculation.monthlyPayment))}
                        </p>
                      </div>
                      <DollarSignIcon size={24} className="text-blue-500" />
                    </div>
                  </div>

                  <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Interest</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(toDecimal(selectedCalculation.totalInterest))}
                        </p>
                      </div>
                      <TrendingUpIcon size={24} className="text-red-500" />
                    </div>
                  </div>
                </div>

                {/* Loan Details */}
                <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <HomeIcon size={20} />
                    Loan Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Loan Amount:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(toDecimal(selectedCalculation.loanAmount))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Interest Rate:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatPercentage(selectedCalculation.interestRate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Loan Term:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedCalculation.loanTermYears} years
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Monthly Payment:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(toDecimal(selectedCalculation.monthlyPayment))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Total Cost:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(toDecimal(selectedCalculation.totalCost))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Payoff Date:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatDate(selectedCalculation.payoffDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Amortization Preview */}
                <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    Amortization Schedule (First 12 Months)
                  </h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Payment</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Principal</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Interest</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {selectedCalculation.amortizationSchedule.slice(0, 12).map((entry) => (
                          <tr key={entry.paymentNumber}>
                            <td className="px-3 py-2 text-gray-900 dark:text-white">
                              {entry.paymentNumber}
                            </td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                              {formatDate(entry.paymentDate)}
                            </td>
                            <td className="px-3 py-2 text-green-600 dark:text-green-400">
                              {formatCurrency(toDecimal(entry.principalPayment))}
                            </td>
                            <td className="px-3 py-2 text-red-600 dark:text-red-400">
                              {formatCurrency(toDecimal(entry.interestPayment))}
                            </td>
                            <td className="px-3 py-2 text-gray-900 dark:text-white">
                              {formatCurrency(toDecimal(entry.remainingBalance))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="text-center mt-4 text-gray-500 dark:text-gray-400">
                    Showing first 12 of {selectedCalculation.amortizationSchedule.length} payments
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Calculator Modal */}
      {showCalculator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Calculate Mortgage
                </h3>
                <button
                  onClick={() => setShowCalculator(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <PlusIcon size={20} className="rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Loan Amount
                  </label>
                  <input
                    type="number"
                    value={formData.loanAmount}
                    onChange={(e) => setFormData({ ...formData, loanAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="0"
                    step="1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    value={formData.interestRate}
                    onChange={(e) => setFormData({ ...formData, interestRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="0"
                    max="20"
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Loan Term (years)
                  </label>
                  <select
                    value={formData.loanTermYears}
                    onChange={(e) => setFormData({ ...formData, loanTermYears: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value={15}>15 years</option>
                    <option value={20}>20 years</option>
                    <option value={25}>25 years</option>
                    <option value={30}>30 years</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCalculator(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCalculate}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
                >
                  Calculate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
