import React from 'react';
import { useLocation } from 'react-router-dom';

export const useNavigationLoading = (delayMs = 100) => {
  const [isNavigating, setIsNavigating] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    setIsNavigating(true);
    const timer = window.setTimeout(() => setIsNavigating(false), delayMs);
    return () => window.clearTimeout(timer);
  }, [location, delayMs]);

  return isNavigating;
};
