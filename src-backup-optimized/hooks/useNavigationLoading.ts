import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export function useNavigationLoading(delay = 100): boolean {
  const [isNavigating, setIsNavigating] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), delay);
    return () => clearTimeout(timer);
  }, [delay, location]);

  return isNavigating;
}
