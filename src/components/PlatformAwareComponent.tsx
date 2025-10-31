import React from 'react';
import { useDeviceType } from '../hooks/useDeviceType';

interface PlatformAwareComponentProps<TProps> {
  desktopComponent: React.ComponentType<TProps>;
  mobileComponent: React.ComponentType<TProps>;
  props?: TProps;
}

/**
 * Wrapper component that renders different components based on device type
 * This allows gradual migration to desktop-first approach
 */
export function PlatformAwareComponent<TProps>({
  desktopComponent: DesktopComponent,
  mobileComponent: MobileComponent,
  props = {}
}: PlatformAwareComponentProps<TProps>): React.JSX.Element {
  const { isDesktop } = useDeviceType();
  const componentProps = (props ?? {}) as TProps;
  
  if (isDesktop) {
    return <DesktopComponent {...componentProps} />;
  }
  
  return <MobileComponent {...componentProps} />;
}

// Example usage:
// <PlatformAwareComponent
//   desktopComponent={DesktopTransactionTable}
//   mobileComponent={MobileTransactionList}
//   props={{ transactions, onEdit, onDelete }}
// />
