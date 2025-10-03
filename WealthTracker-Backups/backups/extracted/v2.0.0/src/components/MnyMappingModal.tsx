import { useState, useEffect } from 'react';
import { XIcon } from './icons/XIcon';
import { AlertCircleIcon } from './icons/AlertCircleIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import type { FieldMapping } from '../utils/mnyParser';

interface MnyMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawData: Array<Record<string, unknown>>;
  onMappingComplete: (mapping: FieldMapping, data: Array<Record<string, unknown>>) => void;
}


const FIELD_OPTIONS = [
  { value: 'ignore', label: 'Ignore this column' },
  { value: 'date', label: 'Date' },
  { value: 'amount', label: 'Amount' },
  { value: 'description', label: 'Description' },
  { value: 'payee', label: 'Payee' },
  { value: 'category', label: 'Category' },
  { value: 'accountName', label: 'Account Name' },
  { value: 'type', label: 'Transaction Type (Income/Expense)' },
  { value: 'balance', label: 'Balance' },
  { value: 'checkNumber', label: 'Check Number' },
];

export default function MnyMappingModal({ isOpen, onClose, rawData, onMappingComplete }: MnyMappingModalProps): React.JSX.Element | null {
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [preview, setPreview] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (rawData && rawData.length > 0) {
      // Take first 10 records for preview
      setPreview(rawData.slice(0, 10));
    }
  }, [rawData]);

  const handleFieldChange = (columnIndex: number, fieldType: string) => {
    setMapping(prev => ({
      ...prev,
      [columnIndex]: fieldType
    }));
    setError('');
  };

  const validateMapping = (): FieldMapping | null => {
    const fieldMapping: Partial<FieldMapping> = {};
    let hasDate = false;
    let hasAmount = false;
    let hasDescription = false;

    Object.entries(mapping).forEach(([colIndex, fieldType]) => {
      const index = parseInt(colIndex);
      
      switch (fieldType) {
        case 'date':
          fieldMapping.date = index;
          hasDate = true;
          break;
        case 'amount':
          fieldMapping.amount = index;
          hasAmount = true;
          break;
        case 'description':
          fieldMapping.description = index;
          hasDescription = true;
          break;
        case 'payee':
          fieldMapping.payee = index;
          break;
        case 'category':
          fieldMapping.category = index;
          break;
        case 'accountName':
          fieldMapping.accountName = index;
          break;
        case 'type':
          fieldMapping.type = index;
          break;
      }
    });

    if (!hasDate || !hasAmount || !hasDescription) {
      setError('Please map at least Date, Amount, and Description fields');
      return null;
    }

    return fieldMapping as Required<Pick<FieldMapping, 'date' | 'amount' | 'description'>> & Partial<Omit<FieldMapping, 'date' | 'amount' | 'description'>>;
  };

  const handleSaveMapping = () => {
    const validatedMapping = validateMapping();
    if (validatedMapping) {
      onMappingComplete(validatedMapping, rawData);
    }
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    
    // If it's a date object
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    
    // If it's a number
    if (typeof value === 'number') {
      // Check if it might be an OLE date
      if (value > 30000 && value < 60000) {
        const date = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
          return `${value} (${date.toLocaleDateString()})`;
        }
      }
      return value.toFixed(2);
    }
    
    // Convert to string and limit length
    const str = String(value);
    return str.length > 50 ? str.substring(0, 50) + '...' : str;
  };

  if (!isOpen) return null;

  const columns = preview.length > 0 ? Object.keys(preview[0]) : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Map Your Data Fields</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <XIcon size={24} />
          </button>
        </div>

        <div className="mb-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircleIcon className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-semibold mb-1">Help us understand your data</p>
                <p>We've extracted data from your Money file. Please tell us what each column represents by selecting from the dropdown menus.</p>
                <p className="mt-2">Required fields: <span className="font-semibold">Date, Amount, and Description</span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-300 dark:border-gray-600 p-2 bg-gray-100 dark:bg-gray-700">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Column {columns.map((_, i) => i + 1).join(', ')}</div>
                </th>
                {columns.map((_, colIndex) => (
                  <th key={colIndex} className="border border-gray-300 dark:border-gray-600 p-2 bg-gray-100 dark:bg-gray-700">
                    <select
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      value={mapping[colIndex] || 'ignore'}
                      onChange={(e) => handleFieldChange(colIndex, e.target.value)}
                    >
                      {FIELD_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}>
                  <td className="border border-gray-300 dark:border-gray-600 p-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Row {rowIndex + 1}
                  </td>
                  {columns.map((col, colIndex) => (
                    <td key={colIndex} className="border border-gray-300 dark:border-gray-600 p-2 text-sm text-gray-900 dark:text-white">
                      {formatCellValue(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing first 10 records of {rawData.length} total records
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg flex items-center gap-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300">
            <AlertCircleIcon size={20} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveMapping}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary flex items-center justify-center gap-2"
          >
            <CheckCircleIcon size={20} />
            Continue with Import
          </button>
        </div>
      </div>
    </div>
  );
}
