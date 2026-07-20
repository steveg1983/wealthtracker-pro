import { ArrowLeftIcon, GlobeIcon, EyeIcon, EyeOffIcon, MoonIcon, SunIcon, MonitorIcon, ClockIcon } from '../../components/icons';
import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../../contexts/PreferencesContext';
import PageWrapper from '../../components/PageWrapper';
import BudgetAlertSettings from '../../components/BudgetAlertSettings';
import LargeTransactionAlertSettings from '../../components/LargeTransactionAlertSettings';
import LocaleSelector from '../../components/settings/LocaleSelector';
import ToggleSwitch from '../../components/ui/ToggleSwitch';

export default function AppSettings() {
  const navigate = useNavigate();
  const { 
    currency, 
    setCurrency,
    firstName,
    setFirstName,
    theme,
    setTheme,
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
    showTaxPlanning,
    setShowTaxPlanning,
    showHousehold,
    setShowHousehold,
    showBusinessFeatures,
    setShowBusinessFeatures,
    showFinancialPlanning,
    setShowFinancialPlanning,
    showDataIntelligence,
    setShowDataIntelligence,
    showSummaries,
    setShowSummaries,
    enableGoalCelebrations,
    setEnableGoalCelebrations
  } = usePreferences();

  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  ];

  const themeOptions = [
    { value: 'light', label: 'Light', icon: SunIcon },
    { value: 'dark', label: 'Dark', icon: MoonIcon },
    { value: 'auto', label: 'Auto', icon: MonitorIcon },
    { value: 'scheduled', label: 'Scheduled', icon: ClockIcon },
  ];

  const pageToggles = [
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
      title: 'Tax Planning',
      description: 'Show tax planning and optimization tools',
      value: showTaxPlanning,
      onChange: setShowTaxPlanning,
      icon: showTaxPlanning ? EyeIcon : EyeOffIcon
    },
    {
      title: 'Household',
      description: 'Show household management features',
      value: showHousehold,
      onChange: setShowHousehold,
      icon: showHousehold ? EyeIcon : EyeOffIcon
    },
    {
      title: 'Business Features',
      description: 'Show business expense and invoice management',
      value: showBusinessFeatures,
      onChange: setShowBusinessFeatures,
      icon: showBusinessFeatures ? EyeIcon : EyeOffIcon
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

  return (
    <PageWrapper 
      title="App Settings"
      rightContent={
        <button
          onClick={() => navigate('/settings')}
          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
          title="Back to Settings"
        >
          <ArrowLeftIcon size={16} />
        </button>
      }
    >

      {/* Personal Information */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-4">Personal Information</h2>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            First Name
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Enter your first name"
            className="w-full px-3 py-2 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
          />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This will be used in the welcome message on your dashboard. Leave blank to use "User".
          </p>
        </div>
      </div>

      {/* Locale & Date Format */}
      <LocaleSelector />

      {/* Base Currency */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 mb-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <GlobeIcon className="text-gray-600 dark:text-gray-400" size={20} />
          <h2 className="text-xl font-semibold text-theme-heading dark:text-white">Base Currency</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Choose your preferred base currency for displaying your net worth and performing currency conversions
        </p>
        <select
          aria-label="Default currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
        >
          {currencies.map((curr) => (
            <option key={curr.code} value={curr.code}>
              {curr.code} - {curr.name} ({curr.symbol})
            </option>
          ))}
        </select>
      </div>

      {/* Appearance */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-4">Appearance</h2>
        
        {/* Theme Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Theme
          </label>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value as 'light' | 'dark' | 'auto' | 'scheduled')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  theme === value
                    ? 'border-primary bg-[#1a2332]/10 text-primary dark:bg-primary/20 dark:text-primary'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme Scheduling */}
        {theme === 'scheduled' && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <ClockIcon size={20} className="text-primary" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Schedule Settings
              </h3>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={themeSchedule.enabled}
                  onChange={(e) => setThemeSchedule({ ...themeSchedule, enabled: e.target.checked })}
                  className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable scheduling</span>
              </label>
              
              {themeSchedule.enabled && (
                <div className="grid grid-cols-2 gap-4 ml-7">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Light theme starts at
                    </label>
                    <input
                      type="time"
                      value={themeSchedule.lightStartTime}
                      onChange={(e) => setThemeSchedule({ ...themeSchedule, lightStartTime: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Dark theme starts at
                    </label>
                    <input
                      type="time"
                      value={themeSchedule.darkStartTime}
                      onChange={(e) => setThemeSchedule({ ...themeSchedule, darkStartTime: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Page Visibility */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-4">Page Visibility</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Choose which pages appear in the navigation sidebar
        </p>
        
        <div className="space-y-4">
          {pageToggles.map((toggle) => (
            <div
              key={toggle.title}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <toggle.icon 
                    size={20} 
                    className={toggle.value ? 'text-primary' : 'text-gray-400 dark:text-gray-500'} 
                  />
                  <h3 className="font-medium text-gray-900 dark:text-white">{toggle.title}</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 ml-8">
                  {toggle.description}
                </p>
              </div>
              <ToggleSwitch
                checked={toggle.value}
                onChange={toggle.onChange}
                aria-label={toggle.title}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-theme-accent dark:bg-gray-800/50 rounded-2xl">
          <p className="text-sm text-theme-heading dark:text-gray-300">
            <strong>Note:</strong> Hidden pages will not appear in the sidebar navigation but can still be accessed if you have a direct link.
          </p>
        </div>
      </div>

      {/* Budget Alerts */}
      <BudgetAlertSettings />

      {/* Large Transaction Alerts */}
      <LargeTransactionAlertSettings />

      {/* Goal Celebrations */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Goal Celebrations</h3>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Enable Celebrations</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Show confetti and celebration messages when you achieve your goals
            </p>
          </div>
          <ToggleSwitch
            checked={enableGoalCelebrations}
            onChange={setEnableGoalCelebrations}
            aria-label="Enable goal celebrations"
          />
        </div>
      </div>
    </PageWrapper>
  );
}