import React, { useEffect, memo } from 'react';
import { LightbulbIcon, WrenchIcon, SearchIcon, EditIcon, LinkIcon, DatabaseIcon, DeleteIcon } from '../icons';
import type { ModalType } from '../../services/dataManagementService';
import { useLogger } from '../services/ServiceProvider';

interface AdvancedOptionsSectionProps {
  advancedOptions: Array<{
    id: string;
    label: string;
    icon: string;
    color: string;
    modalType: ModalType;
  }>;
  hasTestData: boolean;
  onOpenModal: (modalType: ModalType) => void;
}

const AdvancedOptionsSection = memo(function AdvancedOptionsSection({ advancedOptions,
  hasTestData,
  onOpenModal
 }: AdvancedOptionsSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('AdvancedOptionsSection component initialized', {
      componentName: 'AdvancedOptionsSection'
    });
  }, []);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'LightbulbIcon': return <LightbulbIcon size={20} />;
      case 'WrenchIcon': return <WrenchIcon size={20} />;
      case 'SearchIcon': return <SearchIcon size={20} />;
      case 'EditIcon': return <EditIcon size={20} />;
      case 'LinkIcon': return <LinkIcon size={20} />;
      default: return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Advanced System Data Options</h3>
      
      <div className="space-y-3">
        {advancedOptions.map(option => (
          <button
            key={option.id}
            onClick={() => onOpenModal(option.modalType)}
            className={`w-full px-4 py-2 ${option.color} text-white rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-2`}
          >
            {getIcon(option.icon)}
            {option.label}
          </button>
        ))}

        <button
          onClick={() => onOpenModal('testDataConfirm')}
          className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
        >
          <DatabaseIcon size={20} />
          {hasTestData ? 'Reload Test Data' : 'Load Test Data'}
        </button>
        
        <button
          onClick={() => onOpenModal('deleteConfirm')}
          className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
        >
          <DeleteIcon size={20} />
          Clear All Data
        </button>
      </div>
    </div>
  );
});

export default AdvancedOptionsSection;