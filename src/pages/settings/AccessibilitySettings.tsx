import React, { useState } from 'react';
import PageWrapper from '../../components/PageWrapper';
import { EyeIcon, Keyboard, Monitor, VolumeIcon, AlertTriangle, CheckCircle } from '../../components/icons';
import { usePreferences } from '../../contexts/PreferencesContext';
import AccessibilityAuditPanel from '../../components/AccessibilityAuditPanel';
import AccessibilityChecklist from '../../components/AccessibilityChecklist';
import { useHighContrastMode, useReducedMotion } from '../../components/layout/AccessibilityImprovements';

export default function AccessibilitySettings(): React.JSX.Element {
  const { preferences, updatePreferences } = usePreferences();
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const isHighContrast = useHighContrastMode();
  const prefersReducedMotion = useReducedMotion();

  const handleToggle = (key: string, value: boolean) => {
    updatePreferences({ [key]: value });
  };

  return (
    <PageWrapper title="Accessibility Settings">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* System Preferences Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            System Preferences Detected
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">High Contrast Mode</span>
              <span className={`text-sm ${isHighContrast ? 'text-green-600' : 'text-gray-500'}`}>
                {isHighContrast ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">Reduced Motion</span>
              <span className={`text-sm ${prefersReducedMotion ? 'text-green-600' : 'text-gray-500'}`}>
                {prefersReducedMotion ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* Accessibility Audit */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Accessibility Audit
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Run an automated audit to check for accessibility issues
              </p>
            </div>
            <AlertTriangle size={24} className="text-yellow-600" />
          </div>
          
          <button
            onClick={() => setShowAuditPanel(true)}
            className="w-full sm:w-auto px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
          >
            <EyeIcon size={20} />
            Run Accessibility Audit
          </button>
        </div>

        {/* Visual Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Visual Settings
            </h2>
            <Monitor size={24} className="text-gray-400" />
          </div>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Large Text Mode</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Increase text size throughout the application
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.largeTextMode || false}
                onChange={(e) => handleToggle('largeTextMode', e.target.checked)}
                className="ml-4 h-5 w-5 text-primary rounded focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">High Contrast Borders</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Add high contrast borders to interactive elements
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.highContrastBorders || false}
                onChange={(e) => handleToggle('highContrastBorders', e.target.checked)}
                className="ml-4 h-5 w-5 text-primary rounded focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Focus Indicators</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Show enhanced focus indicators for keyboard navigation
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.enhancedFocusIndicators !== false}
                onChange={(e) => handleToggle('enhancedFocusIndicators', e.target.checked)}
                className="ml-4 h-5 w-5 text-primary rounded focus:ring-primary"
              />
            </label>
          </div>
        </div>

        {/* Keyboard Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Keyboard Navigation
            </h2>
            <Keyboard size={24} className="text-gray-400" />
          </div>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Skip Links</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Show skip navigation links for keyboard users
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.showSkipLinks !== false}
                onChange={(e) => handleToggle('showSkipLinks', e.target.checked)}
                className="ml-4 h-5 w-5 text-primary rounded focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Tab Focus Highlighting</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Highlight elements when navigating with Tab key
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.tabFocusHighlighting !== false}
                onChange={(e) => handleToggle('tabFocusHighlighting', e.target.checked)}
                className="ml-4 h-5 w-5 text-primary rounded focus:ring-primary"
              />
            </label>
          </div>
        </div>

        {/* Screen Reader */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Screen Reader Support
            </h2>
            <VolumeIcon size={24} className="text-gray-400" />
          </div>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Announce Route Changes</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Announce page changes to screen readers
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.announceRouteChanges !== false}
                onChange={(e) => handleToggle('announceRouteChanges', e.target.checked)}
                className="ml-4 h-5 w-5 text-primary rounded focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Live Regions</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enable live region announcements for dynamic content
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.liveRegions !== false}
                onChange={(e) => handleToggle('liveRegions', e.target.checked)}
                className="ml-4 h-5 w-5 text-primary rounded focus:ring-primary"
              />
            </label>
          </div>
        </div>

        {/* Motion Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Motion & Animation
            </h2>
          </div>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Reduce Motion</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Minimize animations and transitions
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.reduceMotion || false}
                onChange={(e) => handleToggle('reduceMotion', e.target.checked)}
                className="ml-4 h-5 w-5 text-primary rounded focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Disable Auto-play</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Prevent videos and animations from auto-playing
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.disableAutoplay || false}
                onChange={(e) => handleToggle('disableAutoplay', e.target.checked)}
                className="ml-4 h-5 w-5 text-primary rounded focus:ring-primary"
              />
            </label>
          </div>
        </div>

        {/* Accessibility Checklist */}
        <AccessibilityChecklist />

        {/* WCAG Compliance Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle size={24} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                WCAG 2.1 Compliance
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                WealthTracker aims to meet WCAG 2.1 Level AA standards. We continuously improve 
                our accessibility features to ensure everyone can manage their finances effectively.
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                If you encounter any accessibility issues, please contact our support team.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Accessibility Audit Panel */}
      <AccessibilityAuditPanel 
        isOpen={showAuditPanel} 
        onClose={() => setShowAuditPanel(false)} 
      />
    </PageWrapper>
  );
}