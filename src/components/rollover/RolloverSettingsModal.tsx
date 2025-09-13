import { memo, useEffect } from 'react';
import { SettingsModal } from './SettingsModal';
import type { RolloverSettings } from './types';
import { logger } from '../../services/loggingService';

interface RolloverSettingsModalProps {
  show: boolean;
  onClose: () => void;
  settings: RolloverSettings;
  onSave: (settings: RolloverSettings) => void;
  categories: Array<{ id: string; name: string }>;
}

export const RolloverSettingsModal = memo(function RolloverSettingsModal({
  show,
  onClose,
  settings,
  onSave,
  categories
}: RolloverSettingsModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RolloverSettingsModal component initialized', {
      componentName: 'RolloverSettingsModal'
    });
  }, []);

  return (
    <SettingsModal
      isOpen={show}
      onClose={onClose}
      settings={settings}
      onUpdate={(partial) => onSave({ ...settings, ...partial })}
      categories={categories}
    />
  );
});
