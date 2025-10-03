import React, { useEffect, memo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import { TagIcon, FileTextIcon } from '../icons';
import type { Document } from '../../services/documentService';
import { useLogger } from '../services/ServiceProvider';

interface DocumentEditorProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (document: Document, updates: Partial<Document>) => void;
}

export const DocumentEditor = memo(function DocumentEditor({ document,
  isOpen,
  onClose,
  onSave
 }: DocumentEditorProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('DocumentEditor component initialized', {
      componentName: 'DocumentEditor'
    });
  }, []);

  const [formData, setFormData] = useState<Partial<Document>>(
    document ? {
      fileName: document.fileName,
      type: document.type,
      notes: document.notes || '',
      tags: document.tags
    } : {}
  );
  const [newTag, setNewTag] = useState('');

  if (!document) return null;

  const handleAddTag = () => {
    if (newTag.trim() && formData.tags && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(t => t !== tag) || []
    });
  };

  const handleSave = () => {
    onSave(document, formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Document" size="md">
      <ModalBody>
        <div className="space-y-4">
          {/* File Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              File Name
            </label>
            <input
              type="text"
              value={formData.fileName || ''}
              onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
            />
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Type
            </label>
            <select
              value={formData.type || 'other'}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Document['type'] })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
            >
              <option value="receipt">Receipt</option>
              <option value="invoice">Invoice</option>
              <option value="statement">Statement</option>
              <option value="contract">Contract</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
              placeholder="Add any notes about this document..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                placeholder="Add a tag..."
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Add
              </button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm flex items-center gap-1"
                  >
                    <TagIcon size={14} />
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalBody>
      
      <ModalFooter>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Save Changes
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
      </ModalFooter>
    </Modal>
  );
});
