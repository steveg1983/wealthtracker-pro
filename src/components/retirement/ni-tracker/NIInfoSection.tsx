import { memo, useEffect } from 'react';
import { InfoIcon as Info } from '../../icons';
import { logger } from '../../../services/loggingService';

/**
 * NI Info Section component
 * Displays important information and external links
 */
export const NIInfoSection = memo(function NIInfoSection(): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('NIInfoSection component initialized', {
      componentName: 'NIInfoSection'
    });
  }, []);

  return (
    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start gap-2">
        <Info className="h-5 w-5 text-gray-600 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium mb-1">Important Information</p>
          <ul className="space-y-1">
            <li>• Check your actual NI record at{' '}
              <a 
                href="https://www.gov.uk/check-national-insurance-record" 
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                gov.uk/check-national-insurance-record
              </a>
            </li>
            <li>• You can usually buy gaps from the last 6 years</li>
            <li>• Special deadline: You can buy gaps back to 2006 until 5 April 2025</li>
            <li>• Contracted out years may reduce your State Pension</li>
            <li>• This is an estimate - get a forecast at{' '}
              <a 
                href="https://www.gov.uk/check-state-pension" 
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                gov.uk/check-state-pension
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
});