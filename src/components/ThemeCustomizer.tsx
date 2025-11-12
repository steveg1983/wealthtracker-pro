import React from 'react';
import { usePreferences } from '../contexts/PreferencesContext';
import { XIcon, PaletteIcon, SunIcon, MoonIcon, ComputerIcon } from './icons';

interface ThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ThemeCustomizer({ isOpen, onClose }: ThemeCustomizerProps) {
  const { theme, setTheme, colorTheme, setColorTheme } = usePreferences();

  const accentColors = [
    { name: 'Blue', value: 'blue', color: '#0078d4' },
    { name: 'Green', value: 'green', color: '#34c759' },
    { name: 'Purple', value: 'purple', color: '#af52de' },
    { name: 'Orange', value: 'orange', color: '#ff9500' },
    { name: 'Red', value: 'red', color: '#ff3b30' },
    { name: 'Pink', value: 'pink', color: '#ff2d55' },
    { name: 'Indigo', value: 'indigo', color: '#5856d6' },
    { name: 'Teal', value: 'teal', color: '#5ac8fa' },
    { name: 'Yellow', value: 'yellow', color: '#ffcc00' },
    { name: 'Gray', value: 'gray', color: '#8e8e93' },
  ];

  const themeOptions = [
    { name: 'Light', value: 'light', icon: SunIcon },
    { name: 'Dark', value: 'dark', icon: MoonIcon },
    { name: 'Auto', value: 'auto', icon: ComputerIcon },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3">
            <PaletteIcon size={24} className="text-[var(--color-primary)]" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Theme Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XIcon size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Theme Mode Selection */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Theme Mode</h3>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value as 'light' | 'dark' | 'auto' | 'scheduled')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      theme === option.value
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'border-gray-200 dark:border-gray-600 hover:border-[var(--color-primary)]/50'
                    }`}
                  >
                    <Icon size={24} className="mx-auto mb-2 text-gray-600 dark:text-gray-400" />
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {option.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color Selection */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Accent Color</h3>
            <div className="grid grid-cols-5 gap-3">
              {accentColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setColorTheme(color.value as 'blue' | 'green' | 'red' | 'pink')}
                  className={`w-full aspect-square rounded-lg border-2 transition-all ${
                    colorTheme === color.value
                      ? 'border-gray-900 dark:border-white scale-110'
                      : 'border-gray-200 dark:border-gray-600 hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.color }}
                  title={color.name}
                  aria-label={`Set accent color to ${color.name}`}
                >
                  {colorTheme === color.value && (
                    <div className="w-full h-full rounded-lg flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-current" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Preview */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Preview</h3>
            <div className="p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              <div className="mb-3">
                <div className="h-3 bg-[var(--color-primary)] rounded-full w-3/4 mb-2" />
                <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
              </div>
              <div className="flex space-x-2">
                <div className="flex-1 h-8 bg-[var(--color-primary)] rounded" />
                <div className="flex-1 h-8 bg-gray-300 dark:bg-gray-600 rounded" />
              </div>
            </div>
          </div>

          {/* Reset to Default */}
          <div>
            <button
              onClick={() => {
                setTheme('light');
                setColorTheme('blue');
              }}
              className="w-full p-3 text-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-900 dark:text-white"
            >
              Reset to Default
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-600">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-secondary)] transition-colors"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
