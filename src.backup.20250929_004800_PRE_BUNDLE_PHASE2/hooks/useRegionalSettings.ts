import { useState, useEffect } from 'react';

interface RegionalSettings {
  region: 'UK' | 'US';
  currency: 'GBP' | 'USD';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY';
  timezone: string;
}

export function useRegionalSettings(): RegionalSettings {
  const [settings, setSettings] = useState<RegionalSettings>(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('regionalSettings');
    if (saved) {
      return JSON.parse(saved);
    }
    
    // Auto-detect based on browser settings
    const locale = navigator.language || 'en-US';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    if (locale.includes('GB') || timezone.includes('London')) {
      return {
        region: 'UK',
        currency: 'GBP',
        dateFormat: 'DD/MM/YYYY',
        timezone: 'Europe/London'
      };
    }
    
    return {
      region: 'US',
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timezone: 'America/New_York'
    };
  });

  useEffect(() => {
    localStorage.setItem('regionalSettings', JSON.stringify(settings));
  }, [settings]);

  return settings;
}

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
    return currency === 'GBP' ? '£' : '$';
  };
  
  const currencySymbol = getCurrencySymbol();
  
  return {
    currency,
    formatCurrency,
    formatCurrencyDetailed,
    getCurrencySymbol,
    currencySymbol
  };
}