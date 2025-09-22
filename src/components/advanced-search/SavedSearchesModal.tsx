import React, { useEffect, memo } from 'react';
import { Modal } from '../common/Modal';
import { XIcon } from '../icons';
import { IconButton } from '../icons/IconButton';
import type { SavedSearch } from './types';
import { useLogger } from '../services/ServiceProvider';

interface SavedSearchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedSearches: SavedSearch[];
  onLoad: (search: SavedSearch) => void;
  onDelete: (searchId: string) => void;
}

export const SavedSearchesModal = memo(function SavedSearchesModal({ isOpen,
  onClose,
  savedSearches,
  onLoad,
  onDelete
 }: SavedSearchesModalProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SavedSearchesModal component initialized', {
      componentName: 'SavedSearchesModal'
    });
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Saved Searches"
    >
      <div className="p-6">
        {savedSearches.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No saved searches yet
          </p>
        ) : (
          <div className="space-y-3">
            {savedSearches.map(search => (
              <div key={search.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{search.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {search.filters.length} filters • {search.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onLoad(search)}
                    className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark"
                  >
                    Load
                  </button>
                  <IconButton
                    onClick={() => onDelete(search.id)}
                    icon={<XIcon size={16} />}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
});