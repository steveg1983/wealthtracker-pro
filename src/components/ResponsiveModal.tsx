import React, { ReactNode } from 'react';
import { MobileBottomSheet } from './MobileBottomSheet';
import { Modal } from './common/Modal';
import { useIsMobileViewport } from '../hooks/useMediaQuery';

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
  // WAS `window.innerWidth < 768`, read in the render body with no listener.
  // That is a measurement taken once: rotate a phone and the sheet stayed a
  // sheet, drag a desktop window across 768 and the dialog kept whichever
  // shape it was born with, because nothing told React the viewport had
  // moved. This is the app's ONLY layout decision taken in JS, and it had the
  // only stale-breakpoint bug.
  //
  // It cannot honestly become a CSS breakpoint, which is the cheaper fix
  // wherever it works: the two branches are different COMPONENTS, not two
  // dressings of one. MobileBottomSheet and Modal each install a focus trap,
  // each write `document.body.style.overflow`, and each portal a dialog — so
  // rendering both and hiding one with `md:` would mount two modals over one
  // page and leave the loser fighting the winner for focus and body scroll.
  // A live subscription is the smaller thing.
  const isMobile = useIsMobileViewport();

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
      <div className={className}>
        {children}
      </div>
    </Modal>
  );
}