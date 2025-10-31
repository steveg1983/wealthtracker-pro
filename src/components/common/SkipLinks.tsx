/**
 * Skip Links Component
 * Provides keyboard users quick navigation to main content areas
 */

import React from 'react';

interface SkipLink {
  href: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
}

const defaultLinks: SkipLink[] = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#navigation', label: 'Skip to navigation' },
  { href: '#search', label: 'Skip to search' }
];

export const SkipLinks: React.FC<SkipLinksProps> = ({ links = defaultLinks }) => {
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

// CSS for skip links (add to your global styles)
export const skipLinksStyles = `
  .skip-links {
    position: absolute;
    top: -40px;
    left: 0;
    background: #000;
    color: #fff;
    padding: 8px;
    text-decoration: none;
    z-index: 100;
  }

  .skip-link {
    position: absolute;
    left: -10000px;
    top: auto;
    width: 1px;
    height: 1px;
    overflow: hidden;
    background: #1a73e8;
    color: white;
    padding: 0.75rem 1.5rem;
    text-decoration: none;
    font-weight: 500;
    border-radius: 0.375rem;
    z-index: 9999;
  }

  .skip-link:focus {
    position: fixed;
    left: 1rem;
    top: 1rem;
    width: auto;
    height: auto;
    overflow: visible;
    outline: 3px solid #4285f4;
    outline-offset: 2px;
  }
`;

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
