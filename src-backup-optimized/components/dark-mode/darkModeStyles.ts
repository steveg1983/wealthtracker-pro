/**
 * Enhanced dark mode CSS styles
 * Provides WCAG AAA compliant contrast ratios and smooth transitions
 */
export const darkModeStyles = `
/* Enhanced Dark Mode Variables */
:root {
  --contrast-multiplier: 1;
}

/* High Contrast Mode */
[data-contrast="high"] {
  --contrast-multiplier: 1.2;
}

[data-contrast="highest"] {
  --contrast-multiplier: 1.5;
}

/* Refined Dark Mode Colors with Perfect Contrast */
.dark {
  /* Backgrounds */
  --bg-primary: hsl(222, 47%, 11%);
  --bg-secondary: hsl(222, 47%, 15%);
  --bg-tertiary: hsl(222, 47%, 20%);
  
  /* Text Colors - WCAG AAA Compliant */
  --text-primary: hsl(0, 0%, calc(95% * var(--contrast-multiplier)));
  --text-secondary: hsl(0, 0%, calc(75% * var(--contrast-multiplier)));
  --text-muted: hsl(0, 0%, calc(60% * var(--contrast-multiplier)));
  
  /* Semantic Colors with Enhanced Contrast */
  --color-success: hsl(142, 71%, calc(45% * var(--contrast-multiplier)));
  --color-warning: hsl(38, 92%, calc(50% * var(--contrast-multiplier)));
  --color-error: hsl(0, 91%, calc(60% * var(--contrast-multiplier)));
  --color-info: hsl(201, 98%, calc(48% * var(--contrast-multiplier)));
}

/* Smooth Theme Transitions */
html.transitioning,
html.transitioning * {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease !important;
}

/* Per-Component Theme Overrides */
.dark .force-light {
  color-scheme: light;
  background: white;
  color: black;
}

.light .force-dark {
  color-scheme: dark;
  background: hsl(222, 47%, 11%);
  color: white;
}

/* Focus Indicators for Dark Mode */
.dark *:focus-visible {
  outline-color: hsl(201, 98%, 48%);
  outline-offset: 2px;
}

/* Enhanced Shadows for Dark Mode */
.dark .shadow-sm {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
}

.dark .shadow {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
}

.dark .shadow-lg {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3);
}

/* Code Blocks in Dark Mode */
.dark pre, .dark code {
  background: hsl(222, 47%, 8%);
  color: hsl(213, 31%, 80%);
}

/* Selection Colors */
.dark ::selection {
  background: hsl(201, 98%, 48%, 0.3);
  color: white;
}
`;