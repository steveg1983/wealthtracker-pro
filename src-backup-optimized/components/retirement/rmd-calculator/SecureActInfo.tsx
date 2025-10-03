import { memo, useEffect } from 'react';
import { AlertTriangleIcon as AlertTriangle } from '../../icons';
import { useLogger } from '../services/ServiceProvider';

/**
 * SECURE Act 2.0 info component
 * Displays information about recent RMD rule changes
 */
export const SecureActInfo = memo(function SecureActInfo(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SecureActInfo component initialized', {
      componentName: 'SecureActInfo'
    });
  }, []);

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h5 className="font-medium text-blue-900 mb-2">SECURE Act 2.0 Changes</h5>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• RMD age: 73 (born 1951-1959)</li>
          <li>• RMD age: 75 (born 1960 or later)</li>
          <li>• Penalty reduced to 25% (was 50%)</li>
          <li>• Penalty reduced to 10% if corrected within 2 years</li>
          <li>• No RMDs from Roth 401(k)s starting 2024</li>
        </ul>
      </div>

      <DisclaimerSection />
    </>
  );
});

/**
 * Disclaimer section component
 */
const DisclaimerSection = memo(function DisclaimerSection() {
  return (
    <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-medium mb-1">Important Disclaimer</p>
          <p>
            This calculator uses the IRS Uniform Lifetime Table and SECURE Act 2.0 rules for 2024. 
            Consult with a tax professional or financial advisor for personalized RMD calculations, 
            especially if you have multiple retirement accounts or complex beneficiary situations.
          </p>
        </div>
      </div>
    </div>
  );
});