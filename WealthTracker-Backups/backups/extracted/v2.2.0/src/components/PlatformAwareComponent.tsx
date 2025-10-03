import React from 'react';
import { useDeviceType } from '../hooks/useDeviceType';

interface PlatformAwareComponentProps<T = Record<string, unknown>> {
  desktopComponent: React.ComponentType<T>;
  mobileComponent: React.ComponentType<T>;
  props?: T;
}

/**
 * Wrapper component that renders different components based on device type
 * This allows gradual migration to desktop-first approach
 */
export const PlatformAwareComponent = <T extends Record<string, unknown> = Record<string, unknown>>({
  desktopComponent: DesktopComponent,
  mobileComponent: MobileComponent,
  props = {} as T
}: PlatformAwareComponentProps<T>): React.JSX.Element => {
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