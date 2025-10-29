import React from 'react';
import { useDeviceType } from '../hooks/useDeviceType';

interface PlatformAwareComponentProps {
  desktopComponent: React.ComponentType<any>;
  mobileComponent: React.ComponentType<any>;
  props?: any;
}

/**
 * Wrapper component that renders different components based on device type
 * This allows gradual migration to desktop-first approach
 */
export const PlatformAwareComponent: React.FC<PlatformAwareComponentProps> = ({
  desktopComponent: DesktopComponent,
  mobileComponent: MobileComponent,
  props = {}
}) => {
  const { isDesktop } = useDeviceType();
  
  if (isDesktop) {
    return <DesktopComponent {...props} />;
  }
  
  return <MobileComponent {...props} />;
};

// Example usage:
// <PlatformAwareComponent
//   desktopComponent={DesktopTransactionTable}
//   mobileComponent={MobileTransactionList}
//   props={{ transactions, onEdit, onDelete }}
// />