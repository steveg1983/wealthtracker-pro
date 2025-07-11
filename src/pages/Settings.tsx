import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Download, 
  Upload,
  Globe,
  AlertCircle,
  Check,
  ChevronRight,
  Database
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { usePreferences } from '../contexts/PreferencesContext';

export default function Settings() {
  const navigate = useNavigate();
  const { accounts, transactions, budgets } = useApp();
  const { currency, setCurrency, theme, setTheme, accentColor, setAccentColor } = usePreferences();
  const [activeSection, setActiveSection] = useState('profile');
  const [isGeneratingData, setIsGeneratingData] = useState(false);
  const [notifications, setNotifications] = useState({
    budgetAlerts: true,
    lowBalance: true,
    weeklyReport: false,
    monthlyReport: true,
  });

  const exportData = () => {
    const data = {
      accounts,
      transactions,
      budgets,
      exportDate: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `danielles-money-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('Data exported successfully!');
  };

  const generateTestData = async () => {
    const confirmMessage = accounts.length > 0 || transactions.length > 0 
      ? 'This will REPLACE all existing accounts, transactions, and budgets with test data. Are you sure?'
      : 'This will add test accounts, transactions, and budgets. Continue?';
      
    if (window.confirm(confirmMessage)) {
      setIsGeneratingData(true);
      
      try {
        // Clear all existing data first
        localStorage.removeItem('wealthtracker_accounts');
        localStorage.removeItem('wealthtracker_transactions');
        localStorage.removeItem('wealthtracker_budgets');
        
        // Small delay to ensure storage is cleared
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Import and generate test data
        const { generateTestData } = await import('../utils/generateTestData');
        const testData = generateTestData();
        
        // Save directly to localStorage
        localStorage.setItem('wealthtracker_accounts', JSON.stringify(testData.accounts));
        localStorage.setItem('wealthtracker_transactions', JSON.stringify(testData.transactions));
        localStorage.setItem('wealthtracker_budgets', JSON.stringify(testData.budgets));
        
        // Navigate to dashboard to see the new data
        navigate('/');
        
        // Small delay then navigate back to settings if user wants to stay here
        setTimeout(() => {
          alert('Test data generated successfully!');
        }, 500);
        
      } catch (error) {
        console.error('Error generating test data:', error);
        alert('There was an error generating test data. Please try again.');
      } finally {
        setIsGeneratingData(false);
      }
    }
  };

  const clearAllData = () => {
    if (window.confirm('Are you sure you want to delete all data? This cannot be undone!')) {
      if (window.confirm('This will delete ALL accounts, transactions, and budgets. Are you absolutely sure?')) {
        localStorage.clear();
        navigate('/');
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    }
  };

  const sections = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'data', name: 'Data & Backup', icon: Download },
    { id: 'privacy', name: 'Privacy & Security', icon: Shield },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Settings Navigation */}
        <div className="w-full lg:w-64">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  activeSection === section.id ? 'bg-gray-50 dark:bg-gray-700 border-l-4 border-primary dark:border-blue-400' : ''
                } ${section.id === sections[0].id ? 'rounded-t-lg' : ''} ${
                  section.id === sections[sections.length - 1].id ? 'rounded-b-lg' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <section.icon size={20} className={activeSection === section.id ? 'text-primary dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'} />
                  <span className={`${activeSection === section.id ? 'font-medium' : ''} dark:text-white`}>{section.name}</span>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            {/* Profile Section */}
            {activeSection === 'profile' && (
              <div>
                <h2 className="text-xl font-semibold mb-4 dark:text-white">Profile Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      defaultValue="Danielle"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Your name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Default Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="GBP">£ GBP - British Pound</option>
                      <option value="USD">$ USD - US Dollar</option>
                      <option value="EUR">€ EUR - Euro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Financial Year Start
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                      <option>January</option>
                      <option>April</option>
                      <option>July</option>
                      <option>October</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Section */}
            {activeSection === 'notifications' && (
              <div>
                <h2 className="text-xl font-semibold mb-4 dark:text-white">Notification Preferences</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b dark:border-gray-700">
                    <div>
                      <p className="font-medium dark:text-white">Budget Alerts</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Notify when spending exceeds 80% of budget</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notifications.budgetAlerts}
                        onChange={(e) => setNotifications({...notifications, budgetAlerts: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary dark:peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b dark:border-gray-700">
                    <div>
                      <p className="font-medium dark:text-white">Low Balance Warnings</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Alert when account balance is low</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notifications.lowBalance}
                        onChange={(e) => setNotifications({...notifications, lowBalance: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary dark:peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b dark:border-gray-700">
                    <div>
                      <p className="font-medium dark:text-white">Weekly Summary</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Email weekly spending report</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notifications.weeklyReport}
                        onChange={(e) => setNotifications({...notifications, weeklyReport: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary dark:peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium dark:text-white">Monthly Report</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Detailed monthly financial summary</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notifications.monthlyReport}
                        onChange={(e) => setNotifications({...notifications, monthlyReport: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary dark:peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Section */}
            {activeSection === 'appearance' && (
              <div>
                <h2 className="text-xl font-semibold mb-4 dark:text-white">Appearance</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Theme</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button 
                        onClick={() => setTheme('light')}
                        className={`p-4 border-2 ${theme === 'light' ? 'border-primary dark:border-blue-400' : 'border-gray-300 dark:border-gray-600'} rounded-lg text-center transition-colors`}
                      >
                        <div className="w-8 h-8 bg-gray-100 rounded mx-auto mb-2"></div>
                        <p className={`text-sm ${theme === 'light' ? 'font-medium' : ''} dark:text-white`}>Light</p>
                      </button>
                      <button 
                        onClick={() => setTheme('dark')}
                        className={`p-4 border-2 ${theme === 'dark' ? 'border-primary dark:border-blue-400' : 'border-gray-300 dark:border-gray-600'} rounded-lg text-center transition-colors`}
                      >
                        <div className="w-8 h-8 bg-gray-800 rounded mx-auto mb-2"></div>
                        <p className={`text-sm ${theme === 'dark' ? 'font-medium' : ''} dark:text-white`}>Dark</p>
                      </button>
                      <button 
                        onClick={() => setTheme('auto')}
                        className={`p-4 border-2 ${theme === 'auto' ? 'border-primary dark:border-blue-400' : 'border-gray-300 dark:border-gray-600'} rounded-lg text-center transition-colors`}
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-800 rounded mx-auto mb-2"></div>
                        <p className={`text-sm ${theme === 'auto' ? 'font-medium' : ''} dark:text-white`}>Auto</p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Accent Color
                    </label>
                    <div className="grid grid-cols-5 gap-3">
                      {[
                        { name: 'blue', color: 'bg-blue-500' },
                        { name: 'green', color: 'bg-green-500' },
                        { name: 'purple', color: 'bg-purple-500' },
                        { name: 'orange', color: 'bg-orange-500' },
                        { name: 'red', color: 'bg-red-500' },
                        { name: 'pink', color: 'bg-pink-500' },
                        { name: 'indigo', color: 'bg-indigo-500' },
                        { name: 'teal', color: 'bg-teal-500' },
                        { name: 'yellow', color: 'bg-yellow-500' },
                        { name: 'gray', color: 'bg-gray-500' },
                      ].map((colorOption) => (
                        <button
                          key={colorOption.name}
                          onClick={() => setAccentColor(colorOption.name)}
                          className={`w-10 h-10 rounded-full ${colorOption.color} ${
                            accentColor === colorOption.name 
                              ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600' 
                              : ''
                          } transition-all hover:scale-110`}
                          title={colorOption.name.charAt(0).toUpperCase() + colorOption.name.slice(1)}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Changes the primary color throughout the app
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Compact View
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Compact view toggle has been moved to the Transactions page for easier access. 
                      You can toggle it directly from there to see the effect immediately.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Data & Backup Section */}
            {activeSection === 'data' && (
              <div>
                <h2 className="text-xl font-semibold mb-4 dark:text-white">Data & Backup</h2>
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Your Data Summary</h3>
                    <div className="space-y-1 text-sm text-blue-800 dark:text-blue-400">
                      <p>• {accounts.length} accounts</p>
                      <p>• {transactions.length} transactions</p>
                      <p>• {budgets.length} budgets</p>
                      <p>• Last backup: Never</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={exportData}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors"
                    >
                      <Download size={20} />
                      Export All Data
                    </button>

                    <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <Upload size={20} />
                      Import Data
                    </button>

                    <button 
                      onClick={generateTestData}
                      disabled={isGeneratingData}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Database size={20} />
                      {isGeneratingData ? 'Generating...' : 'Generate Test Data'}
                    </button>

                    <div className="pt-4 border-t dark:border-gray-700">
                      <h3 className="font-medium text-red-600 dark:text-red-400 mb-3">Danger Zone</h3>
                      <button
                        onClick={clearAllData}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <AlertCircle size={20} />
                        Delete All Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy & Security Section */}
            {activeSection === 'privacy' && (
              <div>
                <h2 className="text-xl font-semibold mb-4 dark:text-white">Privacy & Security</h2>
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Check className="text-green-600 dark:text-green-400 mt-0.5" size={20} />
                      <div>
                        <h3 className="font-medium text-green-900 dark:text-green-300">Your data is private</h3>
                        <p className="text-sm text-green-800 dark:text-green-400 mt-1">
                          All data is stored locally on your device. No information is sent to external servers.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3 dark:text-white">Security Recommendations</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <Shield size={20} className="text-gray-600 dark:text-gray-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium dark:text-white">Enable device lock screen</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Protect your financial data with device security</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <Download size={20} className="text-gray-600 dark:text-gray-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium dark:text-white">Regular backups</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Export your data monthly for safekeeping</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <Globe size={20} className="text-gray-600 dark:text-gray-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium dark:text-white">Use HTTPS only</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Always access via secure connection</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
