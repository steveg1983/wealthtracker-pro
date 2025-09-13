import React, { useEffect, memo } from 'react';
import { CalendarIcon, WalletIcon, FileTextIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface BasicInfoFormProps {
  date: string;
  accountId: string;
  description: string;
  accounts: Array<{ id: string; name: string; type: string }>;
  onDateChange: (date: string) => void;
  onAccountChange: (accountId: string) => void;
  onDescriptionChange: (description: string) => void;
}

export const BasicInfoForm = memo(function BasicInfoForm({
  date,
  accountId,
  description,
  accounts,
  onDateChange,
  onAccountChange,
  onDescriptionChange
}: BasicInfoFormProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BasicInfoForm component initialized', {
      componentName: 'BasicInfoForm'
    });
  }, []);

  return (
    <>
      <div className="md:col-span-5">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          <CalendarIcon size={16} />
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
          required
        />
      </div>

      <div className="md:col-span-7">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          <WalletIcon size={16} />
          Account
        </label>
        <select
          value={accountId}
          onChange={(e) => onAccountChange(e.target.value)}
          className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
          required
        >
          <option value="">Select account</option>
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.type})
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-12">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          <FileTextIcon size={16} />
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
          required
        />
      </div>
    </>
  );
});