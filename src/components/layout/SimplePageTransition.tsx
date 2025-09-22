import React from 'react';

const SimplePageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const PageTransition = SimplePageTransition;

export const NavigationProgress: React.FC = () => {
  return null; // No-op progress indicator
};

export default SimplePageTransition;