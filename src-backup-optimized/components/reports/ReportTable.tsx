import React, { useEffect, memo } from 'react';
import type { Category } from '../../types';
import { useLogger } from '../services/ServiceProvider';

export interface MonthData {
  key: string;
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface CategoryData {
  category: Category;
  monthlyData?: Array<{
    month: string;
    income: number;
    expenditure: number;
    net: number;
  }>;
  totalIncome?: number;
  totalExpenditure?: number;
  totalNet?: number;
  isIndented?: boolean;
  isDoubleIndented?: boolean;
  showSubtotal?: boolean;
  isHeader?: boolean;
}

interface ReportTableProps {
  months: MonthData[];
  categories: CategoryData[];
  monthlyTotals?: Array<{ month: string; income: number; expenditure: number }>;
  grandTotalIncome?: number;
  grandTotalExpenditure?: number;
  formatCurrency: (amount: number) => string;
  onCellClick?: (category: CategoryData, monthData: { income: number; expenditure: number }, month: MonthData) => void;
}

export const ReportTable = memo(function ReportTable({ months,
  categories,
  monthlyTotals,
  grandTotalIncome = 0,
  grandTotalExpenditure = 0,
  formatCurrency,
  onCellClick
 }: ReportTableProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ReportTable component initialized', {
      componentName: 'ReportTable'
    });
  }, []);

  const getCellColor = (income: number, expenditure: number, isNet?: boolean) => {
    if (isNet) {
      const net = income - expenditure;
      if (net > 0) return 'text-green-600 dark:text-green-400';
      if (net < 0) return 'text-red-600 dark:text-red-400';
      return 'text-gray-900 dark:text-white';
    }
    if (income > 0) return 'text-green-600 dark:text-green-400';
    if (expenditure > 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const handleCellClick = (categoryData: CategoryData, month: MonthData) => {
    if (!onCellClick || !categoryData.monthlyData) return;
    
    const monthData = categoryData.monthlyData.find(m => m.month === month.key);
    if (!monthData) return;
    
    onCellClick(categoryData, { 
      income: monthData.income, 
      expenditure: monthData.expenditure 
    }, month);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Category
            </th>
            {months.map(month => (
              <th key={month.key} className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                {month.label}
              </th>
            ))}
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {categories.map((categoryData, index) => {
            const { category, monthlyData, totalIncome = 0, totalExpenditure = 0, totalNet = 0 } = categoryData;
            const isHeader = categoryData.isHeader;
            const isSubtotal = categoryData.showSubtotal;
            
            return (
              <tr 
                key={`${category.id}-${index}`}
                className={`
                  ${isHeader ? 'bg-gray-50 dark:bg-gray-800 font-semibold' : ''}
                  ${isSubtotal ? 'bg-gray-50 dark:bg-gray-800 font-medium border-t-2 border-gray-300 dark:border-gray-600' : ''}
                  ${!isHeader && !isSubtotal ? 'hover:bg-gray-50 dark:hover:bg-gray-800' : ''}
                `}
              >
                <td className={`
                  sticky left-0 z-10 px-3 py-2 text-sm whitespace-nowrap
                  ${isHeader ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'}
                  ${isSubtotal ? 'bg-gray-50 dark:bg-gray-800' : ''}
                  ${categoryData.isIndented ? 'pl-8' : ''}
                  ${categoryData.isDoubleIndented ? 'pl-12' : ''}
                  ${isHeader ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-700 dark:text-gray-300'}
                `}>
                  {category.name}
                </td>
                {months.map(month => {
                  const data = monthlyData?.find(d => d.month === month.key);
                  const hasData = data && (data.income > 0 || data.expenditure > 0);
                  const displayValue = data ? 
                    (data.income > 0 ? data.income : data.expenditure > 0 ? data.expenditure : data.net) : 0;
                  
                  return (
                    <td 
                      key={month.key} 
                      className={`
                        px-3 py-2 text-sm text-right whitespace-nowrap
                        ${getCellColor(data?.income || 0, data?.expenditure || 0, category.name.includes('Net'))}
                        ${hasData && onCellClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
                      `}
                      onClick={() => hasData && handleCellClick(categoryData, month)}
                    >
                      {displayValue !== 0 ? formatCurrency(displayValue) : '-'}
                    </td>
                  );
                })}
                <td className={`
                  px-3 py-2 text-sm text-right whitespace-nowrap font-medium
                  ${getCellColor(totalIncome, totalExpenditure, category.name.includes('Net'))}
                `}>
                  {totalIncome > 0 ? formatCurrency(totalIncome) :
                   totalExpenditure > 0 ? formatCurrency(totalExpenditure) :
                   totalNet !== 0 ? formatCurrency(totalNet) : '-'}
                </td>
              </tr>
            );
          })}
          
          {/* Grand Total Row */}
          {monthlyTotals && (
            <tr className="bg-gray-100 dark:bg-gray-800 font-bold border-t-2 border-gray-300 dark:border-gray-600">
              <td className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 px-3 py-3 text-sm text-gray-900 dark:text-white">
                GRAND TOTAL
              </td>
              {months.map(month => {
                const total = monthlyTotals.find(t => t.month === month.key);
                const net = (total?.income || 0) - (total?.expenditure || 0);
                return (
                  <td 
                    key={month.key} 
                    className={`px-3 py-3 text-sm text-right whitespace-nowrap ${
                      net > 0 ? 'text-green-600 dark:text-green-400' :
                      net < 0 ? 'text-red-600 dark:text-red-400' :
                      'text-gray-900 dark:text-white'
                    }`}
                  >
                    {formatCurrency(net)}
                  </td>
                );
              })}
              <td className={`px-3 py-3 text-sm text-right whitespace-nowrap ${
                (grandTotalIncome - grandTotalExpenditure) > 0 ? 'text-green-600 dark:text-green-400' :
                (grandTotalIncome - grandTotalExpenditure) < 0 ? 'text-red-600 dark:text-red-400' :
                'text-gray-900 dark:text-white'
              }`}>
                {formatCurrency(grandTotalIncome - grandTotalExpenditure)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});