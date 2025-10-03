/**
 * Accessibility Testing Utilities
 * Tools for testing and ensuring WCAG 2.1 AA compliance
 */

interface ColorContrastResult {
  ratio: number;
  passes: {
    aa: boolean;
    aaa: boolean;
    largeAA: boolean;
    largeAAA: boolean;
  };
  foreground: string;
  background: string;
}

interface AccessibilityIssue {
  element: HTMLElement;
  type: 'error' | 'warning';
  category: string;
  message: string;
  wcagCriteria?: string;
  howToFix?: string;
}

export class AccessibilityTester {
  /**
   * Run a comprehensive accessibility audit on the current page
   */
  static audit(rootElement: HTMLElement = document.body): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    // Check images for alt text
    issues.push(...this.checkImages(rootElement));

    // Check form labels
    issues.push(...this.checkFormLabels(rootElement));

    // Check heading hierarchy
    issues.push(...this.checkHeadingHierarchy(rootElement));

    // Check color contrast
    issues.push(...this.checkColorContrast(rootElement));

    // Check keyboard navigation
    issues.push(...this.checkKeyboardNavigation(rootElement));

    // Check ARIA attributes
    issues.push(...this.checkAriaAttributes(rootElement));

    // Check focus indicators
    issues.push(...this.checkFocusIndicators(rootElement));

    // Check link text
    issues.push(...this.checkLinkText(rootElement));

    // Check table accessibility
    issues.push(...this.checkTables(rootElement));

    return issues;
  }

  /**
   * Check all images for alt text
   */
  private static checkImages(root: HTMLElement): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const images = root.querySelectorAll('img');

    images.forEach(img => {
      if (!img.hasAttribute('alt')) {
        issues.push({
          element: img,
          type: 'error',
          category: 'Images',
          message: 'Image missing alt attribute',
          wcagCriteria: '1.1.1 Non-text Content',
          howToFix: 'Add an alt attribute. Use alt="" for decorative images.'
        });
      } else if (img.getAttribute('alt')?.includes('image') || img.getAttribute('alt')?.includes('photo')) {
        issues.push({
          element: img,
          type: 'warning',
          category: 'Images',
          message: 'Alt text contains redundant words like "image" or "photo"',
          howToFix: 'Remove redundant words from alt text. Screen readers already announce it as an image.'
        });
      }
    });

    return issues;
  }

  /**
   * Check form elements for proper labels
   */
  private static checkFormLabels(root: HTMLElement): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const inputs = root.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
      const inputEl = input as HTMLInputElement;
      
      // Skip hidden inputs and submit/button types
      if (inputEl.type === 'hidden' || inputEl.type === 'submit' || inputEl.type === 'button') {
        return;
      }

      const hasLabel = this.hasAssociatedLabel(inputEl);
      const hasAriaLabel = inputEl.hasAttribute('aria-label') || inputEl.hasAttribute('aria-labelledby');

      if (!hasLabel && !hasAriaLabel) {
        issues.push({
          element: inputEl,
          type: 'error',
          category: 'Forms',
          message: `Form ${inputEl.tagName.toLowerCase()} missing label`,
          wcagCriteria: '3.3.2 Labels or Instructions',
          howToFix: 'Add a <label> element with for attribute, or use aria-label/aria-labelledby'
        });
      }
    });

    return issues;
  }

  /**
   * Check if an input has an associated label
   */
  private static hasAssociatedLabel(input: HTMLElement): boolean {
    // Check if wrapped in label
    if (input.closest('label')) return true;

    // Check for label with for attribute
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return true;
    }

    return false;
  }

  /**
   * Check heading hierarchy
   */
  private static checkHeadingHierarchy(root: HTMLElement): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
    
    let lastLevel = 0;
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName[1]);
      
      if (index === 0 && level !== 1) {
        issues.push({
          element: heading,
          type: 'warning',
          category: 'Structure',
          message: 'Page should start with an h1',
          wcagCriteria: '1.3.1 Info and Relationships'
        });
      }
      
      if (level > lastLevel + 1) {
        issues.push({
          element: heading,
          type: 'warning',
          category: 'Structure',
          message: `Heading level skipped from h${lastLevel} to h${level}`,
          wcagCriteria: '1.3.1 Info and Relationships',
          howToFix: 'Use sequential heading levels without skipping'
        });
      }
      
      lastLevel = level;
    });

    // Check for multiple h1s
    const h1s = root.querySelectorAll('h1');
    if (h1s.length > 1) {
      h1s.forEach((h1, index) => {
        if (index > 0) {
          issues.push({
            element: h1,
            type: 'warning',
            category: 'Structure',
            message: 'Multiple h1 elements found. Page should have only one h1.',
            wcagCriteria: '1.3.1 Info and Relationships'
          });
        }
      });
    }

    return issues;
  }

  /**
   * Check color contrast ratios
   */
  private static checkColorContrast(root: HTMLElement): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const textElements = root.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button, label');

    textElements.forEach(element => {
      const styles = window.getComputedStyle(element);
      const bgColor = this.getBackgroundColor(element);
      const fgColor = styles.color;

      if (bgColor && fgColor && bgColor !== 'transparent' && fgColor !== 'transparent') {
        const contrast = this.calculateContrast(fgColor, bgColor);
        const fontSize = parseFloat(styles.fontSize);
        const fontWeight = styles.fontWeight;
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && parseInt(fontWeight) >= 700);

        const requiredRatio = isLargeText ? 3 : 4.5;

        if (contrast.ratio < requiredRatio) {
          issues.push({
            element: element as HTMLElement,
            type: 'error',
            category: 'Color Contrast',
            message: `Insufficient color contrast ratio: ${contrast.ratio.toFixed(2)}:1 (required: ${requiredRatio}:1)`,
            wcagCriteria: '1.4.3 Contrast (Minimum)',
            howToFix: `Adjust colors to meet ${requiredRatio}:1 contrast ratio`
          });
        }
      }
    });

    return issues;
  }

  /**
   * Get the actual background color of an element (traversing up if transparent)
   */
  private static getBackgroundColor(element: Element): string {
    let el: Element | null = element;
    let bgColor = 'transparent';

    while (el && bgColor === 'transparent') {
      const styles = window.getComputedStyle(el);
      bgColor = styles.backgroundColor;
      el = el.parentElement;
    }

    return bgColor || 'white';
  }

  /**
   * Calculate contrast ratio between two colors
   */
  static calculateContrast(foreground: string, background: string): ColorContrastResult {
    const fg = this.parseColor(foreground);
    const bg = this.parseColor(background);

    const l1 = this.relativeLuminance(fg);
    const l2 = this.relativeLuminance(bg);

    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    return {
      ratio,
      passes: {
        aa: ratio >= 4.5,
        aaa: ratio >= 7,
        largeAA: ratio >= 3,
        largeAAA: ratio >= 4.5
      },
      foreground,
      background
    };
  }

  /**
   * Parse color string to RGB values
   */
  private static parseColor(color: string): { r: number; g: number; b: number } {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return { r: data[0], g: data[1], b: data[2] };
  }

  /**
   * Calculate relative luminance
   */
  private static relativeLuminance(rgb: { r: number; g: number; b: number }): number {
    const { r, g, b } = rgb;
    const sRGB = [r / 255, g / 255, b / 255];
    const [R, G, B] = sRGB.map(value => {
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  /**
   * Check keyboard navigation
   */
  private static checkKeyboardNavigation(root: HTMLElement): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const interactiveElements = root.querySelectorAll('a, button, input, select, textarea, [tabindex]');

    interactiveElements.forEach(element => {
      const el = element as HTMLElement;
      const tabindex = el.getAttribute('tabindex');

      if (tabindex && parseInt(tabindex) > 0) {
        issues.push({
          element: el,
          type: 'warning',
          category: 'Keyboard Navigation',
          message: 'Positive tabindex values should be avoided',
          wcagCriteria: '2.4.3 Focus Order',
          howToFix: 'Use tabindex="0" or "-1" instead. Let DOM order determine tab order.'
        });
      }

      // Check for click handlers without keyboard support
      if (el.onclick && el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.tagName !== 'INPUT') {
        if (!el.onkeydown && !el.onkeypress && !el.getAttribute('role')) {
          issues.push({
            element: el,
            type: 'error',
            category: 'Keyboard Navigation',
            message: 'Element with click handler is not keyboard accessible',
            wcagCriteria: '2.1.1 Keyboard',
            howToFix: 'Add keyboard event handlers or use a button element'
          });
        }
      }
    });

    return issues;
  }

  /**
   * Check ARIA attributes
   */
  private static checkAriaAttributes(root: HTMLElement): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    // Check for aria-labelledby pointing to non-existent elements
    const labelledByElements = root.querySelectorAll('[aria-labelledby]');
    labelledByElements.forEach(element => {
      const ids = element.getAttribute('aria-labelledby')?.split(' ') || [];
      ids.forEach(id => {
        if (!document.getElementById(id)) {
          issues.push({
            element: element as HTMLElement,
            type: 'error',
            category: 'ARIA',
            message: `aria-labelledby references non-existent element: ${id}`,
            wcagCriteria: '4.1.2 Name, Role, Value'
          });
        }
      });
    });

    // Check for aria-describedby pointing to non-existent elements
    const describedByElements = root.querySelectorAll('[aria-describedby]');
    describedByElements.forEach(element => {
      const ids = element.getAttribute('aria-describedby')?.split(' ') || [];
      ids.forEach(id => {
        if (!document.getElementById(id)) {
          issues.push({
            element: element as HTMLElement,
            type: 'error',
            category: 'ARIA',
            message: `aria-describedby references non-existent element: ${id}`,
            wcagCriteria: '4.1.2 Name, Role, Value'
          });
        }
      });
    });

    // Check for invalid ARIA roles
    const roledElements = root.querySelectorAll('[role]');
    const validRoles = ['button', 'link', 'navigation', 'main', 'banner', 'contentinfo', 'search', 'form', 'region', 'complementary', 'alert', 'dialog', 'menu', 'menuitem', 'tab', 'tabpanel', 'tablist'];
    
    roledElements.forEach(element => {
      const role = element.getAttribute('role');
      if (role && !validRoles.includes(role)) {
        issues.push({
          element: element as HTMLElement,
          type: 'warning',
          category: 'ARIA',
          message: `Invalid or uncommon ARIA role: ${role}`,
          wcagCriteria: '4.1.2 Name, Role, Value'
        });
      }
    });

    return issues;
  }

  /**
   * Check focus indicators
   */
  private static checkFocusIndicators(root: HTMLElement): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const interactiveElements = root.querySelectorAll('a, button, input, select, textarea, [tabindex="0"]');

    interactiveElements.forEach(element => {
      const el = element as HTMLElement;
      
      // Create a temporary focus state to check styles
      el.focus();
      const focusedStyles = window.getComputedStyle(el);
      el.blur();
      const unfocusedStyles = window.getComputedStyle(el);

      // Check if there's any visual difference when focused
      const hasOutline = focusedStyles.outline !== unfocusedStyles.outline && focusedStyles.outline !== 'none';
      const hasBorder = focusedStyles.border !== unfocusedStyles.border;
      const hasBoxShadow = focusedStyles.boxShadow !== unfocusedStyles.boxShadow;
      const hasBackground = focusedStyles.backgroundColor !== unfocusedStyles.backgroundColor;

      if (!hasOutline && !hasBorder && !hasBoxShadow && !hasBackground) {
        issues.push({
          element: el,
          type: 'warning',
          category: 'Focus Indicators',
          message: 'No visible focus indicator',
          wcagCriteria: '2.4.7 Focus Visible',
          howToFix: 'Add outline, border, or other visual indicator for :focus state'
        });
      }
    });

    return issues;
  }

  /**
   * Check link text
   */
  private static checkLinkText(root: HTMLElement): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const links = root.querySelectorAll('a');

    links.forEach(link => {
      const text = link.textContent?.trim() || '';
      const ariaLabel = link.getAttribute('aria-label');

      if (!text && !ariaLabel) {
        issues.push({
          element: link,
          type: 'error',
          category: 'Links',
          message: 'Link has no accessible text',
          wcagCriteria: '2.4.4 Link Purpose',
          howToFix: 'Add link text or aria-label'
        });
      } else if (text.toLowerCase() === 'click here' || text.toLowerCase() === 'read more') {
        issues.push({
          element: link,
          type: 'warning',
          category: 'Links',
          message: 'Link text is not descriptive',
          wcagCriteria: '2.4.4 Link Purpose',
          howToFix: 'Use descriptive link text that explains the destination'
        });
      }
    });

    return issues;
  }

  /**
   * Check table accessibility
   */
  private static checkTables(root: HTMLElement): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const tables = root.querySelectorAll('table');

    tables.forEach(table => {
      // Check for caption
      if (!table.querySelector('caption')) {
        issues.push({
          element: table,
          type: 'warning',
          category: 'Tables',
          message: 'Table missing caption',
          wcagCriteria: '1.3.1 Info and Relationships',
          howToFix: 'Add a <caption> element to describe the table'
        });
      }

      // Check for header cells
      const headers = table.querySelectorAll('th');
      if (headers.length === 0) {
        issues.push({
          element: table,
          type: 'error',
          category: 'Tables',
          message: 'Table has no header cells',
          wcagCriteria: '1.3.1 Info and Relationships',
          howToFix: 'Use <th> elements for header cells'
        });
      }

      // Check for scope attributes on headers
      headers.forEach(th => {
        if (!th.hasAttribute('scope')) {
          issues.push({
            element: th,
            type: 'warning',
            category: 'Tables',
            message: 'Table header missing scope attribute',
            wcagCriteria: '1.3.1 Info and Relationships',
            howToFix: 'Add scope="col" or scope="row" to clarify header relationships'
          });
        }
      });
    });

    return issues;
  }

  /**
   * Generate a report of accessibility issues
   */
  static generateReport(issues: AccessibilityIssue[]): string {
    const grouped = issues.reduce((acc, issue) => {
      if (!acc[issue.category]) acc[issue.category] = [];
      acc[issue.category].push(issue);
      return acc;
    }, {} as Record<string, AccessibilityIssue[]>);

    let report = '# Accessibility Audit Report\n\n';
    report += `Total issues found: ${issues.length}\n\n`;

    Object.entries(grouped).forEach(([category, categoryIssues]) => {
      report += `## ${category} (${categoryIssues.length} issues)\n\n`;
      
      categoryIssues.forEach(issue => {
        report += `### ${issue.type.toUpperCase()}: ${issue.message}\n`;
        if (issue.wcagCriteria) {
          report += `WCAG Criteria: ${issue.wcagCriteria}\n`;
        }
        if (issue.howToFix) {
          report += `How to fix: ${issue.howToFix}\n`;
        }
        report += `Element: ${issue.element.tagName}${issue.element.className ? `.${issue.element.className}` : ''}\n\n`;
      });
    });

    return report;
  }
}

// Development helper - add to window for console access
if (process.env.NODE_ENV === 'development') {
  const windowWithTester = window as Window & { AccessibilityTester?: typeof AccessibilityTester };
  windowWithTester.AccessibilityTester = AccessibilityTester;
}
