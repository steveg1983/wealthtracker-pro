/**
 * Skip Links Component
 * Provides keyboard users quick navigation to main content areas
 */

import React from 'react';
import { DEFAULT_SKIP_LINKS } from '../../constants/skipLinks';

interface SkipLink {
  href: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
}

export const SkipLinks: React.FC<SkipLinksProps> = ({ links = DEFAULT_SKIP_LINKS }) => {
  return (
    <nav
      className="skip-links"
      aria-label="Skip links"
    >
      {links.map((link, index) => (
        <a
          key={link.href}
          href={link.href}
          className="skip-link"
          style={{ marginLeft: index > 0 ? '8px' : '0' }}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
};

// Live Region Component for Screen Reader Announcements
interface LiveRegionProps {
  message: string;
  type?: 'polite' | 'assertive';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  type = 'polite',
  atomic = true,
  relevant = 'additions'
}) => {
  const [currentMessage, setCurrentMessage] = React.useState('');

  React.useEffect(() => {
    if (message) {
      setCurrentMessage(message);
      // Clear message after announcement
      const timer = setTimeout(() => {
        setCurrentMessage('');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div
      role="status"
      aria-live={type}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className="sr-only"
    >
      {currentMessage}
    </div>
  );
};
