# Wealth Tracker Design System

## Overview

The Wealth Tracker Design System provides a consistent, themeable foundation for the application's UI. It includes design tokens, pre-built themes, and utilities for creating custom themes.

## Architecture

```
src/design-system/
├── tokens.ts       # Design tokens (colors, spacing, typography, etc.)
├── themes.ts       # Pre-built theme definitions
├── utils.ts        # Theme application utilities
├── ThemeProvider.tsx # React context provider
└── index.ts        # Public exports
```

## Usage

### Basic Setup

The design system is integrated at the app level:

```tsx
import { ThemeProvider } from './design-system';

function App() {
  return (
    <ThemeProvider defaultTheme="lightBlue">
      {/* Your app content */}
    </ThemeProvider>
  );
}
```

### Using Theme in Components

Access theme values through CSS variables:

```tsx
// Using CSS variables (recommended)
<div style={{ 
  backgroundColor: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  padding: 'var(--spacing-4)'
}}>
  Content
</div>

// Using theme hook
import { useTheme } from './design-system';

function MyComponent() {
  const { theme, setTheme } = useTheme();
  
  return (
    <div>Current theme: {theme.name}</div>
  );
}
```

## Design Tokens

### Colors

Semantic color tokens adapt based on the current theme:

- **Background**: `--color-background-{primary|secondary|tertiary|elevated|overlay}`
- **Surface**: `--color-surface-{primary|secondary|tertiary|inverse}`
- **Text**: `--color-text-{primary|secondary|tertiary|inverse|link|disabled}`
- **Border**: `--color-border-{primary|secondary|tertiary|focus}`
- **Interactive**: `--color-interactive-{primary|primaryHover|primaryActive|secondary|secondaryHover|secondaryActive}`
- **Status**: `--color-status-{success|warning|error|info}` and backgrounds
- **Financial**: `--color-financial-{income|expense|transfer|investment|savings}`

### Typography

- **Font Family**: `--font-family-{sans|mono}`
- **Font Size**: `--font-size-{xs|sm|base|lg|xl|2xl|3xl|4xl|5xl}`
- **Font Weight**: `--font-weight-{thin|light|normal|medium|semibold|bold|extrabold}`
- **Line Height**: `--line-height-{none|tight|snug|normal|relaxed|loose}`

### Spacing

Consistent spacing scale from `--spacing-0` to `--spacing-32`

### Other Tokens

- **Border Radius**: `--radius-{none|sm|DEFAULT|md|lg|xl|2xl|3xl|full}`
- **Shadows**: `--shadow-{none|sm|DEFAULT|md|lg|xl|2xl|inner}`
- **Animation Duration**: `--duration-{fast|normal|slow}`
- **Animation Easing**: `--easing-{linear|in|out|inOut}`

## Pre-built Themes

### Available Themes

1. **Light Blue** (default)
2. **Dark Blue**
3. **Light Green**
4. **Dark Green**
5. **Light Purple**
6. **Dark Purple**
7. **High Contrast Light**
8. **High Contrast Dark**

### Theme Switching

```tsx
const { setTheme, setThemeByMode } = useTheme();

// Set specific theme
setTheme('darkBlue');

// Set by color and mode
setThemeByMode('green', true); // Sets darkGreen
setThemeByMode('green', false); // Sets lightGreen
```

## Creating Custom Themes

```tsx
const { createCustomTheme } = useTheme();

createCustomTheme(
  'My Custom Theme',
  'lightBlue', // Base theme
  {
    // Override specific colors
    background: {
      primary: '#f0f0f0'
    },
    interactive: {
      primary: '#ff6b6b'
    }
  }
);
```

## Component Examples

### Button using design tokens

```tsx
<button className="ds-button-primary">
  Click me
</button>
```

### Card component

```tsx
<div className="ds-card">
  <h3 style={{ color: 'var(--color-text-primary)' }}>
    Card Title
  </h3>
  <p style={{ color: 'var(--color-text-secondary)' }}>
    Card content
  </p>
</div>
```

### Financial amounts

```tsx
<span className="ds-amount-income">+£1,234.56</span>
<span className="ds-amount-expense">-£567.89</span>
```

## Migration Guide

### From Old Theme System

1. Replace hardcoded colors with CSS variables
2. Update color classes (e.g., `text-blue-600` → `var(--color-interactive-primary)`)
3. Use semantic colors instead of direct color values

### Examples

```tsx
// Before
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">

// After
<div style={{ 
  backgroundColor: 'var(--color-surface-primary)',
  color: 'var(--color-text-primary)'
}}>
```

## Best Practices

1. **Use semantic tokens**: Prefer `--color-text-primary` over specific color values
2. **Respect user preferences**: The system automatically handles dark/light mode
3. **Test with multiple themes**: Ensure your components work with all pre-built themes
4. **Avoid hardcoded colors**: Always use design tokens for consistency
5. **Consider accessibility**: High contrast themes are provided for better readability

## Future Enhancements

- [ ] Theme editor UI for visual customization
- [ ] Export/import custom themes
- [ ] Theme preview component
- [ ] Automatic color contrast checking
- [ ] Integration with Tailwind classes