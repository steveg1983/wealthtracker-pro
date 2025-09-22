import { useRegionalSettings } from './useRegionalSettings';

export function useRegionalCurrency() {
  const { currency } = useRegionalSettings();
  
  const formatCurrency = (amount: number): string => {
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    };
    
    const locale = currency === 'GBP' ? 'en-GB' : 'en-US';
    return new Intl.NumberFormat(locale, options).format(amount);
  };
  
  const formatCurrencyDetailed = (amount: number): string => {
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    };
    
    const locale = currency === 'GBP' ? 'en-GB' : 'en-US';
    return new Intl.NumberFormat(locale, options).format(amount);
  };
  
  const getCurrencySymbol = (): string => {
