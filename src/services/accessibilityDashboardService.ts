/**
 * Accessibility Dashboard Service
 * Business logic for accessibility monitoring and reporting
 */

import { ColorContrastChecker } from '../utils/color-contrast-checker';
import { logger } from './loggingService';

export interface AccessibilityIssue {
  type: 'error' | 'warning';
  message: string;
  element: {
    tagName: string;
    className?: string;
  };
  wcagCriteria?: string;
  howToFix?: string;
}

export interface AccessibilityStats {
  total: number;
  errors: number;
  warnings: number;
  byCategory: Record<string, number>;
}

export interface ColorContrastResult {
  name: string;
  fg: string;
  bg: string;
  ratio: number;
  passes: {
    normal: { aa: boolean; aaa: boolean };
    large: { aa: boolean; aaa: boolean };
  };
  recommendation?: string;
}

export interface WCAGGuideline {
  category: 'perceivable' | 'operable' | 'understandable' | 'robust';
  title: string;
  icon: string;
  items: string[];
}

class AccessibilityDashboardService {
  /**
   * Calculate accessibility score based on issues
   */
  calculateScore(stats: AccessibilityStats): number {
    if (stats.total === 0) return 100;
    
    // Weight errors more heavily than warnings
    const errorWeight = 2;
    const warningWeight = 1;
    const maxScore = 50; // Baseline for reasonable issues
    
    const weightedIssues = (stats.errors * errorWeight) + (stats.warnings * warningWeight);
    const score = Math.max(0, Math.round((1 - (weightedIssues / maxScore)) * 100));
    
    return score;
  }

  /**
   * Get accessibility status based on score
   */
  getStatus(score: number): {
    label: string;
    color: 'green' | 'yellow' | 'red';
    message: string;
  } {
    if (score >= 95) {
      return {
        label: 'Excellent',
        color: 'green',
        message: 'Fully accessible!'
      };
    } else if (score >= 80) {
      return {
        label: 'Good',
        color: 'yellow',
        message: 'Minor issues found'
      };
    } else {
      return {
        label: 'Needs Work',
        color: 'red',
        message: 'Significant issues found'
      };
    }
  }

  /**
   * Analyze color combinations for contrast
   */
  analyzeColorContrast(combinations: Array<{ name: string; fg: string; bg: string }>): ColorContrastResult[] {
    return combinations.map(combo => {
      const result = ColorContrastChecker.checkContrast(combo.fg, combo.bg);
      return {
        ...combo,
        ratio: result.ratio,
        passes: result.passes,
        recommendation: result.recommendation
      };
    });
  }

  /**
   * Get WCAG guidelines
   */
  getWCAGGuidelines(): WCAGGuideline[] {
    return [
      {
        category: 'perceivable',
        title: 'Perceivable',
        icon: 'EyeIcon',
        items: [
          'Provide text alternatives for non-text content',
          'Ensure sufficient color contrast (4.5:1 for normal text)',
          'Make content adaptable to different presentations',
          'Use more than color alone to convey information'
        ]
      },
      {
        category: 'operable',
        title: 'Operable',
        icon: 'KeyboardIcon',
        items: [
          'Make all functionality keyboard accessible',
          'Provide users enough time to read content',
          "Don't use content that causes seizures",
          'Help users navigate and find content'
        ]
      },
      {
        category: 'understandable',
        title: 'Understandable',
        icon: 'InfoIcon',
        items: [
          'Make text readable and understandable',
          'Make web pages appear and operate predictably',
          'Help users avoid and correct mistakes',
          'Label all form inputs clearly'
        ]
      },
      {
        category: 'robust',
        title: 'Robust',
        icon: 'TagIcon',
        items: [
          'Use valid, well-structured HTML',
          'Ensure compatibility with assistive technologies',
          'Use ARIA attributes appropriately',
          'Provide name, role, and value for all UI components'
        ]
      }
    ];
  }

  /**
   * Get testing tools recommendations
   */
  getTestingTools(): string[] {
    return [
      'Use keyboard navigation (Tab, Shift+Tab, Enter, Space, Arrow keys)',
      'Test with screen readers (NVDA, JAWS, VoiceOver)',
      'Check color contrast with browser DevTools',
      'Use automated tools like axe DevTools',
      'Test with browser zoom at 200%',
      'Disable CSS to check content structure'
    ];
  }

  /**
   * Format issue for display
   */
  formatIssue(issue: AccessibilityIssue): {
    severity: 'high' | 'medium' | 'low';
    borderColor: string;
    iconColor: string;
  } {
    const isError = issue.type === 'error';
    
    return {
      severity: isError ? 'high' : 'medium',
      borderColor: isError 
        ? 'border-red-300 dark:border-red-700' 
        : 'border-yellow-300 dark:border-yellow-700',
      iconColor: isError 
        ? 'text-red-600 dark:text-red-400' 
        : 'text-yellow-600 dark:text-yellow-400'
    };
  }

  /**
   * Generate accessibility report
   */
  generateReport(
    stats: AccessibilityStats,
    issues: AccessibilityIssue[],
    colorResults: ColorContrastResult[]
  ): string {
    const score = this.calculateScore(stats);
    const status = this.getStatus(score);
    const timestamp = new Date().toISOString();
    
    const report = {
      timestamp,
      score,
      status: status.label,
      summary: {
        total: stats.total,
        errors: stats.errors,
        warnings: stats.warnings,
        byCategory: stats.byCategory
      },
      issues: issues.map(issue => ({
        type: issue.type,
        message: issue.message,
        wcag: issue.wcagCriteria,
        fix: issue.howToFix,
        element: `${issue.element.tagName}${issue.element.className ? `.${issue.element.className}` : ''}`
      })),
      colorContrast: colorResults.map(result => ({
        name: result.name,
        ratio: result.ratio,
        passes: result.passes.normal.aa,
        recommendation: result.recommendation
      }))
    };
    
    return JSON.stringify(report, null, 2);
  }

  /**
   * Get tab configuration
   */
  getTabConfig(): Array<{
    id: string;
    label: string;
    icon: string;
    showCount?: boolean;
  }> {
    return [
      { id: 'overview', label: 'Overview', icon: 'InfoIcon' },
      { id: 'issues', label: 'Issues', icon: 'AlertTriangleIcon', showCount: true },
      { id: 'colors', label: 'Colors', icon: 'PaletteIcon' },
      { id: 'guidelines', label: 'Guidelines', icon: 'CheckCircleIcon' }
    ];
  }

  /**
   * Export report to file
   */
  exportReport(report: string): void {
    try {
      const blob = new Blob([report], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accessibility-report-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      logger.info('Accessibility report exported');
    } catch (error) {
      logger.error('Failed to export report:', error);
      throw error;
    }
  }
}

export const accessibilityDashboardService = new AccessibilityDashboardService();