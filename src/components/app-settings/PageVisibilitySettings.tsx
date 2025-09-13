import React from 'react';
import { EyeIcon, EyeOffIcon } from '../icons';

export interface PageToggle {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon: any;
}

interface PageVisibilitySettingsProps {
  pageToggles: PageToggle[];
}

export default function PageVisibilitySettings({
  pageToggles
}: PageVisibilitySettingsProps): React.JSX.Element {
  return (
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
  );
}