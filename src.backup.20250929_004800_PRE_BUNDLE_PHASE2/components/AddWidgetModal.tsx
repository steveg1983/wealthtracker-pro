import React, { useState } from 'react';
import { 
  XIcon,
  PlusIcon,
  CheckIcon
} from './icons';

interface WidgetType {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  defaultSize: string;
  description?: string;
}

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (type: string) => void;
  availableWidgets: WidgetType[];
  existingWidgets: string[];
}

export default function AddWidgetModal({
  isOpen,
  onClose,
  onAdd,
  availableWidgets,
  existingWidgets
}: AddWidgetModalProps): React.JSX.Element | null {
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = (): void => {
    if (selectedWidget) {
      onAdd(selectedWidget);
      setSelectedWidget(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add Widget to Dashboard
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Widget Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {availableWidgets.map((widget) => {
              const Icon = widget.icon;
              const isSelected = selectedWidget === widget.id;
              const isAlreadyAdded = existingWidgets.includes(widget.id);
              
              return (
                <button
                  key={widget.id}
                  onClick={() => !isAlreadyAdded && setSelectedWidget(widget.id)}
                  disabled={isAlreadyAdded}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all text-left
                    ${isSelected 
                      ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                    ${isAlreadyAdded 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'cursor-pointer hover:shadow-md'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`
                      p-2 rounded-lg
                      ${isSelected 
                        ? 'bg-blue-100 dark:bg-blue-800' 
                        : 'bg-gray-100 dark:bg-gray-700'
                      }
                    `}>
                      <Icon size={24} className={isSelected ? 'text-gray-600' : 'text-gray-600 dark:text-gray-400'} />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {widget.title}
                      </h3>
                      {widget.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {widget.description}
                        </p>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-2 inline-block">
                        Size: {widget.defaultSize}
                      </span>
                    </div>
                    
                    {isAlreadyAdded && (
                      <div className="absolute top-2 right-2">
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                          Already added
                        </span>
                      </div>
                    )}
                    
                    {isSelected && !isAlreadyAdded && (
                      <div className="absolute top-2 right-2">
                        <CheckIcon size={20} className="text-gray-600" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedWidget 
                ? `Selected: ${availableWidgets.find(w => w.id === selectedWidget)?.title}`
                : 'Select a widget to add'
              }
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!selectedWidget}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <PlusIcon size={20} />
                Add Widget
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}