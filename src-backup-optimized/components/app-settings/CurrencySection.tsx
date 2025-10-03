import React, { useEffect, memo } from 'react';
import { GlobeIcon } from '../icons';
import type { Currency } from '../../services/appSettingsService';
import { useLogger } from '../services/ServiceProvider';

interface CurrencySectionProps {
  currency: string;
  currencies: Currency[];
  onCurrencyChange: (currency: string) => void;
}

const CurrencySection = memo(function CurrencySection({ currency,
  currencies,
  onCurrencyChange
 }: CurrencySectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('CurrencySection component initialized', {
      componentName: 'CurrencySection'
    });
  }, []);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 mb-6 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <GlobeIcon className="text-gray-600 dark:text-gray-400" size={20} />
        <h2 className="text-xl font-semibold text-theme-heading dark:text-white">Base Currency</h2>
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Choose your preferred base currency for displaying your net worth and performing currency conversions
      </p>
      <select
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value)}
        className="w-full px-4 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
      >
        {currencies.map((curr) => (
          <option key={curr.code} value={curr.code}>
            {curr.code} - {curr.name} ({curr.symbol})
          </option>
        ))}
      </select>
    </div>
  );
});

export default CurrencySection;