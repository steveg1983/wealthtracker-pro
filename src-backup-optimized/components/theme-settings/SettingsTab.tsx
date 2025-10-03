import React, { useEffect, memo } from 'react';
import type { SystemSettings } from '../../services/themeSettingsPageService';
import { useLogger } from '../services/ServiceProvider';

interface SettingsTabProps {
  systemSettings: SystemSettings;
  onSettingChange: (setting: keyof SystemSettings, value: boolean) => void;
}

const SettingsTab = memo(function SettingsTab({ systemSettings,
  onSettingChange
 }: SettingsTabProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SettingsTab component initialized', {
      componentName: 'SettingsTab'
    });
  }, []);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Advanced Settings</h3>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">System Integration</h4>
        <div className="space-y-4">
          <SettingToggle
            label="Follow system theme"
            description="Automatically use your operating system's theme preference"
            checked={systemSettings.followSystemTheme}
            onChange={(checked) => onSettingChange('followSystemTheme', checked)}
          />
          
          <SettingToggle
            label="Override system preferences"
            description="Allow scheduled themes to override system settings"
            checked={systemSettings.overrideSystemPreferences}
            onChange={(checked) => onSettingChange('overrideSystemPreferences', checked)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">Performance</h4>
        <div className="space-y-4">
          <SettingToggle
            label="Smooth transitions"
            description="Enable animated transitions when switching themes"
            checked={systemSettings.smoothTransitions}
            onChange={(checked) => onSettingChange('smoothTransitions', checked)}
          />
          
          <SettingToggle
            label="Reduce motion"
            description="Minimize animations for better performance"
            checked={systemSettings.reduceMotion}
            onChange={(checked) => onSettingChange('reduceMotion', checked)}
          />
        </div>
      </div>
    </div>
  );
});

const SettingToggle = memo(function SettingToggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div>
        <span className="text-gray-700 dark:text-gray-300">{label}</span>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
      <input 
        type="checkbox" 
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="ml-4" 
      />
    </label>
  );
});

export default SettingsTab;