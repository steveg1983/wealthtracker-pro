/**
 * Common accessibility fixes and utilities
 */

/**
 * Ensure all images have alt text
 */
export function ensureImageAltText(): void {
  const images = document.querySelectorAll('img:not([alt])');
  images.forEach((img) => {
    const src = img.getAttribute('src') || '';
    
    // Try to derive meaningful alt text from src
    if (src.includes('logo')) {
      img.setAttribute('alt', 'Logo');
    } else if (src.includes('avatar') || src.includes('profile')) {
      img.setAttribute('alt', 'User avatar');
    } else if (src.includes('icon')) {
      img.setAttribute('alt', '');
      img.setAttribute('role', 'presentation');
    } else {
      // For other images, set empty alt and mark as decorative
      img.setAttribute('alt', '');
      img.setAttribute('role', 'presentation');
    }
  });
}

/**
 * Ensure all icon buttons have aria-labels
 */
export function ensureIconButtonLabels(): void {
  const buttons = document.querySelectorAll('button');
  buttons.forEach((button) => {
    // Check if button has only an icon (no text content)
    const hasText = button.textContent?.trim();
    const hasAriaLabel = button.hasAttribute('aria-label');
    const hasAriaLabelledBy = button.hasAttribute('aria-labelledby');
    
    if (!hasText && !hasAriaLabel && !hasAriaLabelledBy) {
      // Try to infer purpose from class names or data attributes
      const className = button.className;
      
      if (className.includes('close') || className.includes('dismiss')) {
        button.setAttribute('aria-label', 'Close');
      } else if (className.includes('edit')) {
        button.setAttribute('aria-label', 'Edit');
      } else if (className.includes('delete') || className.includes('remove')) {
        button.setAttribute('aria-label', 'Delete');
      } else if (className.includes('save')) {
        button.setAttribute('aria-label', 'Save');
      } else if (className.includes('menu')) {
        button.setAttribute('aria-label', 'Menu');
      } else {
        // Generic fallback
        button.setAttribute('aria-label', 'Button');
      }
    }
  });
}

/**
 * Ensure form inputs have labels
 */
export function ensureFormLabels(): void {
  const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
  inputs.forEach((input) => {
    const element = input as HTMLInputElement;
    const id = element.id;
    const hasLabel = id && document.querySelector(`label[for="${id}"]`);
    const hasAriaLabel = element.hasAttribute('aria-label');
    const hasAriaLabelledBy = element.hasAttribute('aria-labelledby');
    
    if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
      // Use placeholder as fallback for aria-label
      const placeholder = element.getAttribute('placeholder');
      if (placeholder) {
        element.setAttribute('aria-label', placeholder);
      } else {
        // Try to infer from name or type
        const name = element.getAttribute('name');
        const type = element.getAttribute('type');
        
        if (name) {
          // Convert name to readable label (e.g., "user_email" -> "User email")
          const label = name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          element.setAttribute('aria-label', label);
        } else if (type) {
          element.setAttribute('aria-label', type.charAt(0).toUpperCase() + type.slice(1));
        }
      }
    }
  });
}

/**
 * Add skip links if missing
 */
export function ensureSkipLinks(): void {
  const existingSkipLinks = document.querySelector('.skip-links, [href="#main-content"]');
  
  if (!existingSkipLinks) {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-white px-4 py-2 rounded z-50';
    skipLink.textContent = 'Skip to main content';
    
    document.body.insertBefore(skipLink, document.body.firstChild);
  }
}

/**
 * Ensure tables have captions or aria-labels
 */
export function ensureTableAccessibility(): void {
  const tables = document.querySelectorAll('table');
  tables.forEach((table, index) => {
    const hasCaption = table.querySelector('caption');
    const hasAriaLabel = table.hasAttribute('aria-label');
    
    if (!hasCaption && !hasAriaLabel) {
      // Try to find a nearby heading
      const previousElement = table.previousElementSibling;
      if (previousElement && previousElement.tagName.match(/^H[1-6]$/)) {
        const headingText = previousElement.textContent;
        table.setAttribute('aria-label', headingText || `Table ${index + 1}`);
      } else {
        table.setAttribute('aria-label', `Data table ${index + 1}`);
      }
    }
  });
}

/**
 * Ensure proper heading hierarchy
 */
export function checkHeadingHierarchy(): { valid: boolean; issues: string[] } {
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const issues: string[] = [];
  let lastLevel = 0;
  
  headings.forEach((heading, index) => {
    const tagName = heading.tagName;
    const level = parseInt(tagName.slice(1), 10);
    if (Number.isNaN(level)) {
      return;
    }
    
    if (index === 0 && level !== 1) {
      issues.push('Page should start with an h1 heading');
    }
    
    if (level > lastLevel + 1) {
      issues.push(`Heading level skipped: h${lastLevel} to h${level}`);
    }
    
    lastLevel = level;
  });
  
  const h1Count = headings.filter(h => h.tagName === 'H1').length;
  if (h1Count > 1) {
    issues.push(`Multiple h1 headings found (${h1Count}). Use only one h1 per page.`);
  }
  
  return { valid: issues.length === 0, issues };
}

/**
 * Run all accessibility fixes
 */
export function runAccessibilityFixes(): void {
  ensureImageAltText();
  ensureIconButtonLabels();
  ensureFormLabels();
  ensureSkipLinks();
  ensureTableAccessibility();
}

/**
 * Color contrast checker (simplified)
 */
export function checkColorContrast(
  foreground: string | null | undefined,
  background: string | null | undefined
): { ratio: number; passes: { aa: boolean; aaa: boolean } } {
  if (!foreground || !background) {
    return {
      ratio: 0,
      passes: { aa: false, aaa: false }
    };
  }

  // Convert hex to RGB
  const getRGB = (color: string): { r: number; g: number; b: number } => {
    const hex = color.replace('#', '');
    if (hex.length !== 6) {
      return { r: 0, g: 0, b: 0 };
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return {
      r: Number.isNaN(r) ? 0 : r,
      g: Number.isNaN(g) ? 0 : g,
      b: Number.isNaN(b) ? 0 : b
    };
  };
  
  // Calculate relative luminance
  const getLuminance = (rgb: { r: number; g: number; b: number }): number => {
    const linear = (value: number) => {
      const sRGB = value / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    };

    const r = linear(rgb.r);
    const g = linear(rgb.g);
    const b = linear(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  
  const l1 = getLuminance(getRGB(foreground));
  const l2 = getLuminance(getRGB(background));
  
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  
  return {
    ratio: Math.round(ratio * 100) / 100,
    passes: {
      aa: ratio >= 4.5, // WCAG AA for normal text
      aaa: ratio >= 7    // WCAG AAA for normal text
    }
  };
}
