import React, { useEffect, memo } from 'react';
import { DollarSignIcon } from '../icons';
import { toDecimal } from '../../utils/decimal';
import type { DividendInfo } from '../../services/investmentEnhancementService';
import { useLogger } from '../services/ServiceProvider';

interface DividendsTabProps {
  dividendInfo: DividendInfo[];
  formatCurrency: (value: number) => string;
}

const DividendsTab = memo(function DividendsTab({ dividendInfo,
  formatCurrency
 }: DividendsTabProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('DividendsTab component initialized', {
        dividendCount: dividendInfo.length,
        componentName: 'DividendsTab'
      });
    } catch (error) {
      logger.error('DividendsTab initialization failed:', error, 'DividendsTab');
    }
  }, [dividendInfo.length]);
  const totalAnnual = (() => {
    try {
      return dividendInfo.reduce((sum, d) => {
        try {
          return sum.plus(d.projectedAnnual || toDecimal(0));
        } catch (itemError) {
          logger.error('Failed to process dividend item for total:', itemError, 'DividendsTab');
          return sum;
        }
      }, toDecimal(0));
    } catch (error) {
      logger.error('Failed to calculate total annual dividends:', error, 'DividendsTab');
      return toDecimal(0);
    }
  })();
  
  const averageYield = (() => {
    try {
      if (dividendInfo.length === 0) return toDecimal(0);
      const totalYield = dividendInfo.reduce((sum, d) => {
        try {
          return sum + (d.yield || 0);
        } catch (itemError) {
          logger.error('Failed to process yield for dividend:', itemError, 'DividendsTab');
          return sum;
        }
      }, 0);
      return toDecimal(totalYield).div(dividendInfo.length);
    } catch (error) {
      logger.error('Failed to calculate average yield:', error, 'DividendsTab');
      return toDecimal(0);
    }
  })();
  
  const totalReceived = (() => {
    try {
      return dividendInfo.reduce((sum, d) => {
        try {
          return sum.plus(d.totalReceived || toDecimal(0));
        } catch (itemError) {
          logger.error('Failed to process dividend received for item:', itemError, 'DividendsTab');
          return sum;
        }
      }, toDecimal(0));
    } catch (error) {
      logger.error('Failed to calculate total received dividends:', error, 'DividendsTab');
      return toDecimal(0);
    }
  })();

  try {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Dividend Tracking</h3>
          <p className="text-sm text-green-700 dark:text-green-200">
            Monitor dividend income and reinvestment opportunities.
          </p>
        </div>

        {dividendInfo.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <DollarSignIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p>No dividend-paying investments found</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Annual Dividends</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {(() => {
                    try {
                      return formatCurrency(totalAnnual.toNumber());
                    } catch (error) {
                      logger.error('Failed to format total annual dividends:', error, 'DividendsTab');
                      return 'Error';
                    }
                  })()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Average Yield</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(() => {
                    try {
                      return averageYield.toFixed(2);
                    } catch (error) {
                      logger.error('Failed to format average yield:', error, 'DividendsTab');
                      return '0.00';
                    }
                  })()}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">YTD Received</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(() => {
                    try {
                      return formatCurrency(totalReceived.toNumber());
                    } catch (error) {
                      logger.error('Failed to format total received dividends:', error, 'DividendsTab');
                      return 'Error';
                    }
                  })()}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {dividendInfo.map((dividend, index) => {
              try {
                return (
                  <DividendCard 
                    key={dividend.symbol || index} 
                    dividend={dividend} 
                    formatCurrency={formatCurrency} 
                  />
                );
              } catch (error) {
                logger.error('Failed to render dividend card:', { error, index, symbol: dividend?.symbol }, 'DividendsTab');
                return (
                  <div key={index} className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-700">
                    <p className="text-red-600 dark:text-red-400">
                      Error displaying dividend: {dividend?.symbol || 'Unknown'}
                    </p>
                  </div>
                );
              }
            })}
          </div>
        </>
        )}
      </div>
    );
  } catch (error) {
    logger.error('Failed to render DividendsTab:', error, 'DividendsTab');
    return (
      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-700">
          <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">Error Loading Dividends</h3>
          <p className="text-sm text-red-700 dark:text-red-200">
            Failed to load dividend information. Please try again.
          </p>
        </div>
      </div>
    );
  }
});

const DividendCard = memo(function DividendCard({
  dividend,
  formatCurrency
}: {
  dividend: DividendInfo;
  formatCurrency: (value: number) => string;
}): React.JSX.Element {
  try {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {dividend.name || 'Unknown Investment'}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {dividend.symbol || 'N/A'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-green-600 dark:text-green-400">
              {(() => {
                try {
                  return toDecimal(dividend.yield || 0).toFixed(2);
                } catch (error) {
                  logger.error('Failed to format dividend yield:', error, 'DividendsTab.DividendCard');
                  return '0.00';
                }
              })()}% yield
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {dividend.frequency || 'Unknown'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Annual: </span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {(() => {
                try {
                  return formatCurrency(toDecimal(dividend.annualDividend || 0).toNumber());
                } catch (error) {
                  logger.error('Failed to format annual dividend:', error, 'DividendsTab.DividendCard');
                  return 'Error';
                }
              })()}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Next Ex-Date: </span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {(() => {
                try {
                  return dividend.exDividendDate?.toLocaleDateString() || 'TBD';
                } catch (error) {
                  logger.error('Failed to format ex-dividend date:', error, 'DividendsTab.DividendCard');
                  return 'Date error';
                }
              })()}
            </span>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    logger.error('Failed to render DividendCard:', { error, symbol: dividend?.symbol }, 'DividendsTab.DividendCard');
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-700">
        <p className="text-red-600 dark:text-red-400">
          Error displaying dividend: {dividend?.symbol || 'Unknown'}
        </p>
      </div>
    );
  }
});

export default DividendsTab;
