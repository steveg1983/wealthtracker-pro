/**
 * Operation Buttons Component
 * Displays primary operation buttons
 */

import React, { useEffect } from 'react';
import { Button } from '../common/Button';
import { FolderIcon, TagIcon, CheckCircleIcon, TrashIcon } from '../icons';
import type { BatchOperation } from '../../hooks/useBatchOperations';
import { useLogger } from '../services/ServiceProvider';

interface OperationButtonsProps {
  operations: BatchOperation[];
  isProcessing: boolean;
  onOperation: (operation: BatchOperation) => void;
}

const OperationButtons = React.memo(({
  operations,
  isProcessing,
  onOperation
}: OperationButtonsProps) => {
  const getIcon = (operationId: string) => {
    switch (operationId) {
      case 'categorize': return FolderIcon;
      case 'tag': return TagIcon;
      case 'clear': return CheckCircleIcon;
      case 'delete': return TrashIcon;
      default: return undefined;
    }
  };

  return (
    <>
      {operations.map(operation => (
        <Button
          key={operation.id}
          variant={operation.variant || 'secondary'}
          size="sm"
          onClick={() => onOperation(operation)}
          disabled={isProcessing}
          leftIcon={getIcon(operation.id)}
        >
          {operation.label}
        </Button>
      ))}
    </>
  );
});

OperationButtons.displayName = 'OperationButtons';

export default OperationButtons;