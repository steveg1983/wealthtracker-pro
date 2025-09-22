/**
 * RetirementDisclaimer Component - Legal disclaimer for retirement planning tools
 *
 * Features:
 * - Important legal disclaimers
 * - Risk warnings
 * - Professional advice recommendations
 * - Regulatory compliance
 * - User acknowledgment
 */

import React, { useState } from 'react';

export interface RetirementDisclaimerProps {
  onAccept?: () => void;
  onDecline?: () => void;
  showAcceptButton?: boolean;
  className?: string;
}

export function RetirementDisclaimer({
  onAccept,
  onDecline,
  showAcceptButton = false,
  className = ''
}: RetirementDisclaimerProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            Important Disclaimer - Retirement Planning Information
          </h3>

          <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-3">
            <p>
              <strong>This is for educational purposes only.</strong> The retirement planning tools and calculations
              provided are estimates based on the information you provide and various assumptions.
              Actual results may vary significantly.
            </p>

            {isExpanded && (
              <div className="space-y-3 mt-4">
                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Key Limitations:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Calculations are based on current tax rules and pension regulations, which may change</li>
                    <li>Investment returns are projected and not guaranteed</li>
                    <li>Inflation assumptions may not reflect actual future rates</li>
                    <li>State pension rules and amounts are subject to government changes</li>
                    <li>Personal circumstances can significantly affect outcomes</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Risk Warnings:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Investment values can go down as well as up</li>
                    <li>Past performance is not a guide to future returns</li>
                    <li>You may get back less than you invested</li>
                    <li>Tax treatment depends on individual circumstances</li>
                    <li>Pension rules and tax relief may change in the future</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Professional Advice:</h4>
                  <p className="text-sm">
                    Before making any financial decisions, we strongly recommend consulting with:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                    <li>A qualified independent financial adviser</li>
                    <li>A pension specialist for complex pension arrangements</li>
                    <li>A tax adviser for tax-related implications</li>
                    <li>Your pension provider for scheme-specific guidance</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Data Sources:</h4>
                  <p className="text-sm">
                    State pension information is based on current UK government guidelines.
                    Workplace pension calculations use standard assumptions and may not reflect
                    your specific scheme rules.
                  </p>
                </div>

                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded border-l-4 border-yellow-400">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">Regulatory Information:</h4>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    This application is not regulated by the Financial Conduct Authority (FCA).
                    The information provided does not constitute financial advice.
                    Always verify information with official sources.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Your Responsibilities:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Verify all calculations independently</li>
                    <li>Keep your information up to date</li>
                    <li>Review your retirement plans regularly</li>
                    <li>Seek professional advice for major decisions</li>
                    <li>Check official government websites for current rules</li>
                  </ul>
                </div>

                <div className="border-t border-yellow-300 dark:border-yellow-700 pt-3 mt-4">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Useful Resources:</h4>
                  <ul className="text-sm space-y-1">
                    <li>• <strong>Gov.uk:</strong> Official UK government pension information</li>
                    <li>• <strong>Pension Wise:</strong> Free pension guidance service</li>
                    <li>• <strong>FCA:</strong> Financial Conduct Authority guidance</li>
                    <li>• <strong>MoneyHelper:</strong> Free financial guidance</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm font-medium text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 focus:outline-none focus:underline"
            >
              {isExpanded ? 'Show less' : 'Read full disclaimer'}
            </button>

            {showAcceptButton && (
              <div className="flex space-x-3">
                {onDecline && (
                  <button
                    onClick={onDecline}
                    className="px-4 py-2 text-sm font-medium text-yellow-800 dark:text-yellow-200 border border-yellow-400 dark:border-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    I don't accept
                  </button>
                )}
                {onAccept && (
                  <button
                    onClick={onAccept}
                    className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    I understand and accept
                  </button>
                )}
              </div>
            )}
          </div>

          {!showAcceptButton && (
            <div className="mt-3 text-xs text-yellow-600 dark:text-yellow-400">
              By using these retirement planning tools, you acknowledge that you have read and understood this disclaimer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simplified version for embedding in other components
export function SimpleRetirementDisclaimer({
  className = ''
}: {
  className?: string;
}): React.JSX.Element {
  return (
    <div className={`bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3 ${className}`}>
      <div className="flex items-center space-x-2">
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>Disclaimer:</strong> This is for guidance only and not financial advice.
          Calculations are estimates based on current rules which may change.
          Consider seeking professional financial advice.
        </p>
      </div>
    </div>
  );
}

export default RetirementDisclaimer;