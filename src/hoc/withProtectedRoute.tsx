import React, { type ComponentType } from 'react';
import ProtectedRoute, { type ProtectedRouteProps } from '../components/ProtectedRoute';

export default function withProtectedRoute<P extends object>(
  Component: ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) {
  const ProtectedComponent = (props: P): React.ReactElement => (
    <ProtectedRoute {...options}>
      <Component {...props} />
    </ProtectedRoute>
  );

  ProtectedComponent.displayName = `withProtectedRoute(${Component.displayName || Component.name || 'Component'})`;

  return ProtectedComponent;
}

export { withProtectedRoute };
