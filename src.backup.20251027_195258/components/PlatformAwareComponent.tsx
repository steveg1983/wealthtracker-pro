import React from 'react';
import { useDeviceType } from '../hooks/useDeviceType';

type ComponentProps = Record<string, unknown>;

interface PlatformAwareComponentProps<TProps extends ComponentProps = ComponentProps> {
  desktopComponent: React.ComponentType<TProps>;
  mobileComponent: React.ComponentType<TProps>;
  componentProps?: TProps;
}

/**
 * Wrapper component that renders different components based on device type
 * This allows gradual migration to desktop-first approach
 */
export const PlatformAwareComponent = <TProps extends ComponentProps = ComponentProps>({
  desktopComponent: DesktopComponent,
  mobileComponent: MobileComponent,
  componentProps
}: PlatformAwareComponentProps<TProps>): React.ReactElement => {
  const { isDesktop } = useDeviceType();
  const Component = isDesktop ? DesktopComponent : MobileComponent;

  return React.createElement(Component, componentProps);
};

// Example usage:
// <PlatformAwareComponent
//   desktopComponent={DesktopTransactionTable}
//   mobileComponent={MobileTransactionList}
//   props={{ transactions, onEdit, onDelete }}
// />
