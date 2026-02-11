import React, { useState } from 'react';
import { useTheme } from '../design-system';
import { SunIcon, MoonIcon } from './icons';

export function ThemeSwitcher(): React.JSX.Element {
  const { theme, setThemeByMode } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  
  const isDark = theme.isDark;
  const CurrentIcon = isDark ? MoonIcon : SunIcon;
  
  const colorOptions = [
    { id: 'blue', label: 'Blue' },
    { id: 'green', label: 'Green' },
    { id: 'purple', label: 'Purple' },
  ];
  
  const extractColorFromTheme = (themeId: string): string => {
    const match = themeId.match(/^(?:light|dark|highContrast)(.*)$/);
    return match ? match[1].toLowerCase() : 'blue';
  };
  
  const currentColor = extractColorFromTheme(theme.id);
  
  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        aria-label="Theme settings"
      >
        <CurrentIcon className="h-5 w-5" />
      </button>
      
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-card-bg-light dark:bg-card-bg-dark ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Mode
              </div>
              <button
                onClick={() => {
                  setThemeByMode(currentColor, false);
                  setShowDropdown(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                  !isDark ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <SunIcon className="h-4 w-4" />
                Light
              </button>
              <button
                onClick={() => {
                  setThemeByMode(currentColor, true);
                  setShowDropdown(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                  isDark ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <MoonIcon className="h-4 w-4" />
                Dark
              </button>
              
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              
              <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Color
              </div>
              {colorOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setThemeByMode(option.id, isDark);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                    currentColor === option.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{
                      backgroundColor: option.id === 'blue' ? '#3b82f6' : 
                                     option.id === 'green' ? '#22c55e' : 
                                     '#a855f7'
                    }}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
