import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { taxPlanningService } from '../../services/taxPlanningService';
import { 
  CalculatorIcon,
  TrendingUpIcon,
  FileTextIcon,
  CalendarIcon
} from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { toDecimal, Decimal } from '../../utils/decimal';
import { useNavigate } from 'react-router-dom';

interface WidgetSettings {
  [key: string]: unknown;
}

interface TaxPlanningWidgetProps {
  size?: 'small' | 'medium' | 'large';
  settings?: WidgetSettings;
}

export default function TaxPlanningWidget({ size = 'medium' }: TaxPlanningWidgetProps) {
  const { transactions, accounts } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  
  const [taxData, setTaxData] = useState({
    estimatedTax: toDecimal(0),
    deductions: toDecimal(0),
    effectiveRate: 0,
    daysUntilDeadline: 0
  });

  const calculateTaxSummary = React.useCallback(() => {
    const estimate = taxPlanningService.estimateTaxes(transactions, accounts, currentYear);
    const deductibleExpenses = taxPlanningService.trackDeductibleExpenses(transactions, currentYear);
    
    const totalDeductions = deductibleExpenses.reduce(
      (sum, ded) => sum.plus(ded.amount), 
      toDecimal(0)
    );
    
    // Calculate days until tax deadline (April 15)
    const today = new Date();
    const taxDeadline = new Date(currentYear + (today.getMonth() < 3 ? 0 : 1), 3, 15);
    const daysUntilDeadline = Math.ceil((taxDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    setTaxData({
      estimatedTax: estimate.estimatedTax,
      deductions: totalDeductions,
    effectiveRate: estimate.effectiveRate,
    daysUntilDeadline: Math.max(0, daysUntilDeadline)
  });
  }, [transactions, accounts, currentYear]);

  const formatRate = React.useCallback((value: number) => {
    const decimalValue = toDecimal(value).toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
    const raw = decimalValue.toString();
    const isNegative = raw.startsWith('-');
    const unsignedRaw = isNegative ? raw.slice(1) : raw;
    const [integerPart, fractionalPart = ''] = unsignedRaw.split('.');
    const paddedFraction = fractionalPart.padEnd(1, '0');
    return `${isNegative ? '-' : ''}${integerPart}.${paddedFraction}`;
  }, []);

  useEffect(() => {
    calculateTaxSummary();
  }, [calculateTaxSummary]);

  const handleViewDetails = () => {
    navigate('/tax-planning');
  };

  if (size === 'small') {
    return (
      <div 
        className="h-full flex flex-col cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors p-3"
        onClick={handleViewDetails}
      >
        <div className="flex items-center justify-between mb-2">
          <CalculatorIcon size={20} className="text-green-600 dark:text-green-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Tax Planning</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(taxData.estimatedTax)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Est. Tax ({formatRate(taxData.effectiveRate)}%)
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <CalculatorIcon size={20} className="text-green-600 dark:text-green-400" />
          Tax Planning
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {currentYear} Tax Year
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        {/* Tax Deadline Alert */}
        {taxData.daysUntilDeadline <= 90 && taxData.daysUntilDeadline > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CalendarIcon size={16} className="text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {taxData.daysUntilDeadline} days until tax deadline
              </p>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Estimated Tax</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              {formatCurrency(taxData.estimatedTax)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {formatRate(taxData.effectiveRate)}% rate
            </p>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Deductions</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatCurrency(taxData.deductions)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Tracked YTD
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <FileTextIcon size={14} className="text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-800 dark:text-blue-200">
                Track receipts & documents
              </span>
            </div>
            <TrendingUpIcon size={14} className="text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        {/* View Details Button */}
        <button
          onClick={handleViewDetails}
          className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          View Tax Planning
        </button>
      </div>
    </div>
  );
}
