import React, { ReactNode } from 'react';
import { MobileBottomSheet } from './MobileBottomSheet';
import { Modal } from './common/Modal';

interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  // Mobile-specific props
  mobileSnapPoints?: number[];
  mobileInitialSnapPoint?: number;
  showMobileHandle?: boolean;
}

export function ResponsiveModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className,
  mobileSnapPoints = [0.9],
  mobileInitialSnapPoint = 0,
  showMobileHandle = true
}: ResponsiveModalProps): React.JSX.Element {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobile) {
    return (
      <MobileBottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        snapPoints={mobileSnapPoints}
        initialSnapPoint={mobileInitialSnapPoint}
        showHandle={showMobileHandle}
      >
        {children}
      </MobileBottomSheet>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || ''}
      size={size}
    >
      {children}
    </Modal>
  );
}