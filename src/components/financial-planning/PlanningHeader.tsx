import React, { useEffect, memo } from 'react';
import TaxYearSelector from '../financial/TaxYearSelector';
import type { UKTaxYear } from '../../services/taxDataService';
import { logger } from '../../services/loggingService';

interface PlanningHeaderProps {
  region: string;
  selectedTaxYear: UKTaxYear;
  onTaxYearChange: (year: UKTaxYear) => void;
}

const PlanningHeader = memo(function PlanningHeader({
  region,
  selectedTaxYear,
  onTaxYearChange
}: PlanningHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PlanningHeader component initialized', {
      componentName: 'PlanningHeader'
    });
  }, []);

  return (
    <div 
      className="rounded-2xl p-4 mb-6 text-gray-600 dark:text-gray-300 shadow-lg"
      style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(59, 130, 246, 0.1)'
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-lg">
          Plan for retirement, calculate mortgages, and achieve your financial goals
        </p>
        {region === 'UK' && (
          <TaxYearSelector 
            value={selectedTaxYear}
            onChange={onTaxYearChange}
          />
        )}
      </div>
    </div>
  );
});

export default PlanningHeader;