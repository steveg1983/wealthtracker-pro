import { memo, useState, useEffect } from 'react';
import { XIcon } from '../../icons';
import { DashboardBuilderService, type WidgetCatalogItem } from '../../../services/dashboardBuilderService';
import { logger } from '../../../services/loggingService';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (widget: WidgetCatalogItem) => void;
}

/**
 * Modal for selecting and adding new widgets
 */
export const AddWidgetModal = memo(function AddWidgetModal({
  isOpen,
  onClose,
  onAddWidget
}: AddWidgetModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('AddWidgetModal component initialized', {
      componentName: 'AddWidgetModal'
    });
  }, []);

  const [selectedCategory, setSelectedCategory] = useState('All');
  
  if (!isOpen) return null;
  
  const categories = DashboardBuilderService.getCategories();
  const filteredWidgets = DashboardBuilderService.filterByCategory(selectedCategory);
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Add Widget</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XIcon size={20} />
            </button>
          </div>
          
          {/* Category Filter */}
          <div className="flex gap-2 mt-4">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-6 overflow-auto max-h-[60vh]">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredWidgets.map(widget => (
              <button
                key={widget.id}
                onClick={() => {
                  onAddWidget(widget);
                  onClose();
                }}
                className="p-4 bg-blue-50 dark:bg-gray-900 rounded-lg hover:bg-blue-100 dark:hover:bg-gray-800 transition-colors text-center group"
              >
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                  {widget.icon}
                </div>
                <h3 className="font-medium text-sm">{widget.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {widget.category}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});