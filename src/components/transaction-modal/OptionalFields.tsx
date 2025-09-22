import { memo, useEffect } from 'react';
import TagSelector from '../TagSelector';
import { RadioCheckbox } from '../common/RadioCheckbox';
import type { TransactionFormData } from '../../services/transactionFormService';
import { useLogger } from '../services/ServiceProvider';

interface OptionalFieldsProps {
  formData: TransactionFormData;
  onFieldChange: (field: keyof TransactionFormData, value: string | string[] | boolean) => void;
}

/**
 * Optional transaction fields component
 */
export const OptionalFields = memo(function OptionalFields({ formData,
  onFieldChange
 }: OptionalFieldsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('OptionalFields component initialized', {
      componentName: 'OptionalFields'
    });
  }, []);

  return (
    <>
      {/* Notes Field */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notes <span className="text-sm text-gray-500">(Optional)</span>
        </label>
        <textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => onFieldChange('notes', e.target.value)}
          rows={2}
          aria-describedby="notes-hint"
          className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
          placeholder="Add any additional details..."
        />
        <p id="notes-hint" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          You can add any additional information about this transaction
        </p>
      </div>

      {/* Tags Field */}
      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tags <span className="text-sm text-gray-500">(Optional)</span>
        </label>
        <div id="tags" aria-describedby="tags-hint">
          <TagSelector
            selectedTags={formData.tags}
            onTagsChange={(tags) => onFieldChange('tags', tags)}
            placeholder="Search or create tags..."
            allowNewTags={true}
          />
        </div>
        <p id="tags-hint" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Add tags to help organize and search your transactions
        </p>
      </div>

      {/* Cleared Checkbox */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <RadioCheckbox
            checked={formData.cleared}
            onChange={(checked) => onFieldChange('cleared', checked)}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Transaction cleared/reconciled
          </span>
        </label>
        <p id="cleared-hint" className="text-xs text-gray-500 dark:text-gray-400 ml-6">
          Check this if the transaction has been verified against your bank statement
        </p>
      </div>
    </>
  );
});