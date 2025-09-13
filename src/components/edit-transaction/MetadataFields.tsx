import React, { useEffect, memo } from 'react';
import { HashIcon, FileTextIcon, PaperclipIcon } from '../icons';
import TagSelector from '../TagSelector';
import MarkdownEditor from '../MarkdownEditor';
import DocumentManager from '../DocumentManager';
import { logger } from '../../services/loggingService';

interface MetadataFieldsProps {
  tags: string[];
  notes: string;
  transactionId?: string;
  onTagsChange: (tags: string[]) => void;
  onNotesChange: (notes: string) => void;
}

export const MetadataFields = memo(function MetadataFields({
  tags,
  notes,
  transactionId,
  onTagsChange,
  onNotesChange
}: MetadataFieldsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('MetadataFields component initialized', {
      componentName: 'MetadataFields'
    });
  }, []);

  return (
    <>
      <div className="md:col-span-12">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          <HashIcon size={16} />
          Tags
        </label>
        <TagSelector
          selectedTags={tags}
          onTagsChange={onTagsChange}
          placeholder="Search or create tags..."
          allowNewTags={true}
        />
      </div>

      <div className="md:col-span-12">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          <FileTextIcon size={16} />
          Notes
        </label>
        <MarkdownEditor
          value={notes}
          onChange={onNotesChange}
          placeholder="Add notes... You can use **bold**, *italic*, [links](url), `code`, lists, etc."
          maxHeight="200px"
          className="w-full"
        />
      </div>
      
      {transactionId && (
        <div className="md:col-span-12">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <PaperclipIcon size={16} />
            Attachments
          </label>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <DocumentManager
              transactionId={transactionId}
              compact
            />
          </div>
        </div>
      )}
    </>
  );
});