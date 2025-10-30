import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnchorHTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import predictiveLoader from '../../services/predictiveLoadingService';

type TimeoutHandle = number;

const PRELOAD_PRIORITY = 2;

export type PredictiveLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string;
  children: ReactNode;
  preloadDelay?: number;
};

export function PredictiveLink({
  to,
  children,
  className = '',
  preloadDelay = 100,
  ...rest
}: PredictiveLinkProps) {
  const navigate = useNavigate();
  const hoverTimeout = useRef<TimeoutHandle | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);

  const handleMouseEnter = useCallback(() => {
    hoverTimeout.current = window.setTimeout(() => {
      setIsPreloading(true);
      void predictiveLoader.requestPreload({
        type: 'page',
        target: to,
        loader: async () => {
          const route = to.split('/')[1];
          switch (route) {
            case 'transactions':
              await import('../../pages/Transactions');
              break;
            case 'accounts':
              await import('../../pages/Accounts');
              break;
            case 'analytics':
              await import('../../pages/Analytics');
              break;
            case 'investments':
              await import('../../pages/Investments');
              break;
            default:
              break;
          }
        },
        priority: PRELOAD_PRIORITY,
      });
    }, preloadDelay);
  }, [to, preloadDelay]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) {
      window.clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    setIsPreloading(false);
  }, []);

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      navigate(to);
    },
    [navigate, to]
  );

  useEffect(() => {
    return () => {
      if (hoverTimeout.current) {
        window.clearTimeout(hoverTimeout.current);
        hoverTimeout.current = null;
      }
    };
  }, []);

  const combinedClassName = [className, isPreloading ? 'cursor-wait' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <a
      {...rest}
      href={to}
      className={combinedClassName}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      {isPreloading && (
        <span className="ml-1 text-xs text-gray-400">(preloading...)</span>
      )}
    </a>
  );
}
