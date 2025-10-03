import React, { useEffect, memo } from 'react';
import { PlusIcon, EyeIcon, TrashIcon } from '../icons';
import type { ThemePreset } from '../../services/themeSchedulingService';
import { useLogger } from '../services/ServiceProvider';

interface PresetsTabProps {
  presets: ThemePreset[];
  onCreateClick: () => void;
  onDelete: (id: string) => void;
}

const PresetsTab = memo(function PresetsTab({ presets,
  onCreateClick,
  onDelete
 }: PresetsTabProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('PresetsTab component initialized', {
      componentName: 'PresetsTab'
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Theme Presets</h3>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <PlusIcon size={16} />
          Create Preset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {presets.map((preset) => (
          <PresetCard key={preset.id} preset={preset} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
});

const PresetCard = memo(function PresetCard({
  preset,
  onDelete
}: {
  preset: ThemePreset;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
            {preset.name}
            {!preset.isCustom && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-gray-900/20 dark:text-blue-200 px-2 py-1 rounded">
                Default
              </span>
            )}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {preset.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-2 text-gray-600 dark:text-gray-500 hover:text-blue-900 dark:hover:text-gray-300"
            title="Preview preset"
          >
            <EyeIcon size={16} />
          </button>
          {preset.isCustom && (
            <button
              onClick={() => onDelete(preset.id)}
              className="p-2 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
              title="Delete preset"
            >
              <TrashIcon size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Color Preview */}
      <div className="space-y-3">
        <ColorPreview label="Light Theme" colors={preset.lightTheme} />
        <ColorPreview label="Dark Theme" colors={preset.darkTheme} />
      </div>
    </div>
  );
});

const ColorPreview = memo(function ColorPreview({
  label,
  colors
}: {
  label: string;
  colors: Record<string, string>;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{label}</p>
      <div className="flex gap-2">
        {Object.entries(colors).slice(0, 4).map(([key, color]) => (
          <div
            key={key}
            className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600"
            style={{ backgroundColor: color }}
            title={key}
          />
        ))}
      </div>
    </div>
  );
});

export default PresetsTab;