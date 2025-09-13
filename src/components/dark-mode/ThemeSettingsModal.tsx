import { memo, useEffect } from 'react';
import { PaletteIcon, XIcon } from '../icons';
import type { DarkModeSettings } from '../../services/darkModeService';
import { ThemeModeSelector } from './ThemeModeSelector';
import { AutoScheduleSettings } from './AutoScheduleSettings';
import { ContrastModeSelector } from './ContrastModeSelector';
import { ThemePreview } from './ThemePreview';
import { logger } from '../../services/loggingService';

interface ThemeSettingsModalProps {
  isOpen: boolean;
  settings: DarkModeSettings;
  onClose: () => void;
  onSettingChange: <K extends keyof DarkModeSettings>(
    key: K,
    value: DarkModeSettings[K]
  ) => void;
}

/**
 * Theme settings modal component
 * Main modal for configuring all theme settings
 */
export const ThemeSettingsModal = memo(function ThemeSettingsModal({
  isOpen,
  settings,
  onClose,
  onSettingChange
}: ThemeSettingsModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('ThemeSettingsModal component initialized', {
      componentName: 'ThemeSettingsModal'
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PaletteIcon size={24} className="text-primary" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Theme Settings
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XIcon size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Theme Mode */}
          <ThemeModeSelector
            mode={settings.mode}
            onModeChange={(mode) => onSettingChange('mode', mode)}
          />

          {/* Auto Schedule */}
          {settings.mode === 'auto' && (
            <AutoScheduleSettings
              autoSchedule={settings.autoSchedule}
              onScheduleChange={(schedule) => onSettingChange('autoSchedule', schedule)}
            />
          )}

          {/* Contrast Mode */}
          <ContrastModeSelector
            contrastMode={settings.contrastMode}
            onContrastChange={(mode) => onSettingChange('contrastMode', mode)}
          />

          {/* Additional Options */}
          <AdditionalOptions
            settings={settings}
            onSettingChange={onSettingChange}
          />

          {/* Preview */}
          <ThemePreview />
        </div>
      </div>
    </div>
  );
});

/**
 * Additional options sub-component
 */
const AdditionalOptions = memo(function AdditionalOptions({
  settings,
  onSettingChange
}: {
  settings: DarkModeSettings;
  onSettingChange: ThemeSettingsModalProps['onSettingChange'];
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.smoothTransitions}
          onChange={(e) => onSettingChange('smoothTransitions', e.target.checked)}
          className="rounded"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Smooth theme transitions
        </span>
      </label>
      
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.preserveColorPreference}
          onChange={(e) => onSettingChange('preserveColorPreference', e.target.checked)}
          className="rounded"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Remember preference across sessions
        </span>
      </label>
    </div>
  );
});
