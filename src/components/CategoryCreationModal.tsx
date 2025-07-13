import { useState, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Plus } from 'lucide-react';

interface CategoryCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated?: (categoryId: string) => void;
  initialType?: 'income' | 'expense';
}

export default function CategoryCreationModal({ 
  isOpen, 
  onClose, 
  onCategoryCreated,
  initialType = 'expense' 
}: CategoryCreationModalProps) {
  const { categories, addCategory, getSubCategories, getDetailCategories } = useApp();
  
  const [type, setType] = useState<'income' | 'expense'>(initialType);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedSpecific, setSelectedSpecific] = useState<string>('');
  const [showNewSpecific, setShowNewSpecific] = useState(false);
  const [newSpecificName, setNewSpecificName] = useState('');

  // Predefined category suggestions
  const suggestedCategories = {
    expense: ['Bills', 'Food', 'Household', 'Personal', 'Transportation', 'Entertainment', 'Healthcare', 'Shopping'],
    income: ['Employment', 'Investments', 'Business', 'Other Income']
  };

  // Get available categories based on type
  const availableCategories = getSubCategories(`type-${type}`);
  const existingCategoryNames = availableCategories.map(cat => cat.name);
  
  // Filter suggestions to only show ones that don't exist yet
  const filteredSuggestions = suggestedCategories[type].filter(
    name => !existingCategoryNames.includes(name)
  );

  const handleSubmit = () => {
    let resultCategoryId = selectedCategory || selectedSpecific;
    
    // Create new category if needed
    if (showNewCategory && newCategoryName.trim()) {
      const newCategory = {
        name: newCategoryName.trim(),
        type,
        level: 'sub' as const,
        parentId: `type-${type}`,
        isSystem: false
      };
      
      addCategory(newCategory);
      
      // For new categories, we'll use a generated ID - the AppContext will handle the actual ID
      resultCategoryId = `new-sub-${newCategoryName.trim()}`;
    }

    // Create new specific category if needed
    if ((selectedCategory || resultCategoryId) && showNewSpecific && newSpecificName.trim()) {
      const parentId = selectedCategory || resultCategoryId;
      
      const newSpecific = {
        name: newSpecificName.trim(),
        type,
        level: 'detail' as const,
        parentId: parentId.startsWith('new-sub-') ? `type-${type}` : parentId, // Use type if parent is new
        isSystem: false
      };
      
      addCategory(newSpecific);
      resultCategoryId = `new-detail-${newSpecificName.trim()}`;
    }

    // Notify parent component
    if (onCategoryCreated && resultCategoryId) {
      // Use a timeout to allow state to update
      setTimeout(() => {
        if (resultCategoryId.startsWith('new-')) {
          // Find the actual created category
          const categoryName = resultCategoryId.includes('detail') ? 
            newSpecificName.trim() : newCategoryName.trim();
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
    setSelectedCategory('');
    setShowNewCategory(false);
    setNewCategoryName('');
    setSelectedSpecific('');
    setShowNewSpecific(false);
    setNewSpecificName('');
    
    onClose();
  };

  const handleCategoryChange = (value: string) => {
    if (value === 'new') {
      setShowNewCategory(true);
      setSelectedCategory('');
    } else if (value.startsWith('suggest-')) {
      // Handle suggested categories
      const categoryName = value.replace('suggest-', '');
      setShowNewCategory(true);
      setNewCategoryName(categoryName);
      setSelectedCategory('');
    } else {
      setShowNewCategory(false);
      setSelectedCategory(value);
      setNewCategoryName('');
    }
    // Reset specific category selection
    setSelectedSpecific('');
    setShowNewSpecific(false);
    setNewSpecificName('');
  };

  const handleSpecificChange = (value: string) => {
    if (value === 'new') {
      setShowNewSpecific(true);
      setSelectedSpecific('');
    } else {
      setShowNewSpecific(false);
      setSelectedSpecific(value);
      setNewSpecificName('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Create New Category</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setType('income');
                  setSelectedCategory('');
                  setShowNewCategory(false);
                  setNewCategoryName('');
                  setSelectedSpecific('');
                  setShowNewSpecific(false);
                  setNewSpecificName('');
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  type === 'income'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Income
              </button>
              <button
                onClick={() => {
                  setType('expense');
                  setSelectedCategory('');
                  setShowNewCategory(false);
                  setNewCategoryName('');
                  setSelectedSpecific('');
                  setShowNewSpecific(false);
                  setNewSpecificName('');
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  type === 'expense'
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
              value={showNewCategory ? 'new' : selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
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
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter new category name"
                className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                autoFocus
              />
            )}
          </div>

          {/* Specific Category Selection */}
          {(selectedCategory || (showNewCategory && newCategoryName)) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Specific Category
              </label>
              {selectedCategory && !showNewCategory ? (
                <select
                  value={showNewSpecific ? 'new' : selectedSpecific}
                  onChange={(e) => handleSpecificChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select specific category (optional)</option>
                  
                  {getDetailCategories(selectedCategory).map(cat => (
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
              {showNewSpecific && selectedCategory && (
                <input
                  type="text"
                  value={newSpecificName}
                  onChange={(e) => setNewSpecificName(e.target.value)}
                  placeholder="Enter new specific category name"
                  className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                  autoFocus
                />
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!((selectedCategory || (showNewCategory && newCategoryName.trim())) || 
                        (selectedSpecific || (showNewSpecific && newSpecificName.trim())))}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Create Category
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}