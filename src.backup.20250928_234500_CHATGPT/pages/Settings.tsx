import { Settings2Icon, DatabaseIcon, TagIcon, HashIcon, PaletteIcon, BellIcon, EyeIcon, ArchiveIcon } from '../components/icons';
import { Link } from 'react-router-dom';
import PageWrapper from '../components/PageWrapper';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import SubscriptionStatus from '../components/SubscriptionStatus';

export default function Settings() {
  const settingsOptions = [
    {
      title: 'App Settings',
      description: 'Configure application behavior, personal info and appearance',
      icon: Settings2Icon,
      path: '/settings/app',
      color: 'bg-orange-500'
    },
    {
      title: 'Data Management', 
      description: 'Import, export, and manage your financial data',
      icon: DatabaseIcon,
      path: '/settings/data',
      color: 'bg-gray-500'
    },
    {
      title: 'Categories',
      description: 'Organize and manage transaction categories',
      icon: TagIcon,
      path: '/settings/categories',
      color: 'bg-green-500'
    },
    {
      title: 'Tags',
      description: 'Manage transaction tags and labels',
      icon: HashIcon,
      path: '/settings/tags',
      color: 'bg-purple-500'
    },
    {
      title: 'Notifications',
      description: 'Configure push notifications and alerts',
      icon: BellIcon,
      path: '/settings/notifications',
      color: 'bg-indigo-500'
    },
    {
      title: 'Accessibility',
      description: 'Monitor and improve accessibility compliance',
      icon: EyeIcon,
      path: '/settings/accessibility',
      color: 'bg-pink-500'
    },
    {
      title: 'Deleted Accounts',
      description: 'View and restore deleted accounts',
      icon: ArchiveIcon,
      path: '/settings/deleted-accounts',
      color: 'bg-gray-500'
    }
  ];

  return (
    <PageWrapper title="Settings">

      {/* Subscription and Sync Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SubscriptionStatus />
        <SyncStatusIndicator variant="detailed" showLastSync={true} />
      </div>

      {/* Main About Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-gray-600 rounded-2xl flex items-center justify-center">
            <span className="text-2xl font-bold text-white">WT</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-blue-900 dark:text-white">Wealth Tracker</h2>
            <p className="text-gray-600 dark:text-gray-400">Version 1.0</p>
          </div>
        </div>
        
        <div className="space-y-4 text-gray-600 dark:text-gray-400">
          <p className="text-lg">
            A comprehensive personal finance management application designed to help you track, 
            manage, and grow your wealth with ease.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Features</h3>
              <ul className="space-y-2 text-sm">
                <li>• Account management and tracking</li>
                <li>• Transaction recording and categorization</li>
                <li>• Budget planning and monitoring</li>
                <li>• Investment portfolio tracking</li>
                <li>• Financial goal setting</li>
                <li>• Analytics and insights</li>
                <li>• Account reconciliation</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Technology</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <PaletteIcon size={16} />
                  <span>Built with React & TypeScript</span>
                </div>
                <div className="flex items-center gap-2">
                  <DatabaseIcon size={16} />
                  <span>Tailwind CSS for styling</span>
                </div>
                <div className="flex items-center gap-2">
                  <TagIcon size={16} />
                  <span>Recharts for data visualization</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Settings Links */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {settingsOptions.map((option) => (
            <Link
              key={option.path}
              to={option.path}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
            >
              <div className={`p-2 rounded-lg ${option.color} text-white group-hover:scale-110 transition-transform`}>
                <option.icon size={18} />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                  {option.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {option.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
