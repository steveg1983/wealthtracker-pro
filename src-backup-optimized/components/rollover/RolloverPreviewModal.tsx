import { memo, useEffect } from 'react';
import { PreviewModal } from './PreviewModal';
import type { RolloverPreview } from './types';
import { useLogger } from '../services/ServiceProvider';

interface RolloverPreviewModalProps {
  show: boolean;
  onClose: () => void;
  preview: RolloverPreview | null;
  onConfirm: () => void;
}

export const RolloverPreviewModal = memo(function RolloverPreviewModal({ show,
  onClose,
  preview,
  onConfirm,
 }: RolloverPreviewModalProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RolloverPreviewModal component initialized', {
      componentName: 'RolloverPreviewModal'
    });
  }, []);

  return (
    <PreviewModal
      isOpen={show}
      onClose={onClose}
      preview={preview as any}
      onApply={onConfirm}
      saving={false}
    />
  );
});
