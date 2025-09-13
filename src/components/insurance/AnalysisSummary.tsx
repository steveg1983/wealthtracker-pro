import React, { useEffect, memo } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalCurrency';
import type { InsuranceAnalysis } from './types';
import { logger } from '../../services/loggingService';

interface AnalysisSummaryProps {
  analysis: InsuranceAnalysis;
}

export const AnalysisSummary = memo(function AnalysisSummary({ analysis }: AnalysisSummaryProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AnalysisSummary component initialized', {
      componentName: 'AnalysisSummary'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();

  const getCoverageScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-600 mb-1">Coverage Score</p>
        <p className={`text-2xl font-bold ${getCoverageScoreColor(analysis.coverageScore)}`}>
          {analysis.coverageScore}/100
        </p>
      </div>
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-600 mb-1">Monthly Premiums</p>
        <p className="text-2xl font-bold text-gray-900">
          {formatCurrency(analysis.totalMonthlyPremiums)}
        </p>
      </div>
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-600 mb-1">Annual Premiums</p>
        <p className="text-2xl font-bold text-gray-900">
          {formatCurrency(analysis.totalAnnualPremiums)}
        </p>
      </div>
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-600 mb-1">Total Coverage</p>
        <p className="text-2xl font-bold text-gray-900">
          {formatCurrency(analysis.totalCoverage)}
        </p>
      </div>
    </div>
  );
});