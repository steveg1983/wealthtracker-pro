import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import CategoryCreationModal from '../../components/CategoryCreationModal';
import { Tag, Plus, Edit2, X, Check, ChevronRight, ChevronDown, Trash2, AlertCircle } from 'lucide-react';

export default function CategoriesSettings() {
  const { 
    transactions, 
    categories,
    updateCategory,
    deleteCategory,
    getSubCategories,
    getDetailCategories,
    getCategoryPath 
  } = useApp();

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [reassignCategoryId, setReassignCategoryId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategoryExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Categories</h1>
        <button
          onClick={() => setShowCategoryModal(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary flex items-center gap-2"
        >
          <Plus size={16} />
          Add Category
        </button>
      </div>

      {/* Categories Tree */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="space-y-4">
          {/* Income Categories */}
          <div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Income Categories</h3>
            <div className="space-y-1">
              {getSubCategories('type-income').map(subCategory => {
                const isExpanded = expandedCategories.has(subCategory.id);
                const detailCategories = getDetailCategories(subCategory.id);
                const subTransactionCount = transactions.filter(t => {
                  const cat = categories.find(c => c.id === t.category);
                  return cat && (cat.id === subCategory.id || cat.parentId === subCategory.id);
                }).length;

                return (
                  <div key={subCategory.id}>
                    {/* Sub-category */}
                    <div className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          onClick={() => toggleCategoryExpanded(subCategory.id)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {detailCategories.length > 0 && (
                            isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                          )}
                          {detailCategories.length === 0 && <span className="w-4" />}
                        </button>
                        <span className="font-medium text-gray-900 dark:text-white">{subCategory.name}</span>
                        {subCategory.isSystem && (
                          <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                            System
                          </span>
                        )}
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({subTransactionCount} transactions)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!subCategory.isSystem && (
                          <>
                            <button
                              onClick={() => {
                                setEditingCategoryId(subCategory.id);
                                setEditingCategoryName(subCategory.name);
                              }}
                              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => {
                                if (detailCategories.length > 0) {
                                  alert('Cannot delete category with subcategories. Delete subcategories first.');
                                } else if (subTransactionCount > 0) {
                                  setDeletingCategoryId(subCategory.id);
                                  setReassignCategoryId('');
                                } else {
                                  deleteCategory(subCategory.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Detail categories */}
                    {isExpanded && detailCategories.length > 0 && (
                      <div className="ml-8 space-y-1">
                        {detailCategories.map(detailCategory => {
                          const detailTransactionCount = transactions.filter(t => t.category === detailCategory.id).length;
                          const isEditingDetail = editingCategoryId === detailCategory.id;

                          return (
                            <div
                              key={detailCategory.id}
                              className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                {isEditingDetail ? (
                                  <input
                                    type="text"
                                    value={editingCategoryName}
                                    onChange={(e) => setEditingCategoryName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        updateCategory(detailCategory.id, { name: editingCategoryName });
                                        setEditingCategoryId(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingCategoryId(null);
                                      }
                                    }}
                                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                                    autoFocus
                                  />
                                ) : (
                                  <>
                                    <span className="text-gray-700 dark:text-gray-300">{detailCategory.name}</span>
                                    {detailCategory.isSystem && (
                                      <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                                        System
                                      </span>
                                    )}
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      ({detailTransactionCount} transactions)
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {isEditingDetail ? (
                                  <>
                                    <button
                                      onClick={() => {
                                        updateCategory(detailCategory.id, { name: editingCategoryName });
                                        setEditingCategoryId(null);
                                      }}
                                      className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button
                                      onClick={() => setEditingCategoryId(null)}
                                      className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                                    >
                                      <X size={16} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {!detailCategory.isSystem && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setEditingCategoryId(detailCategory.id);
                                            setEditingCategoryName(detailCategory.name);
                                          }}
                                          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                                        >
                                          <Edit2 size={16} />
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (detailTransactionCount > 0) {
                                              setDeletingCategoryId(detailCategory.id);
                                              setReassignCategoryId('');
                                            } else {
                                              deleteCategory(detailCategory.id);
                                            }
                                          }}
                                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expense Categories */}
          <div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Expense Categories</h3>
            <div className="space-y-1">
              {getSubCategories('type-expense').map(subCategory => {
                const isExpanded = expandedCategories.has(subCategory.id);
                const detailCategories = getDetailCategories(subCategory.id);
                const subTransactionCount = transactions.filter(t => {
                  const cat = categories.find(c => c.id === t.category);
                  return cat && (cat.id === subCategory.id || cat.parentId === subCategory.id);
                }).length;

                return (
                  <div key={subCategory.id}>
                    {/* Sub-category */}
                    <div className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          onClick={() => toggleCategoryExpanded(subCategory.id)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {detailCategories.length > 0 && (
                            isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                          )}
                          {detailCategories.length === 0 && <span className="w-4" />}
                        </button>
                        <span className="font-medium text-gray-900 dark:text-white">{subCategory.name}</span>
                        {subCategory.isSystem && (
                          <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                            System
                          </span>
                        )}
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({subTransactionCount} transactions)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!subCategory.isSystem && (
                          <>
                            <button
                              onClick={() => {
                                setEditingCategoryId(subCategory.id);
                                setEditingCategoryName(subCategory.name);
                              }}
                              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => {
                                if (detailCategories.length > 0) {
                                  alert('Cannot delete category with subcategories. Delete subcategories first.');
                                } else if (subTransactionCount > 0) {
                                  setDeletingCategoryId(subCategory.id);
                                  setReassignCategoryId('');
                                } else {
                                  deleteCategory(subCategory.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Detail categories */}
                    {isExpanded && detailCategories.length > 0 && (
                      <div className="ml-8 space-y-1">
                        {detailCategories.map(detailCategory => {
                          const detailTransactionCount = transactions.filter(t => t.category === detailCategory.id).length;
                          const isEditingDetail = editingCategoryId === detailCategory.id;

                          return (
                            <div
                              key={detailCategory.id}
                              className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                {isEditingDetail ? (
                                  <input
                                    type="text"
                                    value={editingCategoryName}
                                    onChange={(e) => setEditingCategoryName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        updateCategory(detailCategory.id, { name: editingCategoryName });
                                        setEditingCategoryId(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingCategoryId(null);
                                      }
                                    }}
                                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                                    autoFocus
                                  />
                                ) : (
                                  <>
                                    <span className="text-gray-700 dark:text-gray-300">{detailCategory.name}</span>
                                    {detailCategory.isSystem && (
                                      <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                                        System
                                      </span>
                                    )}
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      ({detailTransactionCount} transactions)
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {isEditingDetail ? (
                                  <>
                                    <button
                                      onClick={() => {
                                        updateCategory(detailCategory.id, { name: editingCategoryName });
                                        setEditingCategoryId(null);
                                      }}
                                      className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button
                                      onClick={() => setEditingCategoryId(null)}
                                      className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                                    >
                                      <X size={16} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {!detailCategory.isSystem && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setEditingCategoryId(detailCategory.id);
                                            setEditingCategoryName(detailCategory.name);
                                          }}
                                          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                                        >
                                          <Edit2 size={16} />
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (detailTransactionCount > 0) {
                                              setDeletingCategoryId(detailCategory.id);
                                              setReassignCategoryId('');
                                            } else {
                                              deleteCategory(detailCategory.id);
                                            }
                                          }}
                                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transfer/Other Categories */}
          <div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Transfer/Other Categories</h3>
            <div className="space-y-1">
              {categories.filter(cat => cat.type === 'both' && cat.level === 'detail').map(category => {
                const transactionCount = transactions.filter(t => t.category === category.id).length;
                const isEditing = editingCategoryId === category.id;

                return (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="w-4" />
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateCategory(category.id, { name: editingCategoryName });
                              setEditingCategoryId(null);
                            } else if (e.key === 'Escape') {
                              setEditingCategoryId(null);
                            }
                          }}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                          autoFocus
                        />
                      ) : (
                        <>
                          <span className="text-gray-900 dark:text-white">{category.name}</span>
                          {category.isSystem && (
                            <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                              System
                            </span>
                          )}
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({transactionCount} transactions)
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => {
                              updateCategory(category.id, { name: editingCategoryName });
                              setEditingCategoryId(null);
                            }}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => setEditingCategoryId(null)}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          {!category.isSystem && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingCategoryId(category.id);
                                  setEditingCategoryName(category.name);
                                }}
                                className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  if (transactionCount > 0) {
                                    setDeletingCategoryId(category.id);
                                    setReassignCategoryId('');
                                  } else {
                                    deleteCategory(category.id);
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Category Delete Confirmation Dialog */}
      {deletingCategoryId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-orange-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Category</h3>
            </div>
            {(() => {
              const category = categories.find(c => c.id === deletingCategoryId);
              const transactionCount = transactions.filter(t => t.category === deletingCategoryId).length;

              return (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    The category "{category?.name}" has {transactionCount} transaction{transactionCount !== 1 ? 's' : ''} associated with it.
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Please select a category to reassign these transactions to:
                  </p>
                  <select
                    value={reassignCategoryId}
                    onChange={(e) => setReassignCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white mb-6"
                  >
                    <option value="">Select a category...</option>
                    {categories
                      .filter(c => 
                        c.id !== deletingCategoryId && 
                        c.level === 'detail' && 
                        (category?.type === 'both' || c.type === 'both' || c.type === category?.type)
                      )
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {getCategoryPath(c.id)}
                        </option>
                      ))
                    }
                  </select>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setDeletingCategoryId(null);
                        setReassignCategoryId('');
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (reassignCategoryId) {
                          deleteCategory(deletingCategoryId, reassignCategoryId);
                          setDeletingCategoryId(null);
                          setReassignCategoryId('');
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                      disabled={!reassignCategoryId}
                    >
                      Delete & Reassign
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Category Creation Modal */}
      <CategoryCreationModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
      />
    </div>
  );
}