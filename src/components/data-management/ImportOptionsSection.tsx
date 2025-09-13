import React, { useEffect, memo } from 'react';
import { DatabaseIcon, FolderIcon, FileTextIcon, CreditCardIcon, UploadIcon } from '../icons';
import type { ModalType } from '../../services/dataManagementService';
import { logger } from '../../services/loggingService';

interface ImportOptionsSectionProps {
  importButtons: Array<{
    id: string;
    label: string;
    icon: string;
    color: string;
    modalType: ModalType;
    fullWidth?: boolean;
  }>;
  onOpenModal: (modalType: ModalType) => void;
}

const ImportOptionsSection = memo(function ImportOptionsSection({
  importButtons,
  onOpenModal
}: ImportOptionsSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ImportOptionsSection component initialized', {
      componentName: 'ImportOptionsSection'
    });
  }, []);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'DatabaseIcon': return <DatabaseIcon size={20} />;
      case 'FolderIcon': return <FolderIcon size={20} />;
      case 'FileTextIcon': return <FileTextIcon size={20} />;
      case 'CreditCardIcon': return <CreditCardIcon size={20} />;
      case 'UploadIcon': return <UploadIcon size={20} />;
      default: return null;
    }
  };

  const migrationButton = importButtons.find(b => b.fullWidth);
  const regularButtons = importButtons.filter(b => !b.fullWidth);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Import Options</h3>
      
      {/* Migration Wizard - Full Width */}
      {migrationButton && (
        <button
          onClick={() => onOpenModal(migrationButton.modalType)}
          className={`w-full mb-4 px-4 py-3 ${migrationButton.color} text-white rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-2 shadow-lg`}
        >
          {getIcon(migrationButton.icon)}
          <span className="font-medium">{migrationButton.label}</span>
        </button>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {regularButtons.map(button => (
          <button
            key={button.id}
            onClick={() => onOpenModal(button.modalType)}
            className={`px-4 py-2 ${button.color} text-white rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-2`}
          >
            {getIcon(button.icon)}
            {button.label}
          </button>
        ))}
      </div>
    </div>
  );
});

export default ImportOptionsSection;