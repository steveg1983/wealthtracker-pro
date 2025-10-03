/**
 * Color Contrast Checker
 * Utilities for ensuring WCAG 2.1 AA/AAA color contrast compliance
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ContrastResult {
  ratio: number;
  passes: {
    normal: {
      aa: boolean; // 4.5:1
      aaa: boolean; // 7:1
    };
    large: {
      aa: boolean; // 3:1
      aaa: boolean; // 4.5:1
    };
  };
  recommendation?: string;
}

export class ColorContrastChecker {
  /**
   * Convert hex color to RGB
   */
  static hexToRgb(hex: string): RGB {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      throw new Error('Invalid hex color');
    }
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    };
  }

  /**
   * Convert RGB to relative luminance
   */
  static getRelativeLuminance(rgb: RGB): number {
    const { r, g, b } = rgb;
    const [rs, gs, bs] = [r, g, b].map(c => {
      const sRGB = c / 255;
      return sRGB <= 0.03928 
        ? sRGB / 12.92 
        : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  static getContrastRatio(color1: string, color2: string): number {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);
    
    const l1 = this.getRelativeLuminance(rgb1);
    const l2 = this.getRelativeLuminance(rgb2);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Check if color combination meets WCAG standards
   */
  static checkContrast(foreground: string, background: string): ContrastResult {
    const ratio = this.getContrastRatio(foreground, background);
    
    const result: ContrastResult = {
      ratio: Math.round(ratio * 100) / 100,
      passes: {
        normal: {
          aa: ratio >= 4.5,
          aaa: ratio >= 7
        },
        large: {
          aa: ratio >= 3,
          aaa: ratio >= 4.5
        }
      }
    };

    // Add recommendations
    if (!result.passes.normal.aa) {
      if (ratio < 3) {
        result.recommendation = 'Very poor contrast. Consider significantly lighter/darker colors.';
      } else if (ratio < 4.5) {
        result.recommendation = 'Use this combination only for large text (18pt+ or 14pt+ bold).';
      }
    } else if (!result.passes.normal.aaa) {
      result.recommendation = 'Meets AA standards but not AAA. Good for most uses.';
    } else {
      result.recommendation = 'Excellent contrast! Meets all WCAG standards.';
    }

    return result;
  }

  /**
   * Get suggested color adjustments to meet contrast requirements
   */
  static suggestColorAdjustment(
    foreground: string, 
    background: string, 
    targetRatio: number = 4.5
  ): { foreground?: string; background?: string } {
    const currentRatio = this.getContrastRatio(foreground, background);
    
    if (currentRatio >= targetRatio) {
      return {}; // Already meets requirements
    }

    const fgRgb = this.hexToRgb(foreground);
    const bgRgb = this.hexToRgb(background);
    
    const fgLuminance = this.getRelativeLuminance(fgRgb);
    const bgLuminance = this.getRelativeLuminance(bgRgb);
    
    // Determine which color to adjust
    const adjustForeground = fgLuminance > bgLuminance;
    
    // Simple adjustment: make light colors lighter, dark colors darker
    const suggestions: { foreground?: string; background?: string } = {};
    
    if (adjustForeground) {
      // Lighten foreground
      const adjusted = {
        r: Math.min(255, fgRgb.r + 20),
        g: Math.min(255, fgRgb.g + 20),
        b: Math.min(255, fgRgb.b + 20)
      };
      suggestions.foreground = this.rgbToHex(adjusted);
    } else {
      // Darken foreground
      const adjusted = {
        r: Math.max(0, fgRgb.r - 20),
        g: Math.max(0, fgRgb.g - 20),
        b: Math.max(0, fgRgb.b - 20)
      };
      suggestions.foreground = this.rgbToHex(adjusted);
    }
    
    return suggestions;
  }

  /**
   * Convert RGB to hex
   */
  static rgbToHex(rgb: RGB): string {
    const toHex = (n: number) => {
      const hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }
}

// Tailwind color palette with hex values for common colors
export const tailwindColors = {
  // Grays
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  },
  // Blues
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a'
  },
  // Reds
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d'
  },
  // Greens
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d'
  }
};

// Common color combinations to check
export const commonCombinations = [
  // Text on backgrounds
  { name: 'Dark text on light bg', fg: tailwindColors.gray[900], bg: tailwindColors.gray[50] },
  { name: 'Light text on dark bg', fg: tailwindColors.gray[50], bg: tailwindColors.gray[900] },
  { name: 'Blue text on white', fg: tailwindColors.blue[600], bg: '#ffffff' },
  { name: 'White text on blue', fg: '#ffffff', bg: tailwindColors.blue[600] },
  { name: 'Red text on white', fg: tailwindColors.red[600], bg: '#ffffff' },
  { name: 'Green text on white', fg: tailwindColors.green[600], bg: '#ffffff' },
  
  // Common UI patterns
  { name: 'Disabled text', fg: tailwindColors.gray[400], bg: tailwindColors.gray[100] },
  { name: 'Placeholder text', fg: tailwindColors.gray[500], bg: '#ffffff' },
  { name: 'Error text', fg: tailwindColors.red[600], bg: tailwindColors.red[50] },
  { name: 'Success text', fg: tailwindColors.green[600], bg: tailwindColors.green[50] },
  
  // Dark mode
  { name: 'Dark mode text', fg: tailwindColors.gray[200], bg: tailwindColors.gray[800] },
  { name: 'Dark mode muted', fg: tailwindColors.gray[400], bg: tailwindColors.gray[800] },
  { name: 'Dark mode link', fg: tailwindColors.blue[400], bg: tailwindColors.gray[800] }
];

// Utility function to check all common combinations
export function auditColorContrast() {
  import('../services/loggingService').then(({ logger }) => {
    logger.info('Color Contrast Audit start');
    commonCombinations.forEach(({ name, fg, bg }) => {
      const result = ColorContrastChecker.checkContrast(fg, bg);
      logger.info('Contrast', { name, ratio: result.ratio, passesAA: result.passes.normal.aa, recommendation: result.recommendation });
    });
    logger.info('Color Contrast Audit end');
  }).catch(() => {});
}

// Development helper
if (process.env.NODE_ENV === 'development') {
  (window as unknown as { ColorContrastChecker?: typeof ColorContrastChecker }).ColorContrastChecker = ColorContrastChecker;
  (window as unknown as { auditColorContrast?: typeof auditColorContrast }).auditColorContrast = auditColorContrast;
}
