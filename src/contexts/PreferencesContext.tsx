/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { logger } from '../services/loggingService';

interface PreferencesContextType {
  compactView: boolean;
  setCompactView: (value: boolean) => void;
  currency: string;
  setCurrency: (value: string) => void;
  theme: 'light' | 'dark' | 'auto' | 'scheduled';
  setTheme: (value: 'light' | 'dark' | 'auto' | 'scheduled') => void;
  actualTheme: 'light' | 'dark';
  colorTheme: 'blue' | 'green' | 'red' | 'pink';
  setColorTheme: (value: 'blue' | 'green' | 'red' | 'pink') => void;
  firstName: string;
  setFirstName: (value: string) => void;
  // Theme scheduling
  themeSchedule: {
    enabled: boolean;
    lightStartTime: string; // HH:MM format
    darkStartTime: string; // HH:MM format
  };
  setThemeSchedule: (schedule: { enabled: boolean; lightStartTime: string; darkStartTime: string }) => void;
  // Page visibility settings
  showBudget: boolean;
  setShowBudget: (value: boolean) => void;
  showGoals: boolean;
  setShowGoals: (value: boolean) => void;
  showAnalytics: boolean;
  setShowAnalytics: (value: boolean) => void;
  showInvestments: boolean;
  setShowInvestments: (value: boolean) => void;
  showEnhancedInvestments: boolean;
  setShowEnhancedInvestments: (value: boolean) => void;
  showAIAnalytics: boolean;
  setShowAIAnalytics: (value: boolean) => void;
  showFinancialPlanning: boolean;
  setShowFinancialPlanning: (value: boolean) => void;
  showDataIntelligence: boolean;
  setShowDataIntelligence: (value: boolean) => void;
  showSummaries: boolean;
  setShowSummaries: (value: boolean) => void;
  // Goal celebrations
  enableGoalCelebrations: boolean;
  setEnableGoalCelebrations: (value: boolean) => void;
  // Additional features
  showTaxPlanning: boolean;
  setShowTaxPlanning: (value: boolean) => void;
  showHousehold: boolean;
  setShowHousehold: (value: boolean) => void;
  showBusinessFeatures: boolean;
  setShowBusinessFeatures: (value: boolean) => void;
  // Preferences object for backward compatibility
  preferences: Record<string, any>;
  updatePreferences: (updates: Record<string, any>) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [compactView, setCompactView] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_compact_view');
      // Default to true (compact view) if no saved preference
      return saved !== null ? saved === 'true' : true;
    } catch (error) {
      logger.error('Error reading compactView from localStorage:', error);
      return true; // Default to compact view
    }
  });

  const [currency, setCurrency] = useState((): string => {
    try {
      return localStorage.getItem('money_management_currency') || 'GBP';
    } catch (error) {
      logger.error('Error reading currency from localStorage:', error);
      return 'GBP';
    }
  });

  const [theme, setTheme] = useState<'light' | 'dark' | 'auto' | 'scheduled'>((): 'light' | 'dark' | 'auto' | 'scheduled' => {
    try {
      const saved = localStorage.getItem('money_management_theme');
      if (!saved) {
        localStorage.setItem('money_management_theme', 'light');
        return 'light';
      }
      if (!['light', 'dark', 'auto', 'scheduled'].includes(saved)) {
        return 'light';
      }
      return saved as 'light' | 'dark' | 'auto' | 'scheduled';
    } catch (error) {
      logger.error('Error reading theme from localStorage:', error);
      return 'light';
    }
  });

  const [colorTheme, setColorTheme] = useState<'blue' | 'green' | 'red' | 'pink'>((): 'blue' | 'green' | 'red' | 'pink' => {
    try {
      const saved = localStorage.getItem('money_management_color_theme');
      if (!saved || !['blue', 'green', 'red', 'pink'].includes(saved)) {
        localStorage.setItem('money_management_color_theme', 'blue');
        return 'blue';
      }
      return saved as 'blue' | 'green' | 'red' | 'pink';
    } catch (error) {
      logger.error('Error reading colorTheme from localStorage:', error);
      return 'blue';
    }
  });

  const [firstName, setFirstName] = useState((): string => {
    try {
      return localStorage.getItem('money_management_first_name') || '';
    } catch (error) {
      logger.error('Error reading firstName from localStorage:', error);
      return '';
    }
  });

  // Page visibility settings
  const [showBudget, setShowBudget] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_show_budget');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading showBudget from localStorage:', error);
      return true;
    }
  });

  const [showGoals, setShowGoals] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_show_goals');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading showGoals from localStorage:', error);
      return true;
    }
  });

  const [showAnalytics, setShowAnalytics] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_show_analytics');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading showAnalytics from localStorage:', error);
      return true;
    }
  });

  const [enableGoalCelebrations, setEnableGoalCelebrations] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_goal_celebrations');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading enableGoalCelebrations from localStorage:', error);
      return true;
    }
  });

  // Additional page visibility settings
  const [showInvestments, setShowInvestments] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_show_investments');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading showInvestments from localStorage:', error);
      return true;
    }
  });

  const [showEnhancedInvestments, setShowEnhancedInvestments] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_show_enhanced_investments');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading showEnhancedInvestments from localStorage:', error);
      return true;
    }
  });

  const [showAIAnalytics, setShowAIAnalytics] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_show_ai_analytics');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading showAIAnalytics from localStorage:', error);
      return true;
    }
  });

  const [showFinancialPlanning, setShowFinancialPlanning] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_show_financial_planning');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading showFinancialPlanning from localStorage:', error);
      return true;
    }
  });

  const [showDataIntelligence, setShowDataIntelligence] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_show_data_intelligence');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading showDataIntelligence from localStorage:', error);
      return true;
    }
  });

  const [showSummaries, setShowSummaries] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_show_summaries');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading showSummaries from localStorage:', error);
      return true;
    }
  });

  const [showTaxPlanning, setShowTaxPlanning] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_show_tax_planning');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading showTaxPlanning from localStorage:', error);
      return true;
    }
  });

  const [showHousehold, setShowHousehold] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_show_household');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading showHousehold from localStorage:', error);
      return true;
    }
  });

  const [showBusinessFeatures, setShowBusinessFeatures] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_show_business_features');
      return saved !== 'false'; // Default to true
    } catch (error) {
      logger.error('Error reading showBusinessFeatures from localStorage:', error);
      return true;
    }
  });

  const [themeSchedule, setThemeSchedule] = useState((): { enabled: boolean; lightStartTime: string; darkStartTime: string } => {
    try {
      const saved = localStorage.getItem('money_management_theme_schedule');
      if (saved) {
        return JSON.parse(saved);
      }
      return {
        enabled: false,
        lightStartTime: '06:00',
        darkStartTime: '18:00'
      };
    } catch (error) {
      logger.error('Error reading theme schedule from localStorage:', error);
      return {
        enabled: false,
        lightStartTime: '06:00',
        darkStartTime: '18:00'
      };
    }
  });

  // Create preferences object for backward compatibility
  const preferences = {
    compactView,
    currency,
    theme,
    colorTheme,
    firstName,
    showBudget,
    showGoals,
    showAnalytics,
    showInvestments,
    showEnhancedInvestments,
    showAIAnalytics,
    showFinancialPlanning,
    showDataIntelligence,
    showSummaries,
    showTaxPlanning,
    showHousehold,
    showBusinessFeatures,
    enableGoalCelebrations,
    themeSchedule,
    budgetAlertThreshold: 80,
    largeTextMode: false,
    highContrastBorders: false,
    enhancedFocusIndicators: true,
    showSkipLinks: true,
    tabFocusHighlighting: true,
    announceRouteChanges: true,
    liveRegions: true,
    reduceMotion: false,
    disableAutoplay: false
  };

  const updatePreferences = (updates: Record<string, any>): void => {
    Object.entries(updates).forEach(([key, value]) => {
      switch(key) {
        case 'compactView': setCompactView(value as boolean); break;
        case 'currency': setCurrency(value as string); break;
        case 'theme': setTheme(value as 'light' | 'dark' | 'auto' | 'scheduled'); break;
        case 'colorTheme': setColorTheme(value as 'blue' | 'green' | 'red' | 'pink'); break;
        case 'firstName': setFirstName(value as string); break;
        case 'showBudget': setShowBudget(value as boolean); break;
        case 'showGoals': setShowGoals(value as boolean); break;
        case 'showAnalytics': setShowAnalytics(value as boolean); break;
        case 'showInvestments': setShowInvestments(value as boolean); break;
        case 'showEnhancedInvestments': setShowEnhancedInvestments(value as boolean); break;
        case 'showAIAnalytics': setShowAIAnalytics(value as boolean); break;
        case 'showFinancialPlanning': setShowFinancialPlanning(value as boolean); break;
        case 'showDataIntelligence': setShowDataIntelligence(value as boolean); break;
        case 'showSummaries': setShowSummaries(value as boolean); break;
        case 'showTaxPlanning': setShowTaxPlanning(value as boolean); break;
        case 'showHousehold': setShowHousehold(value as boolean); break;
        case 'showBusinessFeatures': setShowBusinessFeatures(value as boolean); break;
        case 'enableGoalCelebrations': setEnableGoalCelebrations(value as boolean); break;
        case 'themeSchedule': setThemeSchedule(value); break;
      }
    });
  };

  // Moved to before preferences object

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');

  // Memoize updateActualTheme to avoid recreating it
  const updateActualTheme = useCallback((): void => {
    let newTheme: 'light' | 'dark' = 'light';
    
    if (theme === 'dark') {
      newTheme = 'dark';
    } else if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      newTheme = prefersDark ? 'dark' : 'light';
    } else if (theme === 'scheduled' && themeSchedule.enabled) {
      // Get current time in HH:MM format
      const now = new Date();
      const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      
      const lightStart = themeSchedule.lightStartTime;
      const darkStart = themeSchedule.darkStartTime;
      
      // Handle cases where dark start is before light start (crosses midnight)
      if (darkStart < lightStart) {
        // Dark period crosses midnight
        newTheme = currentTime >= darkStart || currentTime < lightStart ? 'dark' : 'light';
      } else {
        // Normal case
        newTheme = currentTime >= darkStart || currentTime < lightStart ? 'dark' : 'light';
      }
    } else {
      newTheme = 'light';
    }
    
    setActualTheme(newTheme);
  }, [theme, themeSchedule]);

  // Handle theme changes and auto theme
  useEffect(() => {
    updateActualTheme();

    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (): void => updateActualTheme();
      
      // Use the modern addEventListener/removeEventListener pattern
      mediaQuery.addEventListener('change', handleChange);
      return (): void => mediaQuery.removeEventListener('change', handleChange);
    } else if (theme === 'scheduled' && themeSchedule.enabled) {
      // Update theme every minute when scheduled
      const interval = setInterval(updateActualTheme, 60000);
      return (): void => clearInterval(interval);
    }
  }, [theme, themeSchedule, updateActualTheme]);

  // Apply theme classes
  useEffect(() => {
    const applyTheme = (): void => {
      const root = document.documentElement;
      
      root.classList.remove('dark');
      
      requestAnimationFrame((): void => {
        if (actualTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      });
    };
    
    applyTheme();
    
    const timer = setTimeout(applyTheme, 100);
    
    return (): void => clearTimeout(timer);
  }, [actualTheme]);

  // Apply color theme class
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    const themeClasses = ['theme-blue', 'theme-green', 'theme-red', 'theme-pink'];
    
    themeClasses.forEach(className => {
      root.classList.remove(className);
    });
    
    // Add the selected theme class
    root.classList.add(`theme-${colorTheme}`);
  }, [colorTheme]);

  // Consolidate all localStorage updates into a single effect for better performance
  useEffect(() => {
    const savePreferences = (): void => {
      localStorage.setItem('money_management_compact_view', compactView.toString());
      localStorage.setItem('money_management_currency', currency);
      localStorage.setItem('money_management_theme', theme);
      localStorage.setItem('money_management_color_theme', colorTheme);
      localStorage.setItem('money_management_first_name', firstName);
      localStorage.setItem('money_management_show_budget', showBudget.toString());
      localStorage.setItem('money_management_show_goals', showGoals.toString());
      localStorage.setItem('money_management_show_analytics', showAnalytics.toString());
      localStorage.setItem('money_management_show_investments', showInvestments.toString());
      localStorage.setItem('money_management_show_enhanced_investments', showEnhancedInvestments.toString());
      localStorage.setItem('money_management_show_ai_analytics', showAIAnalytics.toString());
      localStorage.setItem('money_management_show_financial_planning', showFinancialPlanning.toString());
      localStorage.setItem('money_management_show_data_intelligence', showDataIntelligence.toString());
      localStorage.setItem('money_management_show_summaries', showSummaries.toString());
      localStorage.setItem('money_management_show_tax_planning', showTaxPlanning.toString());
      localStorage.setItem('money_management_show_household', showHousehold.toString());
      localStorage.setItem('money_management_show_business_features', showBusinessFeatures.toString());
      localStorage.setItem('money_management_theme_schedule', JSON.stringify(themeSchedule));
      localStorage.setItem('money_management_goal_celebrations', enableGoalCelebrations.toString());
    };

    // Debounce the save to avoid excessive localStorage writes
    const timeoutId = setTimeout(savePreferences, 300);
    
    return (): void => clearTimeout(timeoutId);
  }, [compactView, currency, theme, colorTheme, firstName, showBudget, showGoals, showAnalytics, showInvestments, showEnhancedInvestments, showAIAnalytics, showFinancialPlanning, showDataIntelligence, showSummaries, showTaxPlanning, showHousehold, showBusinessFeatures, themeSchedule, enableGoalCelebrations]);

  return (
    <PreferencesContext.Provider value={{
      compactView,
      setCompactView,
      currency,
      setCurrency,
      theme,
      setTheme,
      actualTheme,
      colorTheme,
      setColorTheme,
      firstName,
      setFirstName,
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
      showTaxPlanning,
      setShowTaxPlanning,
      showHousehold,
      setShowHousehold,
      showBusinessFeatures,
      setShowBusinessFeatures,
      enableGoalCelebrations,
      setEnableGoalCelebrations,
      preferences,
      updatePreferences,
    }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextType {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
}
