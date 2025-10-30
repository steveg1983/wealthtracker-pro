export interface SkipLinkDefinition {
  href: string;
  label: string;
}

export const DEFAULT_SKIP_LINKS: SkipLinkDefinition[] = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#navigation', label: 'Skip to navigation' },
  { href: '#search', label: 'Skip to search' },
];

export const SKIP_LINKS_STYLES = `
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
