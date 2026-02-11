import React from 'react';
import { GraduationCapIcon } from './icons';

export default function CollegePlanner() {
  return (
    <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-sm p-12 text-center">
      <GraduationCapIcon size={48} className="mx-auto mb-4 text-gray-400" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        College Planning
      </h3>
      <p className="text-gray-500 dark:text-gray-400">
        College planning tools will be available in a future update
      </p>
    </div>
  );
}
