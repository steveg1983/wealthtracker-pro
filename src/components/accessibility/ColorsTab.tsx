import React, { useEffect, memo } from 'react';
import { CheckCircleIcon, XCircleIcon } from '../icons';
import { accessibleColorClasses } from '../../design-system/accessible-colors';
import type { ColorContrastResult } from '../../services/accessibilityDashboardService';
import { logger } from '../../services/loggingService';

interface ColorsTabProps {
  colorContrastResults: ColorContrastResult[];
}

const ColorsTab = memo(function ColorsTab({ 
  colorContrastResults 
}: ColorsTabProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ColorsTab component initialized', {
      componentName: 'ColorsTab'
    });
  }, []);

  return (
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
          const passes = combo.passes.normal.aa;
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
                  <div>Ratio: <strong>{combo.ratio}:1</strong></div>
                  <div className="text-xs">
                    AA: {combo.passes.normal.aa ? '✓' : '✗'} | 
                    AAA: {combo.passes.normal.aaa ? '✓' : '✗'}
                  </div>
                </div>
              </div>
              
              {combo.recommendation && (
                <p className={`text-sm ${passes ? accessibleColorClasses['text-success'] : accessibleColorClasses['text-error']}`}>
                  {combo.recommendation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default ColorsTab;