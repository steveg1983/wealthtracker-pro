import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../contexts/PreferencesContext';
import { useRegionalSettings } from './useRegionalSettings';
import { appSettingsService, type TaxUpdateResult, type PageToggle } from '../services/appSettingsService';
import { EyeIcon, EyeOffIcon } from '../components/icons';

export interface UseAppSettingsReturn {
  // Navigation
  navigate: (path: string) => void;
  
  // Personal Info
  firstName: string;
  setFirstName: (name: string) => void;
  
  // Currency
  currency: string;
  setCurrency: (currency: string) => void;
  currencies: ReturnType<typeof appSettingsService.getCurrencies>;
  
  // Theme
  theme: string;
  setTheme: (theme: 'light' | 'dark' | 'auto' | 'scheduled') => void;
  colorTheme: string;
  setColorTheme: (theme: 'blue' | 'green' | 'red' | 'pink') => void;
  themeSchedule: any;
  setThemeSchedule: (schedule: any) => void;
  themeOptions: ReturnType<typeof appSettingsService.getThemeOptions>;
  colorThemes: ReturnType<typeof appSettingsService.getColorThemes>;
  
  // Page Visibility
  pageToggles: PageToggle[];
  
  // Goal Celebrations
  enableGoalCelebrations: boolean;
  setEnableGoalCelebrations: (enabled: boolean) => void;
  
  // Tax Updates
  region: string;
  isCheckingTaxUpdates: boolean;
  taxUpdateResult: TaxUpdateResult;
  handleCheckTaxUpdates: () => Promise<void>;
  taxDataSource: string;
  taxVerificationSource: string;
}

export function useAppSettings(): UseAppSettingsReturn {
  const navigate = useNavigate();
  const { region } = useRegionalSettings();
  const [isCheckingTaxUpdates, setIsCheckingTaxUpdates] = useState(false);
  const [taxUpdateResult, setTaxUpdateResult] = useState<TaxUpdateResult>({ 
    status: 'idle', 
    message: '' 
  });
  
  const { 
    currency, 
    setCurrency,
    firstName,
    setFirstName,
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    themeSchedule,
    setThemeSchedule,
    showBudget,
    setShowBudget,
    showGoals,
    setShowGoals,
    showAnalytics,
    setShowAnalytics,
    showInvestments,
    setShowInvestments,
    showEnhancedInvestments,
    setShowEnhancedInvestments,
    showAIAnalytics,
    setShowAIAnalytics,
    showFinancialPlanning,
    setShowFinancialPlanning,
    showDataIntelligence,
    setShowDataIntelligence,
    showSummaries,
    setShowSummaries,
    enableGoalCelebrations,
    setEnableGoalCelebrations
  } = usePreferences();

  // Handle tax updates check
  const handleCheckTaxUpdates = useCallback(async () => {
    setIsCheckingTaxUpdates(true);
    setTaxUpdateResult({ status: 'checking', message: 'Checking for tax data updates...' });
    
    try {
      const result = await appSettingsService.checkTaxUpdates(region);
      setTaxUpdateResult(result);
    } finally {
      setIsCheckingTaxUpdates(false);
    }
  }, [region]);

  // Page toggles configuration
  const pageToggles: PageToggle[] = [
    {
      title: 'Budget',
      description: 'Show budget planning and tracking features',
      value: showBudget,
      onChange: setShowBudget,
      icon: showBudget ? EyeIcon : EyeOffIcon
    },
    {
      title: 'Goals',
      description: 'Show financial goals and milestones',
      value: showGoals,
      onChange: setShowGoals,
      icon: showGoals ? EyeIcon : EyeOffIcon
    },
    {
      title: 'Analytics',
      description: 'Show detailed analytics and insights',
      value: showAnalytics,
      onChange: setShowAnalytics,
      icon: showAnalytics ? EyeIcon : EyeOffIcon
    },
    {
      title: 'Investments',
      description: 'Show investment portfolio tracking',
      value: showInvestments,
      onChange: setShowInvestments,
      icon: showInvestments ? EyeIcon : EyeOffIcon
    },
    {
      title: 'Investment Analytics',
      description: 'Show enhanced investment analytics',
      value: showEnhancedInvestments,
      onChange: setShowEnhancedInvestments,
      icon: showEnhancedInvestments ? EyeIcon : EyeOffIcon
    },
    {
      title: 'AI Analytics',
      description: 'Show AI-powered insights and recommendations',
      value: showAIAnalytics,
      onChange: setShowAIAnalytics,
      icon: showAIAnalytics ? EyeIcon : EyeOffIcon
    },
    {
      title: 'Financial Planning',
      description: 'Show retirement and financial planning tools',
      value: showFinancialPlanning,
      onChange: setShowFinancialPlanning,
      icon: showFinancialPlanning ? EyeIcon : EyeOffIcon
    },
    {
      title: 'Data Intelligence',
      description: 'Show advanced data analytics and insights',
      value: showDataIntelligence,
      onChange: setShowDataIntelligence,
      icon: showDataIntelligence ? EyeIcon : EyeOffIcon
    },
    {
      title: 'Summaries',
      description: 'Show financial summaries and reports',
      value: showSummaries,
      onChange: setShowSummaries,
      icon: showSummaries ? EyeIcon : EyeOffIcon
    }
  ];

  return {
    // Navigation
    navigate,
    
    // Personal Info
    firstName,
    setFirstName,
    
    // Currency
    currency,
    setCurrency,
    currencies: appSettingsService.getCurrencies(),
    
    // Theme
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    themeSchedule,
    setThemeSchedule,
    themeOptions: appSettingsService.getThemeOptions(),
    colorThemes: appSettingsService.getColorThemes(),
    
    // Page Visibility
    pageToggles,
    
    // Goal Celebrations
    enableGoalCelebrations,
    setEnableGoalCelebrations,
    
    // Tax Updates
    region,
    isCheckingTaxUpdates,
    taxUpdateResult,
    handleCheckTaxUpdates,
    taxDataSource: appSettingsService.getTaxDataSource(region),
    taxVerificationSource: appSettingsService.getTaxVerificationSource(region)
  };
}