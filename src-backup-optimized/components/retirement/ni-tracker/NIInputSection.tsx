import { memo, useEffect } from 'react';
import { InfoIcon as Info } from '../../icons';
import type { NITrackerData } from '../../../services/niTrackerService';
import { useLogger } from '../services/ServiceProvider';

interface NIInputSectionProps {
  trackerData: NITrackerData;
  gender: 'male' | 'female';
  currentYear: number;
  onBirthYearChange: (year: number) => void;
  onGenderChange: (gender: 'male' | 'female') => void;
  onWorkStartYearChange: (year: number) => void;
}

/**
 * NI Input Section component
 * Handles user inputs for NI tracking calculation
 */
export const NIInputSection = memo(function NIInputSection({ trackerData,
  gender,
  currentYear,
  onBirthYearChange,
  onGenderChange,
  onWorkStartYearChange
 }: NIInputSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('NIInputSection component initialized', {
      componentName: 'NIInputSection'
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Birth Year
        </label>
        <input
          type="number"
          value={trackerData.birthYear}
          onChange={(e) => onBirthYearChange(Number(e.target.value) || 1970)}
          min="1940"
          max="2010"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Gender (for State Pension age)
        </label>
        <select
          value={gender}
          onChange={(e) => onGenderChange(e.target.value as 'male' | 'female')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Year Started Working
        </label>
        <input
          type="number"
          value={trackerData.workStartYear}
          onChange={(e) => onWorkStartYearChange(Number(e.target.value) || 1988)}
          min="1940"
          max={currentYear}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-gray-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Your State Pension Age: {trackerData.statePensionAge}</p>
            <p>You have {trackerData.statePensionAge - trackerData.currentAge} years until State Pension age.</p>
          </div>
        </div>
      </div>
    </div>
  );
});