import React, { useEffect, memo } from 'react';
import { logger } from '../../services/loggingService';

interface PersonalInfoSectionProps {
  firstName: string;
  onFirstNameChange: (name: string) => void;
}

const PersonalInfoSection = memo(function PersonalInfoSection({
  firstName,
  onFirstNameChange
}: PersonalInfoSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PersonalInfoSection component initialized', {
      componentName: 'PersonalInfoSection'
    });
  }, []);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 mb-6">
      <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-4">Personal Information</h2>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          First Name
        </label>
        <input
          type="text"
          value={firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          placeholder="Enter your first name"
          className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
        />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          This will be used in the welcome message on your dashboard. Leave blank to use "User".
        </p>
      </div>
    </div>
  );
});

export default PersonalInfoSection;