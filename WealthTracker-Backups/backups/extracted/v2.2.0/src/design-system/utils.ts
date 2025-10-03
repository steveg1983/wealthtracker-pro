import { Theme } from './themes';
import { spacing, borderRadius, shadows, typography, animations } from './tokens';

/**
 * Apply theme to the document root
 * Sets CSS custom properties based on the theme configuration
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  
  // Apply color tokens
  Object.entries(theme.colors).forEach(([category, values]) => {
    Object.entries(values).forEach(([key, value]) => {
      root.style.setProperty(`--color-${category}-${key}`, value);
    });
  });
  
  // Apply typography tokens
  Object.entries(typography.fontSize).forEach(([key, value]) => {
    root.style.setProperty(`--font-size-${key}`, value);
  });
  
  Object.entries(typography.fontWeight).forEach(([key, value]) => {
    root.style.setProperty(`--font-weight-${key}`, value);
  });
  
  Object.entries(typography.lineHeight).forEach(([key, value]) => {
    root.style.setProperty(`--line-height-${key}`, value);
  });
  
  // Apply spacing tokens
  Object.entries(spacing).forEach(([key, value]) => {
    const propertyKey = key.replace('.', '-');
    root.style.setProperty(`--spacing-${propertyKey}`, value);
  });
  
  // Apply border radius tokens
  Object.entries(borderRadius).forEach(([key, value]) => {
    root.style.setProperty(`--radius-${key}`, value);
  });
  
  // Apply shadow tokens
  Object.entries(shadows).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value);
  });
  
  // Apply animation tokens
  Object.entries(animations.duration).forEach(([key, value]) => {
    root.style.setProperty(`--duration-${key}`, value);
  });
  
  Object.entries(animations.easing).forEach(([key, value]) => {
    root.style.setProperty(`--easing-${key}`, value);
  });
  
  // Set theme metadata
  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-theme-mode', theme.isDark ? 'dark' : 'light');
  
  // Update dark mode class
  if (theme.isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Get CSS variable value from the root element
 */
export function getCSSVariable(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Generate theme CSS variables as a string
 * Useful for SSR or generating theme stylesheets
 */
export function generateThemeCSS(theme: Theme): string {
  const lines: string[] = [':root {'];
  
  // Add color variables
  Object.entries(theme.colors).forEach(([category, values]) => {
    lines.push(`  /* ${category} colors */`);
    Object.entries(values).forEach(([key, value]) => {
      lines.push(`  --color-${category}-${key}: ${value};`);
    });
  });
  
  // Add typography variables
  lines.push('  /* Typography */');
  Object.entries(typography.fontSize).forEach(([key, value]) => {
    lines.push(`  --font-size-${key}: ${value};`);
  });
  
  Object.entries(typography.fontWeight).forEach(([key, value]) => {
    lines.push(`  --font-weight-${key}: ${value};`);
  });
  
  Object.entries(typography.lineHeight).forEach(([key, value]) => {
    lines.push(`  --line-height-${key}: ${value};`);
  });
  
  // Add spacing variables
  lines.push('  /* Spacing */');
  Object.entries(spacing).forEach(([key, value]) => {
    const propertyKey = key.replace('.', '-');
    lines.push(`  --spacing-${propertyKey}: ${value};`);
  });
  
  // Add border radius variables
  lines.push('  /* Border Radius */');
  Object.entries(borderRadius).forEach(([key, value]) => {
    lines.push(`  --radius-${key}: ${value};`);
  });
  
  // Add shadow variables
  lines.push('  /* Shadows */');
  Object.entries(shadows).forEach(([key, value]) => {
    lines.push(`  --shadow-${key}: ${value};`);
  });
  
  // Add animation variables
  lines.push('  /* Animations */');
  Object.entries(animations.duration).forEach(([key, value]) => {
    lines.push(`  --duration-${key}: ${value};`);
  });
  
  Object.entries(animations.easing).forEach(([key, value]) => {
    lines.push(`  --easing-${key}: ${value};`);
  });
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Convert theme colors to Tailwind-compatible format
 * Useful for dynamic theme generation with Tailwind
 */
export function themeToTailwindConfig(theme: Theme) {
  return {
    colors: {
      background: theme.colors.background,
      surface: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      primary: {
        DEFAULT: theme.colors.interactive.primary,
        hover: theme.colors.interactive.primaryHover,
        active: theme.colors.interactive.primaryActive,
      },
      secondary: {
        DEFAULT: theme.colors.interactive.secondary,
        hover: theme.colors.interactive.secondaryHover,
        active: theme.colors.interactive.secondaryActive,
      },
      success: {
        DEFAULT: theme.colors.status.success,
        background: theme.colors.status.successBackground,
      },
      warning: {
        DEFAULT: theme.colors.status.warning,
        background: theme.colors.status.warningBackground,
      },
      error: {
        DEFAULT: theme.colors.status.error,
        background: theme.colors.status.errorBackground,
      },
      info: {
        DEFAULT: theme.colors.status.info,
        background: theme.colors.status.infoBackground,
      },
      income: theme.colors.financial.income,
      expense: theme.colors.financial.expense,
      transfer: theme.colors.financial.transfer,
      investment: theme.colors.financial.investment,
      savings: theme.colors.financial.savings,
    },
  };
}