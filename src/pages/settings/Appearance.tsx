import { usePreferences } from '../../contexts/PreferencesContext';
import { Moon, Sun, Monitor } from 'lucide-react';

export default function AppearanceSettings() {
  const { theme, setTheme, accentColor, setAccentColor, currency, setCurrency } = usePreferences();

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'auto', label: 'Auto', icon: Monitor },
  ];

  const accentColors = [
    { value: 'blue', label: 'Blue', color: 'bg-blue-500' },
    { value: 'green', label: 'Green', color: 'bg-green-500' },
    { value: 'purple', label: 'Purple', color: 'bg-purple-500' },
    { value: 'orange', label: 'Orange', color: 'bg-orange-500' },
    { value: 'red', label: 'Red', color: 'bg-red-500' },
    { value: 'pink', label: 'Pink', color: 'bg-pink-500' },
    { value: 'indigo', label: 'Indigo', color: 'bg-indigo-500' },
    { value: 'teal', label: 'Teal', color: 'bg-teal-500' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Appearance Settings</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {/* Theme Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Theme
          </label>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value as any)}
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

        {/* Accent Colour */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Accent Colour
          </label>
          <div className="grid grid-cols-4 gap-3">
            {accentColors.map(({ value, label, color }) => (
              <button
                key={value}
                onClick={() => setAccentColor(value)}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
                  accentColor === value
                    ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-white'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full ${color}`} />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Currency Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Display Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
          >
            <option value="GBP">£ British Pound (GBP)</option>
            <option value="USD">$ US Dollar (USD)</option>
            <option value="EUR">€ Euro (EUR)</option>
            <option value="CAD">$ Canadian Dollar (CAD)</option>
            <option value="AUD">$ Australian Dollar (AUD)</option>
            <option value="JPY">¥ Japanese Yen (JPY)</option>
            <option value="CHF">CHF Swiss Franc</option>
            <option value="CNY">¥ Chinese Yuan (CNY)</option>
            <option value="INR">₹ Indian Rupee (INR)</option>
            <option value="NZD">$ New Zealand Dollar (NZD)</option>
          </select>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Your net worth and all totals will be displayed in this currency. Individual accounts can still have different currencies, and exchange rates are updated automatically.
          </p>
        </div>
      </div>
    </div>
  );
}