import { Palette, Database, Tag, Settings as SettingsIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Settings() {
  const settingsOptions = [
    {
      title: 'Appearance',
      description: 'Customize theme, colors, and display preferences',
      icon: Palette,
      path: '/settings/appearance',
      color: 'bg-purple-500'
    },
    {
      title: 'Data Management', 
      description: 'Import, export, and manage your financial data',
      icon: Database,
      path: '/settings/data',
      color: 'bg-blue-500'
    },
    {
      title: 'Categories',
      description: 'Organize and manage transaction categories',
      icon: Tag,
      path: '/settings/categories',
      color: 'bg-green-500'
    }
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Manage your preferences and data
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsOptions.map((option) => (
          <Link
            key={option.path}
            to={option.path}
            className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 group"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${option.color} text-white group-hover:scale-110 transition-transform`}>
                <option.icon size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                  {option.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {option.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* About */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">About</h2>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>Danielle's Money Tracker v1.0</p>
          <p>A personal finance management application</p>
          <p className="flex items-center gap-2">
            <Palette size={16} />
            Built with React, TypeScript, and Tailwind CSS
          </p>
        </div>
      </div>
    </div>
  );
}
