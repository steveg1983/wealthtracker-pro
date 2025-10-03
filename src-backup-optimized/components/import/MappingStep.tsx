import React, { memo, useState, useEffect } from 'react';
import { ChevronRightIcon } from '../icons';
import type { ColumnMapping } from '../../services/enhancedCsvImportService';
import { useLogger } from '../services/ServiceProvider';

interface MappingStepProps {
  csvHeaders: string[];
  mappings: ColumnMapping[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
  selectedBankFormat: string;
}

export const MappingStep = memo(function MappingStep({ csvHeaders,
  mappings,
  onMappingsChange,
  selectedBankFormat
 }: MappingStepProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('MappingStep component initialized', {
      componentName: 'MappingStep'
    });
  }, []);

  const [localMappings, setLocalMappings] = useState<ColumnMapping[]>(mappings);

  useEffect(() => {
    setLocalMappings(mappings);
  }, [mappings]);

  const fieldOptions = [
    { value: 'date', label: 'Date' },
    { value: 'description', label: 'Description' },
    { value: 'amount', label: 'Amount' },
    { value: 'debit', label: 'Debit Amount' },
    { value: 'credit', label: 'Credit Amount' },
    { value: 'balance', label: 'Balance' },
    { value: 'category', label: 'Category' },
    { value: 'merchant', label: 'Merchant' },
    { value: 'notes', label: 'Notes' },
    { value: 'ignore', label: 'Ignore' }
  ];

  const handleMappingChange = (csvColumn: string, field: string) => {
    const newMappings = localMappings.filter(m => m.sourceColumn !== csvColumn);
    if (field !== 'ignore') {
      newMappings.push({ sourceColumn: csvColumn, targetField: field, transform: undefined });
    }
    setLocalMappings(newMappings);
    onMappingsChange(newMappings);
  };

  const getMappingForColumn = (column: string): string => {
    const mapping = localMappings.find(m => m.sourceColumn === column);
    return mapping ? mapping.targetField : 'ignore';
  };

  const autoDetectMappings = () => {
    const detectedMappings: ColumnMapping[] = [];
    
    csvHeaders.forEach(header => {
      const lower = header.toLowerCase();
      let field = 'ignore';
      
      if (lower.includes('date')) {
        field = 'date';
      } else if (lower.includes('description') || lower.includes('narration') || lower.includes('memo')) {
        field = 'description';
      } else if (lower.includes('amount') && !lower.includes('debit') && !lower.includes('credit')) {
        field = 'amount';
      } else if (lower.includes('debit') || lower.includes('withdrawal')) {
        field = 'debit';
      } else if (lower.includes('credit') || lower.includes('deposit')) {
        field = 'credit';
      } else if (lower.includes('balance')) {
        field = 'balance';
      } else if (lower.includes('category')) {
        field = 'category';
      } else if (lower.includes('merchant') || lower.includes('payee')) {
        field = 'merchant';
      } else if (lower.includes('notes') || lower.includes('reference')) {
        field = 'notes';
      }
      
      if (field !== 'ignore') {
        detectedMappings.push({ sourceColumn: header, targetField: field, transform: undefined });
      }
    });
    
    setLocalMappings(detectedMappings);
    onMappingsChange(detectedMappings);
  };

  const isValidMapping = (): boolean => {
    const hasDate = localMappings.some(m => m.targetField === 'date');
    const hasAmount = localMappings.some(m => 
      m.targetField === 'amount' || (m.targetField === 'debit' || m.targetField === 'credit')
    );
    const hasDescription = localMappings.some(m => m.targetField === 'description');
    
    return hasDate && hasAmount && hasDescription;
  };

  return (
    <div className="space-y-4">
      {selectedBankFormat === 'custom' && (
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Map CSV Columns to Transaction Fields
          </h3>
          <button
            onClick={autoDetectMappings}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Auto-Detect
          </button>
        </div>
      )}

      <div className="space-y-2">
        {csvHeaders.map((header, index) => (
          <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {header}
              </span>
            </div>
            <ChevronRightIcon size={20} className="text-gray-400" />
            <div className="flex-1">
              <select
                value={getMappingForColumn(header)}
                onChange={(e) => handleMappingChange(header, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                disabled={selectedBankFormat !== 'custom'}
              >
                {fieldOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {!isValidMapping() && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            ⚠️ Required mappings: Date, Amount (or Debit/Credit), and Description
          </p>
        </div>
      )}

      {selectedBankFormat !== 'custom' && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            ℹ️ Column mappings are pre-configured for {selectedBankFormat}. 
            Switch to "Custom Format" to modify mappings.
          </p>
        </div>
      )}
    </div>
  );
});
