import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { 
  XMarkIcon,
  MagnifyingGlassIcon,
  PlusIcon 
} from '@heroicons/react/24/outline';
import { WidgetRegistry } from '../widgets/WidgetRegistry';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (widgetType: string) => void;
  existingWidgets: unknown[];
}

export default function AddWidgetModal({
  isOpen,
  onClose,
  onAdd,
  existingWidgets
}: AddWidgetModalProps): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Get available widgets
  const allWidgets = WidgetRegistry.getAllWidgets();
  const categories = ['all', ...WidgetRegistry.getCategories()];
  
  // Filter widgets
  const filteredWidgets = allWidgets.filter(widget => {
    // Filter by search term
    const matchesSearch = searchTerm === '' || 
      widget.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      widget.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by category
    const matchesCategory = selectedCategory === 'all' || widget.category === selectedCategory;
    
    // Check if already added (allow multiple instances of some widgets)
    const allowMultiple = ['recent-transactions', 'expense-breakdown'];
    const isAlreadyAdded = !allowMultiple.includes(widget.type) && 
      existingWidgets.some(w => w.type === widget.type);
    
    return matchesSearch && matchesCategory && !isAlreadyAdded;
  });
  
  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      all: 'All Widgets',
      overview: 'Overview',
      budget: 'Budget & Expenses',
      investment: 'Investments',
      analytics: 'Analytics',
      planning: 'Planning',
      system: 'System'
    };
    return labels[category] || category;
  };
  
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      overview: 'bg-blue-100 text-blue-800 dark:bg-gray-900 dark:text-blue-200',
      budget: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      investment: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      analytics: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      planning: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      system: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };
  
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                  >
                    Add Widget to Dashboard
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Search and Filter Bar */}
                <div className="mb-6 space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search widgets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  {/* Category Filter */}
                  <div className="flex flex-wrap gap-2">
                    {categories.map(category => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          selectedCategory === category
                            ? 'bg-gray-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {getCategoryLabel(category)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Widget Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {filteredWidgets.length === 0 ? (
                    <div className="col-span-full text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400">
                        {searchTerm || selectedCategory !== 'all' 
                          ? 'No widgets found matching your criteria'
                          : 'All available widgets have been added'}
                      </p>
                    </div>
                  ) : (
                    filteredWidgets.map(widget => (
                      <div
                        key={widget.type}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer group"
                        onClick={() => onAdd(widget.type)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            <span className="text-2xl mr-2">{widget.icon}</span>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {widget.title}
                            </h4>
                          </div>
                          <PlusIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-500" />
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {widget.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(widget.category)}`}>
                            {getCategoryLabel(widget.category)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {widget.defaultSize}
                          </span>
                        </div>
                        
                        {widget.requiresAuth && (
                          <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                            Requires authentication
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}