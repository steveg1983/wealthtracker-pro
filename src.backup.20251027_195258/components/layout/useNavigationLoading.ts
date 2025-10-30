import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export function useNavigationLoading(): boolean {
  const [isNavigating, setIsNavigating] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 100);
    return () => clearTimeout(timer);
  }, [location]);

  return isNavigating;
}
