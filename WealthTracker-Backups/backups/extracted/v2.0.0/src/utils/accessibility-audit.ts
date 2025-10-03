/**
 * Accessibility Audit Utilities
 * Tools for checking and improving accessibility across the application
 */

interface AccessibilityIssue {
  element: HTMLElement;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  wcagCriteria?: string;
  suggestion?: string;
}

export class AccessibilityAuditor {
  private issues: AccessibilityIssue[] = [];

  /**
   * Run a comprehensive accessibility audit
   */
  public audit(): AccessibilityIssue[] {
    this.issues = [];
    
    this.checkImages();
    this.checkButtons();
    this.checkForms();
    this.checkHeadings();
    this.checkContrast();
    this.checkKeyboardNavigation();
    this.checkARIA();
    this.checkLandmarks();
    this.checkTables();
    this.checkLinks();
    
    return this.issues;
  }

  /**
   * Check all images for alt text
   */
  private checkImages(): void {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (!img.hasAttribute('alt')) {
        this.addIssue(img as HTMLElement, 'Image missing alt text', 'error', 'WCAG 1.1.1', 'Add descriptive alt text or alt="" for decorative images');
      } else if (img.getAttribute('alt') === '') {
        // Check if image is truly decorative
        const isDecorative = img.getAttribute('role') === 'presentation' || img.getAttribute('aria-hidden') === 'true';
        if (!isDecorative && img.getAttribute('src')?.includes('logo')) {
          this.addIssue(img as HTMLElement, 'Logo image has empty alt text', 'warning', 'WCAG 1.1.1', 'Add descriptive alt text for logo images');
        }
      }
    });
  }

  /**
   * Check buttons for proper labeling
   */
  private checkButtons(): void {
    const buttons = document.querySelectorAll('button, [role="button"]');
    buttons.forEach(button => {
      const element = button as HTMLElement;
      const text = element.textContent?.trim();
      const ariaLabel = element.getAttribute('aria-label');
      const ariaLabelledBy = element.getAttribute('aria-labelledby');
      
      if (!text && !ariaLabel && !ariaLabelledBy) {
        this.addIssue(element, 'Button has no accessible label', 'error', 'WCAG 4.1.2', 'Add text content, aria-label, or aria-labelledby');
      }
      
      // Check for buttons with only icons
      const hasOnlyIcon = element.querySelector('svg') && !text;
      if (hasOnlyIcon && !ariaLabel) {
        this.addIssue(element, 'Icon-only button needs accessible label', 'error', 'WCAG 4.1.2', 'Add aria-label to describe the button action');
      }
    });
  }

  /**
   * Check form elements for labels
   */
  private checkForms(): void {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      const element = input as HTMLElement;
      const id = element.getAttribute('id');
      const ariaLabel = element.getAttribute('aria-label');
      const ariaLabelledBy = element.getAttribute('aria-labelledby');
      
      if (element.getAttribute('type') === 'hidden') return;
      
      // Check for associated label
      const label = id ? document.querySelector(`label[for="${id}"]`) : null;
      
      if (!label && !ariaLabel && !ariaLabelledBy) {
        this.addIssue(element, 'Form input has no associated label', 'error', 'WCAG 3.3.2', 'Add a label element or aria-label attribute');
      }
      
      // Check for required fields
      if (element.hasAttribute('required') && !element.getAttribute('aria-required')) {
        this.addIssue(element, 'Required field missing aria-required attribute', 'warning', 'WCAG 3.3.2', 'Add aria-required="true" for better screen reader support');
      }
    });
  }

  /**
   * Check heading hierarchy
   */
  private checkHeadings(): void {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let lastLevel = 0;
    
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName[1]);
      
      // Check for skipped heading levels
      if (index > 0 && level > lastLevel + 1) {
        this.addIssue(heading as HTMLElement, `Heading level skipped (h${lastLevel} to h${level})`, 'warning', 'WCAG 1.3.1', 'Use sequential heading levels');
      }
      
      // Check for multiple h1s
      if (level === 1 && headings.filter(h => h.tagName === 'H1').length > 1) {
        this.addIssue(heading as HTMLElement, 'Multiple h1 elements on page', 'warning', 'WCAG 1.3.1', 'Use only one h1 per page');
      }
      
      lastLevel = level;
    });
  }

  /**
   * Check color contrast ratios
   */
  private checkContrast(): void {
    // This is a simplified check - for production, use a proper contrast calculation
    const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button');
    
    textElements.forEach(element => {
      const el = element as HTMLElement;
      const styles = window.getComputedStyle(el);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;
      
      // Check for very light gray text
      if (color.includes('rgb') && this.isLowContrast(color)) {
        this.addIssue(el, 'Text may have insufficient contrast', 'warning', 'WCAG 1.4.3', 'Ensure text has at least 4.5:1 contrast ratio');
      }
    });
  }

  /**
   * Check keyboard navigation
   */
  private checkKeyboardNavigation(): void {
    // Check for focusable elements without visible focus styles
    const focusableElements = document.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    
    focusableElements.forEach(element => {
      const el = element as HTMLElement;
      
      // Check for positive tabindex
      const tabindex = el.getAttribute('tabindex');
      if (tabindex && parseInt(tabindex) > 0) {
        this.addIssue(el, 'Positive tabindex disrupts natural tab order', 'warning', 'WCAG 2.4.3', 'Use tabindex="0" or remove tabindex');
      }
    });
    
    // Check for skip links
    const skipLink = document.querySelector('a[href^="#"][class*="skip"]');
    if (!skipLink) {
      this.addIssue(document.body, 'No skip navigation link found', 'warning', 'WCAG 2.4.1', 'Add a skip to main content link');
    }
  }

  /**
   * Check ARIA attributes
   */
  private checkARIA(): void {
    // Check for invalid ARIA roles
    const elementsWithRoles = document.querySelectorAll('[role]');
    elementsWithRoles.forEach(element => {
      const role = element.getAttribute('role');
      if (role && !this.isValidARIARole(role)) {
        this.addIssue(element as HTMLElement, `Invalid ARIA role: ${role}`, 'error', 'WCAG 4.1.2', 'Use valid ARIA roles');
      }
    });
    
    // Check for aria-labelledby pointing to non-existent elements
    const elementsWithLabelledBy = document.querySelectorAll('[aria-labelledby]');
    elementsWithLabelledBy.forEach(element => {
      const labelIds = element.getAttribute('aria-labelledby')?.split(' ') || [];
      labelIds.forEach(id => {
        if (!document.getElementById(id)) {
          this.addIssue(element as HTMLElement, `aria-labelledby references non-existent element: ${id}`, 'error', 'WCAG 4.1.2', 'Ensure referenced elements exist');
        }
      });
    });
  }

  /**
   * Check for proper landmarks
   */
  private checkLandmarks(): void {
    const main = document.querySelector('main, [role="main"]');
    if (!main) {
      this.addIssue(document.body, 'No main landmark found', 'error', 'WCAG 1.3.1', 'Add a <main> element or role="main"');
    }
    
    const nav = document.querySelector('nav, [role="navigation"]');
    if (!nav) {
      this.addIssue(document.body, 'No navigation landmark found', 'warning', 'WCAG 1.3.1', 'Add a <nav> element or role="navigation"');
    }
  }

  /**
   * Check tables for accessibility
   */
  private checkTables(): void {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      // Check for caption or aria-label
      const caption = table.querySelector('caption');
      const ariaLabel = table.getAttribute('aria-label');
      
      if (!caption && !ariaLabel) {
        this.addIssue(table as HTMLElement, 'Table has no caption or aria-label', 'warning', 'WCAG 1.3.1', 'Add a caption or aria-label to describe the table');
      }
      
      // Check for th elements
      const headers = table.querySelectorAll('th');
      if (headers.length === 0) {
        this.addIssue(table as HTMLElement, 'Table has no header cells', 'error', 'WCAG 1.3.1', 'Use <th> elements for headers');
      }
    });
  }

  /**
   * Check links
   */
  private checkLinks(): void {
    const links = document.querySelectorAll('a');
    links.forEach(link => {
      const element = link as HTMLElement;
      const text = element.textContent?.trim();
      const ariaLabel = element.getAttribute('aria-label');
      
      // Check for empty links
      if (!text && !ariaLabel) {
        this.addIssue(element, 'Link has no text or label', 'error', 'WCAG 2.4.4', 'Add link text or aria-label');
      }
      
      // Check for generic link text
      if (text && ['click here', 'read more', 'more', 'here'].includes(text.toLowerCase())) {
        this.addIssue(element, 'Link text is not descriptive', 'warning', 'WCAG 2.4.4', 'Use descriptive link text that explains the destination');
      }
      
      // Check for links that open in new window
      if (element.getAttribute('target') === '_blank' && !text?.includes('opens in new')) {
        this.addIssue(element, 'Link opens in new window without warning', 'warning', 'WCAG 3.2.2', 'Add text or aria-label indicating link opens in new window');
      }
    });
  }

  /**
   * Add an issue to the list
   */
  private addIssue(element: HTMLElement, issue: string, severity: 'error' | 'warning' | 'info', wcagCriteria?: string, suggestion?: string): void {
    this.issues.push({ element, issue, severity, wcagCriteria, suggestion });
  }

  /**
   * Check if a color has low contrast (simplified)
   */
  private isLowContrast(color: string): boolean {
    const match = color.match(/\d+/g);
    if (!match || match.length < 3) return false;
    
    const [r, g, b] = match.map(Number);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Very light colors
    return brightness > 200;
  }

  /**
   * Check if ARIA role is valid (simplified list)
   */
  private isValidARIARole(role: string): boolean {
    const validRoles = [
      'alert', 'banner', 'button', 'complementary', 'contentinfo', 'dialog',
      'document', 'form', 'heading', 'img', 'link', 'list', 'listitem',
      'main', 'navigation', 'region', 'search', 'status', 'tab', 'tablist',
      'tabpanel', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem'
    ];
    return validRoles.includes(role);
  }

  /**
   * Generate a report of all issues
   */
  public generateReport(): string {
    const errors = this.issues.filter(i => i.severity === 'error');
    const warnings = this.issues.filter(i => i.severity === 'warning');
    const info = this.issues.filter(i => i.severity === 'info');
    
    let report = '# Accessibility Audit Report\n\n';
    report += `Total issues found: ${this.issues.length}\n`;
    report += `- Errors: ${errors.length}\n`;
    report += `- Warnings: ${warnings.length}\n`;
    report += `- Info: ${info.length}\n\n`;
    
    if (errors.length > 0) {
      report += '## Errors (Must Fix)\n\n';
      errors.forEach(issue => {
        report += `- **${issue.issue}**\n`;
        if (issue.wcagCriteria) report += `  - WCAG: ${issue.wcagCriteria}\n`;
        if (issue.suggestion) report += `  - Fix: ${issue.suggestion}\n`;
        report += '\n';
      });
    }
    
    if (warnings.length > 0) {
      report += '## Warnings (Should Fix)\n\n';
      warnings.forEach(issue => {
        report += `- **${issue.issue}**\n`;
        if (issue.wcagCriteria) report += `  - WCAG: ${issue.wcagCriteria}\n`;
        if (issue.suggestion) report += `  - Fix: ${issue.suggestion}\n`;
        report += '\n';
      });
    }
    
    return report;
  }
}

// Export a singleton instance
export const accessibilityAuditor = new AccessibilityAuditor();