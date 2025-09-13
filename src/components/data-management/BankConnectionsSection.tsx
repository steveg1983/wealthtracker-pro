import React, { useEffect, memo } from 'react';
import { Building2Icon, KeyIcon } from '../icons';
import type { ModalType } from '../../services/dataManagementService';
import { logger } from '../../services/loggingService';

interface BankConnectionsSectionProps {
  bankButtons: Array<{
    id: string;
    label: string;
    icon: string;
    modalType: ModalType;
  }>;
  onOpenModal: (modalType: ModalType) => void;
}

const BankConnectionsSection = memo(function BankConnectionsSection({
  bankButtons,
  onOpenModal
}: BankConnectionsSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BankConnectionsSection component initialized', {
      componentName: 'BankConnectionsSection'
    });
  }, []);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Building2Icon': return <Building2Icon size={20} />;
      case 'KeyIcon': return <KeyIcon size={20} />;
      default: return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bank Connections</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {bankButtons.map(button => (
          <button
            key={button.id}
            onClick={() => onOpenModal(button.modalType)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            {getIcon(button.icon)}
            {button.label}
          </button>
        ))}
      </div>
    </div>
  );
});

export default BankConnectionsSection;