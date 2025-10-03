import { colors, SemanticColors } from './tokens';

export interface Theme {
  id: string;
  name: string;
  description: string;
  isDark: boolean;
  colors: SemanticColors;
}

// Light theme base
const lightBase: SemanticColors = {
  background: {
    primary: colors.gray[50],
    secondary: '#ffffff',
    tertiary: colors.gray[100],
    elevated: '#ffffff',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  surface: {
    primary: '#ffffff',
    secondary: colors.gray[50],
    tertiary: colors.gray[100],
    inverse: colors.gray[900],
  },
  text: {
    primary: colors.gray[900],
    secondary: colors.gray[700],
    tertiary: colors.gray[500],
    inverse: '#ffffff',
    link: colors.blue[600],
    disabled: colors.gray[400],
  },
  border: {
    primary: colors.gray[200],
    secondary: colors.gray[300],
    tertiary: colors.gray[100],
    focus: colors.blue[500],
  },
  interactive: {
    primary: colors.blue[600],
    primaryHover: colors.blue[700],
    primaryActive: colors.blue[800],
    secondary: colors.gray[600],
    secondaryHover: colors.gray[700],
    secondaryActive: colors.gray[800],
  },
  status: {
    success: colors.green[600],
    successBackground: colors.green[50],
    warning: colors.yellow[600],
    warningBackground: colors.yellow[50],
    error: colors.red[600],
    errorBackground: colors.red[50],
    info: colors.blue[600],
    infoBackground: colors.blue[50],
  },
  financial: {
    income: colors.green[600],
    expense: colors.red[600],
    transfer: colors.blue[600],
    investment: colors.purple[600],
    savings: colors.green[700],
  },
};

// Dark theme base
const darkBase: SemanticColors = {
  background: {
    primary: colors.gray[900],
    secondary: colors.gray[800],
    tertiary: colors.gray[950],
    elevated: colors.gray[800],
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  surface: {
    primary: colors.gray[800],
    secondary: colors.gray[700],
    tertiary: colors.gray[900],
    inverse: colors.gray[50],
  },
  text: {
    primary: colors.gray[50],
    secondary: colors.gray[300],
    tertiary: colors.gray[400],
    inverse: colors.gray[900],
    link: colors.blue[400],
    disabled: colors.gray[500],
  },
  border: {
    primary: colors.gray[700],
    secondary: colors.gray[600],
    tertiary: colors.gray[800],
    focus: colors.blue[400],
  },
  interactive: {
    primary: colors.blue[500],
    primaryHover: colors.blue[400],
    primaryActive: colors.blue[600],
    secondary: colors.gray[400],
    secondaryHover: colors.gray[300],
    secondaryActive: colors.gray[500],
  },
  status: {
    success: colors.green[400],
    successBackground: `${colors.green[900]}20`,
    warning: colors.yellow[400],
    warningBackground: `${colors.yellow[900]}20`,
    error: colors.red[400],
    errorBackground: `${colors.red[900]}20`,
    info: colors.blue[400],
    infoBackground: `${colors.blue[900]}20`,
  },
  financial: {
    income: colors.green[400],
    expense: colors.red[400],
    transfer: colors.blue[400],
    investment: colors.purple[400],
    savings: colors.green[500],
  },
};

// Predefined themes
export const themes: Record<string, Theme> = {
  // Blue themes
  lightBlue: {
    id: 'lightBlue',
    name: 'Light Blue',
    description: 'Clean and professional light theme',
    isDark: false,
    colors: lightBase,
  },
  darkBlue: {
    id: 'darkBlue',
    name: 'Dark Blue',
    description: 'Modern dark theme with blue accents',
    isDark: true,
    colors: darkBase,
  },
  
  // Green themes
  lightGreen: {
    id: 'lightGreen',
    name: 'Light Green',
    description: 'Fresh and calming light theme',
    isDark: false,
    colors: {
      ...lightBase,
      interactive: {
        primary: colors.green[600],
        primaryHover: colors.green[700],
        primaryActive: colors.green[800],
        secondary: colors.green[500],
        secondaryHover: colors.green[600],
        secondaryActive: colors.green[700],
      },
      border: {
        ...lightBase.border,
        focus: colors.green[500],
      },
    },
  },
  darkGreen: {
    id: 'darkGreen',
    name: 'Dark Green',
    description: 'Nature-inspired dark theme',
    isDark: true,
    colors: {
      ...darkBase,
      interactive: {
        primary: colors.green[500],
        primaryHover: colors.green[400],
        primaryActive: colors.green[600],
        secondary: colors.green[400],
        secondaryHover: colors.green[300],
        secondaryActive: colors.green[500],
      },
      border: {
        ...darkBase.border,
        focus: colors.green[400],
      },
    },
  },
  
  // Purple themes
  lightPurple: {
    id: 'lightPurple',
    name: 'Light Purple',
    description: 'Creative and vibrant light theme',
    isDark: false,
    colors: {
      ...lightBase,
      interactive: {
        primary: colors.purple[600],
        primaryHover: colors.purple[700],
        primaryActive: colors.purple[800],
        secondary: colors.purple[500],
        secondaryHover: colors.purple[600],
        secondaryActive: colors.purple[700],
      },
      border: {
        ...lightBase.border,
        focus: colors.purple[500],
      },
    },
  },
  darkPurple: {
    id: 'darkPurple',
    name: 'Dark Purple',
    description: 'Rich and elegant dark theme',
    isDark: true,
    colors: {
      ...darkBase,
      interactive: {
        primary: colors.purple[500],
        primaryHover: colors.purple[400],
        primaryActive: colors.purple[600],
        secondary: colors.purple[400],
        secondaryHover: colors.purple[300],
        secondaryActive: colors.purple[500],
      },
      border: {
        ...darkBase.border,
        focus: colors.purple[400],
      },
    },
  },
  
  // High contrast themes
  highContrastLight: {
    id: 'highContrastLight',
    name: 'High Contrast Light',
    description: 'Maximum readability light theme',
    isDark: false,
    colors: {
      ...lightBase,
      background: {
        primary: '#ffffff',
        secondary: '#ffffff',
        tertiary: '#f5f5f5',
        elevated: '#ffffff',
        overlay: 'rgba(0, 0, 0, 0.7)',
      },
      text: {
        primary: '#000000',
        secondary: colors.gray[800],
        tertiary: colors.gray[700],
        inverse: '#ffffff',
        link: colors.blue[700],
        disabled: colors.gray[500],
      },
      border: {
        primary: '#000000',
        secondary: colors.gray[800],
        tertiary: colors.gray[600],
        focus: colors.blue[700],
      },
    },
  },
  highContrastDark: {
    id: 'highContrastDark',
    name: 'High Contrast Dark',
    description: 'Maximum readability dark theme',
    isDark: true,
    colors: {
      ...darkBase,
      background: {
        primary: '#000000',
        secondary: '#0a0a0a',
        tertiary: '#000000',
        elevated: '#141414',
        overlay: 'rgba(0, 0, 0, 0.9)',
      },
      text: {
        primary: '#ffffff',
        secondary: colors.gray[200],
        tertiary: colors.gray[300],
        inverse: '#000000',
        link: colors.blue[300],
        disabled: colors.gray[500],
      },
      border: {
        primary: '#ffffff',
        secondary: colors.gray[300],
        tertiary: colors.gray[400],
        focus: colors.blue[300],
      },
    },
  },
};

// Theme utilities
export function getTheme(themeId: string): Theme {
  return themes[themeId] || themes.lightBlue;
}

export function getThemeByMode(colorTheme: string, isDark: boolean): Theme {
  const themeKey = `${isDark ? 'dark' : 'light'}${colorTheme.charAt(0).toUpperCase() + colorTheme.slice(1)}`;
  return themes[themeKey] || (isDark ? themes.darkBlue : themes.lightBlue);
}

// Custom theme builder
export function createCustomTheme(
  name: string,
  baseTheme: Theme,
  overrides: Partial<SemanticColors>
): Theme {
  return {
    id: `custom-${Date.now()}`,
    name,
    description: `Custom theme based on ${baseTheme.name}`,
    isDark: baseTheme.isDark,
    colors: {
      background: { ...baseTheme.colors.background, ...overrides.background },
      surface: { ...baseTheme.colors.surface, ...overrides.surface },
      text: { ...baseTheme.colors.text, ...overrides.text },
      border: { ...baseTheme.colors.border, ...overrides.border },
      interactive: { ...baseTheme.colors.interactive, ...overrides.interactive },
      status: { ...baseTheme.colors.status, ...overrides.status },
      financial: { ...baseTheme.colors.financial, ...overrides.financial },
    },
  };
}