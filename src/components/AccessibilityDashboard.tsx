/**
 * Accessibility Dashboard
 * Real-time accessibility monitoring and reporting
 */

import React from 'react';
import { useAccessibilityAudit } from '../hooks/useAccessibilityAudit';
import { ColorContrastChecker, commonCombinations } from '../utils/color-contrast-checker';
import { accessibleColorClasses } from '../design-system/accessible-colors';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  AlertTriangleIcon,
  InfoIcon,
  EyeIcon,
  PaletteIcon,
  KeyboardIcon,
  TagIcon
} from './icons';

export const AccessibilityDashboard: React.FC = () => {
  const { 
    issues, 
    stats, 
    runAudit, 
    isAuditing,
    lastAuditTime 
  } = useAccessibilityAudit({ autoAudit: true });

  const [activeTab, setActiveTab] = React.useState<'overview' | 'issues' | 'colors' | 'guidelines'>('overview');
  const [colorContrastResults, setColorContrastResults] = React.useState<Array<{ fg: string; bg: string; result: unknown }>>([]);

  React.useEffect(() => {
    // Run color contrast audit
    const results = commonCombinations.map(combo => ({
      ...combo,
      result: ColorContrastChecker.checkContrast(combo.fg, combo.bg)
    }));
    setColorContrastResults(results);
  }, []);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-6 rounded-lg border ${accessibleColorClasses['border-default']} ${accessibleColorClasses['bg-secondary']}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${accessibleColorClasses['text-primary']}`}>
              Overall Score
            </h3>
            {stats.total === 0 ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            ) : (
              <AlertTriangleIcon className="h-6 w-6 text-yellow-600" />
            )}
          </div>
          <div className="text-3xl font-bold">
            {stats.total === 0 ? '100%' : `${Math.round((1 - (stats.errors / 50)) * 100)}%`}
          </div>
          <p className={`text-sm mt-2 ${accessibleColorClasses['text-muted']}`}>
            {stats.total === 0 ? 'Fully accessible!' : `${stats.total} issues found`}
          </p>
        </div>

        <div className={`p-6 rounded-lg border ${accessibleColorClasses['border-default']} ${accessibleColorClasses['bg-secondary']}`}>
          <h3 className={`font-semibold mb-4 ${accessibleColorClasses['text-primary']}`}>
            Issue Breakdown
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <XCircleIcon className="h-4 w-4 text-red-600" />
                <span className={accessibleColorClasses['text-secondary']}>Errors</span>
              </span>
              <span className="font-medium">{stats.errors}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4 text-yellow-600" />
                <span className={accessibleColorClasses['text-secondary']}>Warnings</span>
              </span>
              <span className="font-medium">{stats.warnings}</span>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-lg border ${accessibleColorClasses['border-default']} ${accessibleColorClasses['bg-secondary']}`}>
          <h3 className={`font-semibold mb-4 ${accessibleColorClasses['text-primary']}`}>
            Categories
          </h3>
          <div className="space-y-1 text-sm">
            {Object.entries(stats.byCategory).slice(0, 4).map(([category, count]) => (
              <div key={category} className="flex justify-between">
                <span className={accessibleColorClasses['text-secondary']}>{category}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={`p-6 rounded-lg border ${accessibleColorClasses['border-default']} ${accessibleColorClasses['bg-secondary']}`}>
        <h3 className={`font-semibold mb-4 ${accessibleColorClasses['text-primary']}`}>
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={runAudit}
            disabled={isAuditing}
            className={`px-4 py-2 rounded-lg font-medium ${accessibleColorClasses['btn-primary']} disabled:opacity-50`}
          >
            {isAuditing ? 'Running Audit...' : 'Run Full Audit'}
          </button>
          <button
            onClick={() => window.print()}
            className={`px-4 py-2 rounded-lg font-medium ${accessibleColorClasses['btn-secondary']}`}
          >
            Generate Report
          </button>
        </div>
        {lastAuditTime && (
          <p className={`text-sm mt-3 ${accessibleColorClasses['text-muted']}`}>
            Last audit: {lastAuditTime.toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );

  const renderIssues = () => (
    <div className="space-y-4">
      {issues.length === 0 ? (
        <div className={`text-center py-12 ${accessibleColorClasses['text-muted']}`}>
          <CheckCircleIcon className="h-12 w-12 mx-auto mb-4 text-green-600" />
          <p className="text-lg">No accessibility issues found!</p>
          <p className="text-sm mt-2">Your app meets WCAG 2.1 AA standards.</p>
        </div>
      ) : (
        issues.map((issue, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${accessibleColorClasses['border-default']} ${
              issue.type === 'error' ? 'border-red-300 dark:border-red-700' : 'border-yellow-300 dark:border-yellow-700'
            }`}
          >
            <div className="flex items-start gap-3">
              {issue.type === 'error' ? (
                <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              ) : (
                <AlertTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className={`font-medium ${accessibleColorClasses['text-primary']}`}>
                  {issue.message}
                </h4>
                {issue.wcagCriteria && (
                  <p className={`text-sm mt-1 ${accessibleColorClasses['text-muted']}`}>
                    WCAG {issue.wcagCriteria}
                  </p>
                )}
                {issue.howToFix && (
                  <p className={`text-sm mt-2 ${accessibleColorClasses['text-secondary']}`}>
                    <strong>How to fix:</strong> {issue.howToFix}
                  </p>
                )}
                <p className={`text-xs mt-2 font-mono ${accessibleColorClasses['text-muted']}`}>
                  {issue.element.tagName.toLowerCase()}
                  {issue.element.className && `.${issue.element.className.split(' ')[0]}`}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderColors = () => (
    <div className="space-y-6">
      <div className={`p-4 rounded-lg ${accessibleColorClasses['bg-secondary']} ${accessibleColorClasses['border-default']} border`}>
        <h3 className={`font-semibold mb-3 ${accessibleColorClasses['text-primary']}`}>
          Color Contrast Analysis
        </h3>
        <p className={`text-sm ${accessibleColorClasses['text-secondary']}`}>
          All color combinations should meet WCAG 2.1 AA standards (4.5:1 for normal text, 3:1 for large text).
        </p>
      </div>

      <div className="grid gap-4">
        {colorContrastResults.map((combo, index) => {
          const passes = combo.result.passes.normal.aa;
          return (
            <div
              key={index}
              className={`p-4 rounded-lg border ${accessibleColorClasses['border-default']} ${accessibleColorClasses['bg-primary']}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className={`font-medium ${accessibleColorClasses['text-primary']}`}>
                  {combo.name}
                </h4>
                {passes ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-red-600" />
                )}
              </div>
              
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-12 h-12 rounded border border-gray-300"
                    style={{ backgroundColor: combo.bg }}
                  >
                    <div
                      className="w-full h-full flex items-center justify-center font-bold"
                      style={{ color: combo.fg }}
                    >
                      Aa
                    </div>
                  </div>
                  <div className={`text-sm ${accessibleColorClasses['text-muted']}`}>
                    <div className="font-mono">{combo.fg}</div>
                    <div className="font-mono">{combo.bg}</div>
                  </div>
                </div>
                
                <div className={`text-sm ${accessibleColorClasses['text-secondary']}`}>
                  <div>Ratio: <strong>{combo.result.ratio}:1</strong></div>
                  <div className="text-xs">
                    AA: {combo.result.passes.normal.aa ? '✓' : '✗'} | 
                    AAA: {combo.result.passes.normal.aaa ? '✓' : '✗'}
                  </div>
                </div>
              </div>
              
              {combo.result.recommendation && (
                <p className={`text-sm ${passes ? accessibleColorClasses['text-success'] : accessibleColorClasses['text-error']}`}>
                  {combo.result.recommendation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderGuidelines = () => (
    <div className="space-y-6">
      <div className={`p-6 rounded-lg ${accessibleColorClasses['bg-secondary']} ${accessibleColorClasses['border-default']} border`}>
        <h3 className={`text-lg font-semibold mb-4 ${accessibleColorClasses['text-primary']}`}>
          WCAG 2.1 AA Guidelines
        </h3>
        
        <div className="space-y-4">
          <div>
            <h4 className={`font-medium mb-2 flex items-center gap-2 ${accessibleColorClasses['text-primary']}`}>
              <EyeIcon className="h-5 w-5" />
              Perceivable
            </h4>
            <ul className={`space-y-1 text-sm ${accessibleColorClasses['text-secondary']} list-disc list-inside`}>
              <li>Provide text alternatives for non-text content</li>
              <li>Ensure sufficient color contrast (4.5:1 for normal text)</li>
              <li>Make content adaptable to different presentations</li>
              <li>Use more than color alone to convey information</li>
            </ul>
          </div>

          <div>
            <h4 className={`font-medium mb-2 flex items-center gap-2 ${accessibleColorClasses['text-primary']}`}>
              <KeyboardIcon className="h-5 w-5" />
              Operable
            </h4>
            <ul className={`space-y-1 text-sm ${accessibleColorClasses['text-secondary']} list-disc list-inside`}>
              <li>Make all functionality keyboard accessible</li>
              <li>Provide users enough time to read content</li>
              <li>Don't use content that causes seizures</li>
              <li>Help users navigate and find content</li>
            </ul>
          </div>

          <div>
            <h4 className={`font-medium mb-2 flex items-center gap-2 ${accessibleColorClasses['text-primary']}`}>
              <InfoIcon className="h-5 w-5" />
              Understandable
            </h4>
            <ul className={`space-y-1 text-sm ${accessibleColorClasses['text-secondary']} list-disc list-inside`}>
              <li>Make text readable and understandable</li>
              <li>Make web pages appear and operate predictably</li>
              <li>Help users avoid and correct mistakes</li>
              <li>Label all form inputs clearly</li>
            </ul>
          </div>

          <div>
            <h4 className={`font-medium mb-2 flex items-center gap-2 ${accessibleColorClasses['text-primary']}`}>
              <TagIcon className="h-5 w-5" />
              Robust
            </h4>
            <ul className={`space-y-1 text-sm ${accessibleColorClasses['text-secondary']} list-disc list-inside`}>
              <li>Use valid, well-structured HTML</li>
              <li>Ensure compatibility with assistive technologies</li>
              <li>Use ARIA attributes appropriately</li>
              <li>Provide name, role, and value for all UI components</li>
            </ul>
          </div>
        </div>
      </div>

      <div className={`p-6 rounded-lg ${accessibleColorClasses['bg-secondary']} ${accessibleColorClasses['border-default']} border`}>
        <h3 className={`font-semibold mb-3 ${accessibleColorClasses['text-primary']}`}>
          Testing Tools
        </h3>
        <ul className={`space-y-2 text-sm ${accessibleColorClasses['text-secondary']}`}>
          <li>• Use keyboard navigation (Tab, Shift+Tab, Enter, Space, Arrow keys)</li>
          <li>• Test with screen readers (NVDA, JAWS, VoiceOver)</li>
          <li>• Check color contrast with browser DevTools</li>
          <li>• Use automated tools like axe DevTools</li>
          <li>• Test with browser zoom at 200%</li>
          <li>• Disable CSS to check content structure</li>
        </ul>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: InfoIcon },
    { id: 'issues', label: `Issues (${stats.total})`, icon: AlertTriangleIcon },
    { id: 'colors', label: 'Colors', icon: PaletteIcon },
    { id: 'guidelines', label: 'Guidelines', icon: CheckCircleIcon }
  ];

  return (
    <div className={`p-6 ${accessibleColorClasses['bg-primary']}`}>
      <div className="max-w-6xl mx-auto">
        <h1 className={`text-2xl font-bold mb-6 ${accessibleColorClasses['text-primary']}`}>
          Accessibility Dashboard
        </h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8" aria-label="Accessibility dashboard tabs">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'overview' | 'issues' | 'colors' | 'guidelines')}
                  className={`
                    py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                    ${activeTab === tab.id 
                      ? 'border-gray-600 text-gray-600 dark:text-gray-500' 
                      : `border-transparent ${accessibleColorClasses['text-muted']} hover:text-gray-700 dark:hover:text-gray-300`
                    }
                  `}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'issues' && renderIssues()}
          {activeTab === 'colors' && renderColors()}
          {activeTab === 'guidelines' && renderGuidelines()}
        </div>
      </div>
    </div>
  );
};