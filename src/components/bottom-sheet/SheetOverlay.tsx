/**
 * Sheet Overlay Component
 * Backdrop overlay for bottom sheet
 */

import React, { useEffect } from 'react';
import { logger } from '../../services/loggingService';

interface SheetOverlayProps {
  overlayClasses: string;
  onClick: () => void;
}

const SheetOverlay = React.memo(({ overlayClasses, onClick }: SheetOverlayProps) => {
  return (
    <div
      className={overlayClasses}
      onClick={onClick}
      aria-hidden="true"
    />
  );
});

SheetOverlay.displayName = 'SheetOverlay';

export default SheetOverlay;