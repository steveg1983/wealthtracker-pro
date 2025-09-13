import React, { useEffect, memo, useCallback } from 'react';
import { PlusIcon, XIcon, SaveIcon, RefreshCwIcon } from '../icons';
import type { ColumnMapping, ImportProfile } from '../../services/enhancedCsvImportService';
import { logger } from '../../services/loggingService';

interface MappingStepProps {
  type: 'transaction' | 'account';
  headers: string[];
  mappings: ColumnMapping[];
  profiles: ImportProfile[];
  selectedProfile: ImportProfile | null;
  onMappingChange: (index: number, field: keyof ColumnMapping, value: any) => void;
  onAddMapping: () => void;
  onRemoveMapping: (index: number) => void;
  onLoadProfile: (profile: ImportProfile) => void;
  onSaveProfile: () => void;
  onAutoDetect: () => void;
}

export const MappingStep = memo(function MappingStep({
  type,
  headers,
  mappings,
  profiles,
  selectedProfile,
  onMappingChange,
  onAddMapping,
  onRemoveMapping,
  onLoadProfile,
  onSaveProfile,
  onAutoDetect
}: MappingStepProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('MappingStep component initialized', {
      componentName: 'MappingStep'
    });
  }, []);

  
  const targetFields = type === 'transaction' 
    ? ['date', 'description', 'amount', 'category', 'account', 'notes', 'tags']
    : ['name', 'type', 'balance', 'currency', 'institution'];

  const fieldDescriptions: Record<string, string> = {
    date: 'Transaction date',
    description: 'Transaction description',
    amount: 'Transaction amount (positive for income, negative for expenses)',
    category: 'Transaction category',
    account: 'Account name',
    notes: 'Additional notes',
    tags: 'Tags (comma-separated)',
    name: 'Account name',
    type: 'Account type (checking, savings, etc.)',
    balance: 'Current balance',
    currency: 'Currency code (USD, EUR, etc.)',
    institution: 'Bank or institution name'
  };

  const getFieldColor = (field: string) => {
    const required = type === 'transaction' 
      ? ['date', 'description', 'amount']
      : ['name', 'type'];
    return required.includes(field) ? 'text-red-500' : 'text-gray-500';
  };

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Map CSV Columns
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Map your CSV columns to the appropriate fields. Required fields are marked with red.
        </p>
      </div>

      {/* Profile Management */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Import Profiles
          </h4>
          <div className="flex items-center space-x-2">
            <button
              onClick={onAutoDetect}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex items-center"
            >
              <RefreshCwIcon className="w-3 h-3 mr-1" />
              Auto-detect
            </button>
            <button
              onClick={onSaveProfile}
              disabled={mappings.length === 0}
              className="px-3 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <SaveIcon className="w-3 h-3 mr-1" />
              Save Profile
            </button>
          </div>
        </div>

        {profiles.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {profiles.map(profile => (
              <button
                key={profile.id}
                onClick={() => onLoadProfile(profile)}
                className={`
                  text-left px-3 py-2 rounded text-sm
                  ${selectedProfile?.id === profile.id 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}
                  transition-colors
                `}
              >
                <div className="font-medium">{profile.name}</div>
                <div className="text-xs opacity-75">
                  Last used: {profile.lastUsed ? new Date(profile.lastUsed).toLocaleDateString() : 'Never'}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
            No saved profiles yet. Create one by mapping columns and clicking "Save Profile".
          </p>
        )}
      </div>

      {/* Column Mappings */}
      <div className="space-y-3">
        {mappings.map((mapping, index) => (
          <div key={index} className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                CSV Column
              </label>
              <select
                value={mapping.sourceColumn}
                onChange={(e) => onMappingChange(index, 'sourceColumn', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Select column...</option>
                {headers.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center text-gray-400">
              →
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Target Field
              </label>
              <select
                value={mapping.targetField}
                onChange={(e) => onMappingChange(index, 'targetField', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Select field...</option>
                {targetFields.map(field => (
                  <option key={field} value={field} className={getFieldColor(field)}>
                    {field} {fieldDescriptions[field] && `- ${fieldDescriptions[field]}`}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => onRemoveMapping(index)}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          onClick={onAddMapping}
          className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center justify-center"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Mapping
        </button>
      </div>

      {/* Required Fields Notice */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          <strong>Required fields:</strong> {type === 'transaction' ? 'Date, Description, Amount' : 'Name, Type'}
        </p>
      </div>
    </div>
  );
});
