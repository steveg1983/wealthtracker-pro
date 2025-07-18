import { ArrowLeftIcon, GlobeIcon, EyeIcon, EyeOffIcon, MoonIcon, SunIcon, MonitorIcon } from '../../components/icons';
import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../../contexts/PreferencesContext';
import PageWrapper from '../../components/PageWrapper';

export default function AppSettings() {
  const navigate = useNavigate();
  const { 
    currency, 
    setCurrency,
    firstName,
    setFirstName,
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    showBudget,
    setShowBudget,
    showGoals,
    setShowGoals,
    showAnalytics,
    setShowAnalytics
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
  ];

  const colorThemes = [
    { 
      value: 'blue', 
      label: 'Ocean Blue', 
      colors: ['#7ba8d1', '#5a729a', '#b8d4f1'],
      description: 'Calm and professional'
    },
    { 
      value: 'green', 
      label: 'Forest Green', 
      colors: ['#a9d08e', '#7fa86b', '#d4e6c4'],
      description: 'Natural and growth-focused'
    },
    { 
      value: 'red', 
      label: 'Sunset Red', 
      colors: ['#e2a8a8', '#b88585', '#f1d4d4'],
      description: 'Warm and energetic'
    },
    { 
      value: 'pink', 
      label: 'Blossom Pink', 
      colors: ['#e2a8d4', '#b885a5', '#f1d4e8'],
      description: 'Creative and elegant'
    },
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
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 mb-6">
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
            className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
          />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This will be used in the welcome message on your dashboard. Leave blank to use "User".
          </p>
        </div>
      </div>

      {/* Base Currency */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <GlobeIcon className="text-gray-600 dark:text-gray-400" size={20} />
          <h2 className="text-xl font-semibold text-theme-heading dark:text-white">Base Currency</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Choose your preferred base currency for displaying your net worth and performing currency conversions
        </p>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full px-4 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
        >
          {currencies.map((curr) => (
            <option key={curr.code} value={curr.code}>
              {curr.code} - {curr.name} ({curr.symbol})
            </option>
          ))}
        </select>
      </div>

      {/* Appearance */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 mb-6">
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
                onClick={() => setTheme(value as 'light' | 'dark' | 'auto')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  theme === value
                    ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Color Theme Palette */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Color Theme
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {colorThemes.map(({ value, label, colors, description }) => (
              <button
                key={value}
                onClick={() => setColorTheme(value as 'blue' | 'green' | 'red' | 'pink')}
                className={`flex flex-col items-start gap-3 p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                  colorTheme === value
                    ? 'border-gray-900 dark:border-gray-100 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex gap-1">
                    {colors.map((color, index) => (
                      <div
                        key={index}
                        className="w-6 h-6 rounded-full shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs opacity-70">{description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Page Visibility */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
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
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={toggle.value}
                  onChange={(e) => toggle.onChange(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-theme-accent dark:bg-gray-800/50 rounded-2xl">
          <p className="text-sm text-theme-heading dark:text-gray-300">
            <strong>Note:</strong> Hidden pages will not appear in the sidebar navigation but can still be accessed if you have a direct link.
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}