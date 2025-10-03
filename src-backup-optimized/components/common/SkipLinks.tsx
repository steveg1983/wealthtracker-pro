/**
 * SkipLinks Component - Accessibility skip navigation links
 *
 * Features:
 * - Skip to main content
 * - Skip to navigation
 * - Skip to sidebar
 * - Keyboard navigation
 * - Screen reader support
 */

import React from 'react';

export interface SkipLink {
  href: string;
  text: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
  className?: string;
}

const DEFAULT_SKIP_LINKS: SkipLink[] = [
  { href: '#main-content', text: 'Skip to main content' },
  { href: '#main-navigation', text: 'Skip to navigation' },
  { href: '#sidebar', text: 'Skip to sidebar' }
];

export function SkipLinks({
  links = DEFAULT_SKIP_LINKS,
  className = ''
}: SkipLinksProps): React.JSX.Element {
  const handleSkipClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string): void => {
    e.preventDefault();

    const targetElement = document.querySelector(href);
    if (targetElement) {
      // Set focus on the target element
      if (targetElement instanceof HTMLElement) {
        targetElement.focus();

        // If the element doesn't naturally receive focus, set tabindex temporarily
        if (!targetElement.hasAttribute('tabindex')) {
          targetElement.setAttribute('tabindex', '-1');
          targetElement.addEventListener('blur', () => {
            targetElement.removeAttribute('tabindex');
          }, { once: true });
        }
      }

      // Scroll to the element
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav
      className={`skip-links fixed top-0 left-0 z-[9999] ${className}`}
      aria-label="Skip navigation links"
    >
      <ul className="list-none m-0 p-0">
        {links.map((link, index) => (
          <li key={index} className="m-0 p-0">
            <a
              href={link.href}
              onClick={(e) => handleSkipClick(e, link.href)}
              className={`
                skip-link
                absolute top-0 left-0
                px-4 py-2
                bg-blue-600 text-white
                text-sm font-medium
                border border-blue-700
                rounded-br-md
                focus:relative focus:z-10
                transform -translate-y-full
                focus:translate-y-0
                transition-transform duration-150 ease-in-out
                whitespace-nowrap
                no-underline hover:no-underline
                focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600
              `}
              style={{
                clipPath: 'inset(0 0 100% 0)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.clipPath = 'none';
              }}
              onBlur={(e) => {
                e.currentTarget.style.clipPath = 'inset(0 0 100% 0)';
              }}
            >
              {link.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Hook for managing skip link visibility and behavior
export function useSkipLinks() {
  const [isVisible, setIsVisible] = React.useState(false);
  const [currentLink, setCurrentLink] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Show skip links when Tab is pressed from the top of the page
      if (event.key === 'Tab' && !event.shiftKey) {
        const activeElement = document.activeElement;
        if (!activeElement || activeElement === document.body) {
          setIsVisible(true);
        }
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Element;
      if (target?.classList.contains('skip-link')) {
        setIsVisible(true);
        setCurrentLink(target.getAttribute('href'));
      } else if (!target?.closest('.skip-links')) {
        setIsVisible(false);
        setCurrentLink(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  return {
    isVisible,
    currentLink,
    show: () => setIsVisible(true),
    hide: () => setIsVisible(false)
  };
}

// Specialized skip links for different page types
export function DashboardSkipLinks(): React.JSX.Element {
  const dashboardLinks: SkipLink[] = [
    { href: '#main-content', text: 'Skip to dashboard content' },
    { href: '#main-navigation', text: 'Skip to navigation' },
    { href: '#account-summary', text: 'Skip to account summary' },
    { href: '#recent-transactions', text: 'Skip to recent transactions' },
    { href: '#budget-overview', text: 'Skip to budget overview' }
  ];

  return <SkipLinks links={dashboardLinks} />;
}

export function TransactionPageSkipLinks(): React.JSX.Element {
  const transactionLinks: SkipLink[] = [
    { href: '#main-content', text: 'Skip to transaction list' },
    { href: '#main-navigation', text: 'Skip to navigation' },
    { href: '#transaction-filters', text: 'Skip to filters' },
    { href: '#transaction-search', text: 'Skip to search' },
    { href: '#add-transaction', text: 'Skip to add transaction' }
  ];

  return <SkipLinks links={transactionLinks} />;
}

export function SettingsPageSkipLinks(): React.JSX.Element {
  const settingsLinks: SkipLink[] = [
    { href: '#main-content', text: 'Skip to settings content' },
    { href: '#main-navigation', text: 'Skip to navigation' },
    { href: '#settings-menu', text: 'Skip to settings menu' },
    { href: '#settings-form', text: 'Skip to settings form' }
  ];

  return <SkipLinks links={settingsLinks} />;
}

export function ReportsPageSkipLinks(): React.JSX.Element {
  const reportsLinks: SkipLink[] = [
    { href: '#main-content', text: 'Skip to reports content' },
    { href: '#main-navigation', text: 'Skip to navigation' },
    { href: '#report-filters', text: 'Skip to report filters' },
    { href: '#report-charts', text: 'Skip to charts' },
    { href: '#report-data', text: 'Skip to data table' }
  ];

  return <SkipLinks links={reportsLinks} />;
}

// Component for adding skip link targets
interface SkipTargetProps {
  id: string;
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  tabIndex?: number;
}

export function SkipTarget({
  id,
  children,
  as: Component = 'div',
  className = '',
  tabIndex = -1,
  ...props
}: SkipTargetProps): React.JSX.Element {
  return React.createElement(
    Component,
    {
      id,
      tabIndex,
      className: `skip-target ${className}`,
      'aria-label': `Content section: ${id.replace('-', ' ')}`,
      ...props
    },
    children
  );
}

export default SkipLinks;