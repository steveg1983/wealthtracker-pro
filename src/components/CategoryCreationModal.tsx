import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { PlusIcon } from './icons/PlusIcon';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useModalForm } from '../hooks/useModalForm';

interface CategoryCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated?: (categoryId: string) => void;
  initialType?: 'income' | 'expense';
}

interface FormData {
  type: 'income' | 'expense';
  selectedCategory: string;
  newCategoryName: string;
  selectedSpecific: string;
  newSpecificName: string;
}

export default function CategoryCreationModal({ 
  isOpen, 
  onClose, 
  onCategoryCreated,
  initialType = 'expense' 
}: CategoryCreationModalProps) {
  const { categories, addCategory, getSubCategories, getDetailCategories } = useApp();
  
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewSpecific, setShowNewSpecific] = useState(false);
  
  const { formData, updateField, reset } = useModalForm<FormData>(
    {
      type: initialType,
      selectedCategory: '',
      newCategoryName: '',
      selectedSpecific: '',
      newSpecificName: ''
    },
    {
      onSubmit: () => {},
      onClose
    }
  );

  // Predefined category suggestions
  const suggestedCategories = {
    expense: ['Bills', 'Food', 'Household', 'Personal', 'Transportation', 'Entertainment', 'Healthcare', 'Shopping'],
    income: ['Employment', 'Investments', 'Business', 'Other Income']
  };

  // Get available categories based on type
  const availableCategories = getSubCategories(`type-${formData.type}`);
  const existingCategoryNames = availableCategories.map(cat => cat.name);
  
  // Filter suggestions to only show ones that don't exist yet
  const filteredSuggestions = suggestedCategories[formData.type].filter(
    name => !existingCategoryNames.includes(name)
  );

  const handleSubmit = () => {
    let resultCategoryId = formData.selectedCategory || formData.selectedSpecific;
    
    // Create new category if needed
    if (showNewCategory && formData.newCategoryName.trim()) {
      const newCategory = {
        name: formData.newCategoryName.trim(),
        type: formData.type,
        level: 'sub' as const,
        parentId: `type-${formData.type}`,
        isSystem: false
      };
      
      addCategory(newCategory);
      
      // For new categories, we'll use a generated ID - the AppContext will handle the actual ID
      resultCategoryId = `new-sub-${formData.newCategoryName.trim()}`;
    }

    // Create new specific category if needed
    if ((formData.selectedCategory || resultCategoryId) && showNewSpecific && formData.newSpecificName.trim()) {
      const parentId = formData.selectedCategory || resultCategoryId;
      
      const newSpecific = {
        name: formData.newSpecificName.trim(),
        type: formData.type,
        level: 'detail' as const,
        parentId: parentId.startsWith('new-sub-') ? `type-${formData.type}` : parentId, // Use type if parent is new
        isSystem: false
      };
      
      addCategory(newSpecific);
      resultCategoryId = `new-detail-${formData.newSpecificName.trim()}`;
    }

    // Notify parent component
    if (onCategoryCreated && resultCategoryId) {
      // Use a timeout to allow state to update
      setTimeout(() => {
        if (resultCategoryId.startsWith('new-')) {
          // Find the actual created category
          const categoryName = resultCategoryId.includes('detail') ? 
            formData.newSpecificName.trim() : formData.newCategoryName.trim();
          const level = resultCategoryId.includes('detail') ? 'detail' : 'sub';
          
          const foundCategory = categories.find(c => 
            c.name === categoryName && c.level === level
          );
          
          if (foundCategory && onCategoryCreated) {
            onCategoryCreated(foundCategory.id);
          }
        } else if (onCategoryCreated) {
          onCategoryCreated(resultCategoryId);
        }
      }, 150);
    }

    // Reset form
    reset();
    setShowNewCategory(false);
    setShowNewSpecific(false);
    
    onClose();
  };

  const handleCategoryChange = (value: string) => {
    if (value === 'new') {
      setShowNewCategory(true);
      updateField('selectedCategory', '');
    } else if (value.startsWith('suggest-')) {
      // Handle suggested categories
      const categoryName = value.replace('suggest-', '');
      setShowNewCategory(true);
      updateField('newCategoryName', categoryName);
      updateField('selectedCategory', '');
    } else {
      setShowNewCategory(false);
      updateField('selectedCategory', value);
      updateField('newCategoryName', '');
    }
    // Reset specific category selection
    updateField('selectedSpecific', '');
    setShowNewSpecific(false);
    updateField('newSpecificName', '');
  };

  const handleSpecificChange = (value: string) => {
    if (value === 'new') {
      setShowNewSpecific(true);
      updateField('selectedSpecific', '');
    } else {
      setShowNewSpecific(false);
      updateField('selectedSpecific', value);
      updateField('newSpecificName', '');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Category" size="md">
      <ModalBody className="space-y-4">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  updateField('type', 'income');
                  updateField('selectedCategory', '');
                  setShowNewCategory(false);
                  updateField('newCategoryName', '');
                  updateField('selectedSpecific', '');
                  setShowNewSpecific(false);
                  updateField('newSpecificName', '');
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  formData.type === 'income'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Income
              </button>
              <button
                onClick={() => {
                  updateField('type', 'expense');
                  updateField('selectedCategory', '');
                  setShowNewCategory(false);
                  updateField('newCategoryName', '');
                  updateField('selectedSpecific', '');
                  setShowNewSpecific(false);
                  updateField('newSpecificName', '');
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  formData.type === 'expense'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Expense
              </button>
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={showNewCategory ? 'new' : formData.selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            >
              <option value="">Select a category</option>
              
              {/* Existing categories */}
              {availableCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
              
              {/* Suggested categories that don't exist yet */}
              {filteredSuggestions.length > 0 && (
                <optgroup label="Suggestions">
                  {filteredSuggestions.map(suggestion => (
                    <option key={suggestion} value={`suggest-${suggestion}`}>
                      {suggestion} (create new)
                    </option>
                  ))}
                </optgroup>
              )}
              
              <option value="new">+ New Category</option>
            </select>

            {/* New Category Input */}
            {showNewCategory && (
              <input
                type="text"
                value={formData.newCategoryName}
                onChange={(e) => updateField('newCategoryName', e.target.value)}
                placeholder="Enter new category name"
                className="mt-2 w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                autoFocus
              />
            )}
          </div>

          {/* Specific Category Selection */}
          {(formData.selectedCategory || (showNewCategory && formData.newCategoryName)) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Specific Category
              </label>
              {formData.selectedCategory && !showNewCategory ? (
                <select
                  value={showNewSpecific ? 'new' : formData.selectedSpecific}
                  onChange={(e) => handleSpecificChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                >
                  <option value="">Select specific category (optional)</option>
                  
                  {getDetailCategories(formData.selectedCategory).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                  
                  <option value="new">+ New Specific Category</option>
                </select>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  Save the category first to add specific categories
                </p>
              )}

              {/* New Specific Category Input */}
              {showNewSpecific && formData.selectedCategory && (
                <input
                  type="text"
                  value={formData.newSpecificName}
                  onChange={(e) => updateField('newSpecificName', e.target.value)}
                  placeholder="Enter new specific category name"
                  className="mt-2 w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                  autoFocus
                />
              )}
            </div>
          )}

      </ModalBody>
      <ModalFooter>
        <div className="flex gap-2 w-full">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!((formData.selectedCategory || (showNewCategory && formData.newCategoryName.trim())) || 
                      (formData.selectedSpecific || (showNewSpecific && formData.newSpecificName.trim())))}
            className="flex-1 px-4 py-2 text-sm sm:text-base bg-primary text-white rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <PlusIcon size={16} />
            Create Category
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
}