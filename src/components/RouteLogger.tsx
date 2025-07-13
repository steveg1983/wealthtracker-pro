import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function RouteLogger({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  
  useEffect(() => {
    console.log('Route changed to:', location.pathname);
  }, [location]);
  
  return <>{children}</>;
}