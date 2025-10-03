import { memo, useEffect } from 'react';
import { TrendingDownIcon as TrendingDown } from '../../icons';
import { RMDCalculatorService, type RMDCalculation } from '../../../services/rmdCalculatorService';
import { useLogger } from '../services/ServiceProvider';

interface RMDProjectionTableProps {
  projections: Array<{ age: number; balance: number; rmd: number }>;
  calculation: RMDCalculation;
  formatCurrency: (amount: number) => string;
}

/**
 * RMD projection table component
 * Shows 10-year projection of RMDs
 */
export const RMDProjectionTable = memo(function RMDProjectionTable({ projections,
  calculation,
  formatCurrency
 }: RMDProjectionTableProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RMDProjectionTable component initialized', {
      componentName: 'RMDProjectionTable'
    });
  }, []);

  if (projections.length === 0) return <></>;

  return (
    <div className="mt-6">
      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <TrendingDown className="h-5 w-5 text-gray-600" />
        10-Year RMD Projection (5% growth assumed)
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Age</th>
              <th className="text-right py-2 px-3">Account Balance</th>
              <th className="text-right py-2 px-3">Life Expectancy</th>
              <th className="text-right py-2 px-3">RMD Amount</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((projection, index) => {
              const distributionFactor = RMDCalculatorService.getDistributionFactor(
                projection.age,
                calculation.spouseBeneficiary,
                calculation.spouseAge ? calculation.spouseAge + index : undefined
              );

              return (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{projection.age}</td>
                  <td className="text-right py-2 px-3">
                    {formatCurrency(projection.balance)}
                  </td>
                  <td className="text-right py-2 px-3">
                    {distributionFactor.toFixed(1)}
                  </td>
                  <td className="text-right py-2 px-3 font-medium">
                    {formatCurrency(projection.rmd)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});