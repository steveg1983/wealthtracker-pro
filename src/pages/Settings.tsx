import { useState } from 'react';
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Download, 
  Upload,
  Globe,
  CreditCard,
  Target,
  AlertCircle,
  Check,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export default function Settings() {
  const { accounts, transactions, budgets } = useApp();
  const [activeSection, setActiveSection] = useState('profile');
  const [currency, setCurrency] = useState('GBP');
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
    a.download = `money-management-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('Data exported successfully!');
  };

  const clearAllData = () => {
    if (window.confirm('Are you sure you want to delete all data? This cannot be undone!')) {
      if (window.confirm('This will delete ALL accounts, transactions, and budgets. Are you absolutely sure?')) {
        localStorage.clear();
        window.location.reload();
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
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Settings Navigation */}
        <div className="w-full lg:w-64">
          <div className="bg-white rounded-lg shadow">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  activeSection === section.id ? 'bg-gray-50 border-l-4 border-primary' : ''
                } ${section.id === sections[0].id ? 'rounded-t-lg' : ''} ${
                  section.id === sections[sections.length - 1].id ? 'rounded-b-lg' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <section.icon size={20} className={activeSection === section.id ? 'text-primary' : 'text-gray-500'} />
                  <span className={activeSection === section.id ? 'font-medium' : ''}>{section.name}</span>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow p-6">
            {/* Profile Section */}
            {activeSection === 'profile' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Your name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="GBP">£ GBP - British Pound</option>
                      <option value="USD">$ USD - US Dollar</option>
                      <option value="EUR">€ EUR - Euro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Financial Year Start
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
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
                <h2 className="text-xl font-semibold mb-4">Notification Preferences</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">Budget Alerts</p>
                      <p className="text-sm text-gray-500">Notify when spending exceeds 80% of budget</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notifications.budgetAlerts}
                        onChange={(e) => setNotifications({...notifications, budgetAlerts: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">Low Balance Warnings</p>
                      <p className="text-sm text-gray-500">Alert when account balance is low</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notifications.lowBalance}
                        onChange={(e) => setNotifications({...notifications, lowBalance: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">Weekly Summary</p>
                      <p className="text-sm text-gray-500">Email weekly spending report</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notifications.weeklyReport}
                        onChange={(e) => setNotifications({...notifications, weeklyReport: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">Monthly Report</p>
                      <p className="text-sm text-gray-500">Detailed monthly financial summary</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notifications.monthlyReport}
                        onChange={(e) => setNotifications({...notifications, monthlyReport: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Section */}
            {activeSection === 'appearance' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Appearance</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Theme</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button className="p-4 border-2 border-primary rounded-lg text-center">
                        <div className="w-8 h-8 bg-gray-100 rounded mx-auto mb-2"></div>
                        <p className="text-sm font-medium">Light</p>
                      </button>
                      <button className="p-4 border rounded-lg text-center">
                        <div className="w-8 h-8 bg-gray-800 rounded mx-auto mb-2"></div>
                        <p className="text-sm">Dark</p>
                        <p className="text-xs text-gray-500">Coming soon</p>
                      </button>
                      <button className="p-4 border rounded-lg text-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-800 rounded mx-auto mb-2"></div>
                        <p className="text-sm">Auto</p>
                        <p className="text-xs text-gray-500">Coming soon</p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Accent Color
                    </label>
                    <div className="flex gap-3">
                      <button className="w-10 h-10 rounded-full bg-blue-500 ring-2 ring-offset-2 ring-blue-500"></button>
                      <button className="w-10 h-10 rounded-full bg-green-500"></button>
                      <button className="w-10 h-10 rounded-full bg-purple-500"></button>
                      <button className="w-10 h-10 rounded-full bg-orange-500"></button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Compact View
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Data & Backup Section */}
            {activeSection === 'data' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Data & Backup</h2>
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-2">Your Data Summary</h3>
                    <div className="space-y-1 text-sm text-blue-800">
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

                    <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      <Upload size={20} />
                      Import Data
                    </button>

                    <div className="pt-4 border-t">
                      <h3 className="font-medium text-red-600 mb-3">Danger Zone</h3>
                      <button
                        onClick={clearAllData}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
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
                <h2 className="text-xl font-semibold mb-4">Privacy & Security</h2>
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Check className="text-green-600 mt-0.5" size={20} />
                      <div>
                        <h3 className="font-medium text-green-900">Your data is private</h3>
                        <p className="text-sm text-green-800 mt-1">
                          All data is stored locally on your device. No information is sent to external servers.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">Security Recommendations</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Shield size={20} className="text-gray-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Enable device lock screen</p>
                          <p className="text-xs text-gray-500">Protect your financial data with device security</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Download size={20} className="text-gray-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Regular backups</p>
                          <p className="text-xs text-gray-500">Export your data monthly for safekeeping</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Globe size={20} className="text-gray-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Use HTTPS only</p>
                          <p className="text-xs text-gray-500">Always access via secure connection</p>
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
