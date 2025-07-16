import { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { HashIcon, AlertCircleIcon } from '../../components/icons';
import { PlusIcon, EditIcon, DeleteIcon, XIcon, CheckIcon } from '../../components/icons';
import { IconButton } from '../../components/icons/IconButton';
import type { Tag } from '../../contexts/AppContext';
import PageWrapper from '../../components/PageWrapper';

interface TagFormData {
  name: string;
  color: string;
  description: string;
}

export default function Tags() {
  const { tags, addTag, updateTag, deleteTag, getTagUsageCount, getAllUsedTags } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [formData, setFormData] = useState<TagFormData>({
    name: '',
    color: '#3B82F6',
    description: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get all tags used in transactions that aren't in the centralized list
  const usedTags = getAllUsedTags();
  const unregisteredTags = usedTags.filter(tagName => 
    !tags.some(tag => tag.name === tagName)
  );

  // Auto-create tags from transactions on component mount
  useEffect(() => {
    unregisteredTags.forEach(tagName => {
      addTag({
        name: tagName,
        color: '#6B7280',
        description: 'Auto-created from transaction'
      });
    });
  }, [addTag, unregisteredTags]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    setErrors({});
    
    // Validate form
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Tag name is required';
    } else if (tags.some(tag => tag.name.toLowerCase() === formData.name.toLowerCase() && tag.id !== editingTag)) {
      newErrors.name = 'Tag name already exists';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    if (editingTag) {
      // Update existing tag
      updateTag(editingTag, {
        name: formData.name.trim(),
        color: formData.color,
        description: formData.description.trim()
      });
    } else {
      // Add new tag
      addTag({
        name: formData.name.trim(),
        color: formData.color,
        description: formData.description.trim()
      });
    }
    
    // Reset form
    setFormData({
      name: '',
      color: '#3B82F6',
      description: ''
    });
    setShowAddForm(false);
    setEditingTag(null);
  };

  const handleEdit = (tag: Tag) => {
    setFormData({
      name: tag.name,
      color: tag.color || '#3B82F6',
      description: tag.description || ''
    });
    setEditingTag(tag.id);
    setShowAddForm(true);
  };

  const handleDelete = (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;
    
    const usageCount = getTagUsageCount(tag.name);
    if (usageCount > 0) {
      if (!window.confirm(`This tag is used in ${usageCount} transaction(s). Are you sure you want to delete it?`)) {
        return;
      }
    }
    
    deleteTag(tagId);
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      color: '#3B82F6',
      description: ''
    });
    setShowAddForm(false);
    setEditingTag(null);
    setErrors({});
  };

  const predefinedColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6B7280'
  ];

  return (
    <PageWrapper 
      title="Tags"
      rightContent={
        <IconButton
          onClick={() => setShowAddForm(true)}
          icon={<PlusIcon size={16} />}
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-700"
          title="Add Tag"
        />
      }
    >

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 mb-6">
          <h2 className="text-xl font-semibold text-blue-800 dark:text-white mb-4">
            {editingTag ? 'Edit Tag' : 'Add New Tag'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tag Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white ${
                  errors.name ? 'border-red-500/50' : 'border-gray-300/50 dark:border-gray-600/50'
                }`}
                placeholder="Enter tag name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-10 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                />
                <div className="flex gap-1">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-lg border-2 ${
                        formData.color === color ? 'border-gray-900 dark:border-white' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                rows={3}
                placeholder="Enter tag description"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors"
              >
                <CheckIcon size={16} color="white" />
                {editingTag ? 'Update Tag' : 'Add Tag'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-2xl hover:bg-gray-600 transition-colors"
              >
                <XIcon size={16} color="white" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tags List */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-blue-800 dark:text-white">
            All Tags ({tags.length})
          </h2>
        </div>

        {tags.length === 0 ? (
          <div className="p-8 text-center">
            <HashIcon className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No tags yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create your first tag to start organizing your transactions
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {tags.map((tag) => {
              const usageCount = getTagUsageCount(tag.name);
              return (
                <div key={tag.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {tag.name}
                        </h3>
                        {tag.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {tag.description}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {usageCount} transaction{usageCount !== 1 ? 's' : ''}
                      </div>
                      <div className="flex items-center gap-2">
                        <IconButton
                          onClick={() => handleEdit(tag)}
                          icon={<EditIcon size={16} />}
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-gray-700"
                        />
                        <IconButton
                          onClick={() => handleDelete(tag.id)}
                          icon={<DeleteIcon size={16} />}
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-gray-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Usage Statistics */}
      {tags.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircleIcon size={20} />
            Tag Usage Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {tags.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Tags
              </div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {tags.filter(tag => getTagUsageCount(tag.name) > 0).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Used Tags
              </div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {tags.filter(tag => getTagUsageCount(tag.name) === 0).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Unused Tags
              </div>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}