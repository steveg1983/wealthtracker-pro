import React, { useState, useEffect } from 'react';
import { useTheme } from '../../design-system';
import { colors } from '../../design-system/tokens';
import { CheckIcon, PaletteIcon, SunIcon, MoonIcon, ClockIcon, ComputerDesktopIcon } from '../icons';

interface ThemeCustomizerProps {
  onClose?: () => void;
}

export function ThemeCustomizer({ onClose }: ThemeCustomizerProps): React.JSX.Element {
  const { theme, setTheme, availableThemes, setThemeByMode, customThemes } = useTheme();
  const [selectedMode, setSelectedMode] = useState<'light' | 'dark' | 'auto' | 'scheduled'>('light');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [showCustomColors, setShowCustomColors] = useState(false);
  
  useEffect(() => {
    // Determine current mode and color from theme ID
    if (theme.id.includes('custom')) {
      setShowCustomColors(true);
    } else {
      const parts = theme.id.match(/^(light|dark|highContrast)(.*)$/);
      if (parts) {
        const [, mode, color] = parts;
        setSelectedMode(mode === 'light' || mode === 'dark' ? mode : 'light');
        setSelectedColor(color ? color.toLowerCase() : 'blue');
      }
    }
  }, [theme]);
  
  const handleModeChange = (mode: 'light' | 'dark' | 'auto' | 'scheduled') => {
    setSelectedMode(mode);
    if (mode === 'light' || mode === 'dark') {
      setThemeByMode(selectedColor, mode === 'dark');
    }
  };
  
  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    setThemeByMode(color, selectedMode === 'dark');
  };
  
  const colorOptions = [
    { id: 'blue', name: 'Blue', color: colors.blue[600] },
    { id: 'green', name: 'Green', color: colors.green[600] },
    { id: 'purple', name: 'Purple', color: colors.purple[600] },
  ];
  
  const modeOptions = [
    { id: 'light', name: 'Light', icon: SunIcon, description: 'Always use light theme' },
    { id: 'dark', name: 'Dark', icon: MoonIcon, description: 'Always use dark theme' },
    { id: 'auto', name: 'Auto', icon: ComputerDesktopIcon, description: 'Follow system preference' },
    { id: 'scheduled', name: 'Scheduled', icon: ClockIcon, description: 'Change based on time' },
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Theme Mode
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedMode === option.id;
            
            return (
              <button
                key={option.id}
                onClick={() => handleModeChange(option.id as any)}
                className={`
                  relative flex items-center p-4 rounded-lg border-2 transition-all
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <Icon className={`h-5 w-5 mr-3 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                <div className="text-left">
                  <div className={`font-medium ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>
                    {option.name}
                  </div>
                  <div className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                    {option.description}
                  </div>
                </div>
                {isSelected && (
                  <CheckIcon className="absolute top-2 right-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Color Theme
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {colorOptions.map((option) => {
            const isSelected = selectedColor === option.id;
            
            return (
              <button
                key={option.id}
                onClick={() => handleColorChange(option.id)}
                className={`
                  relative flex flex-col items-center p-4 rounded-lg border-2 transition-all
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <div
                  className="w-12 h-12 rounded-full mb-2"
                  style={{ backgroundColor: option.color }}
                />
                <div className={`font-medium ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>
                  {option.name}
                </div>
                {isSelected && (
                  <CheckIcon className="absolute top-2 right-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Preview
        </h3>
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Primary Text
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Secondary Text
            </span>
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded text-sm font-medium"
              style={{
                backgroundColor: 'var(--color-interactive-primary)',
                color: 'white'
              }}
            >
              Primary Button
            </button>
            <button
              className="px-3 py-1 rounded text-sm font-medium"
              style={{
                backgroundColor: 'var(--color-surface-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-primary)'
              }}
            >
              Secondary Button
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-status-successBackground)' }}>
              <span style={{ color: 'var(--color-status-success)' }}>Success</span>
            </div>
            <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-status-errorBackground)' }}>
              <span style={{ color: 'var(--color-status-error)' }}>Error</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* High Contrast Option */}
      <div>
        <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
          <div className="flex items-center">
            <div className="mr-3">
              <div className="font-medium text-gray-900 dark:text-white">High Contrast</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Enhanced visibility for better readability
              </div>
            </div>
          </div>
          <button
            onClick={() => setTheme(selectedMode === 'dark' ? 'highContrastDark' : 'highContrastLight')}
            className={`
              relative w-11 h-6 rounded-full transition-colors
              ${theme.id.includes('highContrast') ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
            `}
          >
            <span
              className={`
                absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform
                ${theme.id.includes('highContrast') ? 'translate-x-5' : 'translate-x-0'}
              `}
            />
          </button>
        </label>
      </div>
      
      {/* Custom Themes */}
      {customThemes.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Custom Themes
          </h3>
          <div className="space-y-2">
            {customThemes.map((customTheme) => (
              <button
                key={customTheme.id}
                onClick={() => setTheme(customTheme.id)}
                className={`
                  w-full text-left p-3 rounded-lg border transition-all
                  ${theme.id === customTheme.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {customTheme.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {customTheme.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {onClose && (
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}