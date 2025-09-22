import { memo, useEffect } from 'react';
import type { PreviewData } from '../../services/fileImportService';
import { useLogger } from '../services/ServiceProvider';

interface PreviewTableProps {
  previewData: PreviewData;
  onUpdateMappings: (mappings: PreviewData['mappings']) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Preview table component
 * Shows CSV data preview and allows column mapping
 */
export const PreviewTable = memo(function PreviewTable({ previewData,
  onUpdateMappings,
  onConfirm,
  onCancel
 }: PreviewTableProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('PreviewTable component initialized', {
      componentName: 'PreviewTable'
    });
  }, []);

  const handleMappingChange = (column: keyof PreviewData['mappings'], index: number | undefined) => {
    onUpdateMappings({
      ...previewData.mappings,
      [column]: index
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Map CSV Columns
      </h3>
      
      {/* Column Mapping */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date Column
          </label>
          <select
            value={previewData.mappings.date ?? ''}
            onChange={(e) => handleMappingChange('date', e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="">-- Select --</option>
            {previewData.headers.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description Column
          </label>
          <select
            value={previewData.mappings.description ?? ''}
            onChange={(e) => handleMappingChange('description', e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="">-- Select --</option>
            {previewData.headers.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount Column
          </label>
          <select
            value={previewData.mappings.amount ?? ''}
            onChange={(e) => handleMappingChange('amount', e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="">-- Select --</option>
            {previewData.headers.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Category Column (Optional)
          </label>
          <select
            value={previewData.mappings.category ?? ''}
            onChange={(e) => handleMappingChange('category', e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="">-- None --</option>
            {previewData.headers.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Preview Table */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Preview (first 5 rows)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                {previewData.headers.map((header, index) => (
                  <th key={index} className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">
                    {header}
                    {getMappingLabel(index, previewData.mappings)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.rows.slice(0, 5).map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-gray-200 dark:border-gray-700">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Total rows: {previewData.rows.length}
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!previewData.mappings.date || !previewData.mappings.description || !previewData.mappings.amount}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Import {previewData.rows.length} Transactions
        </button>
      </div>
    </div>
  );
});

// Helper function to get mapping label
function getMappingLabel(index: number, mappings: PreviewData['mappings']): string {
  const labels: string[] = [];
  if (mappings.date === index) labels.push('Date');
  if (mappings.description === index) labels.push('Description');
  if (mappings.amount === index) labels.push('Amount');
  if (mappings.category === index) labels.push('Category');
  
  return labels.length > 0 ? ` (${labels.join(', ')})` : '';
}