export const createEslintReactConfig = ({
  js,
  globals,
  reactHooks,
  reactRefresh,
  tseslint,
  globalIgnores,
}) => tseslint.config([
  globalIgnores([
    'dist',
    'dist/**',
    'coverage',
    'coverage/**',
    'logs',
    'logs/**',
    'playwright-report',
    'playwright-report/**',
    'src.backup.*',
    'src.backup.*/**',
    '*.backup.*',
    '*.backup.*/**'
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      'no-empty-pattern': 'warn',
      'no-prototype-builtins': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'react-refresh/only-export-components': 'warn',
      'no-console': ['error', { allow: ['error', 'warn'] }],
      'no-restricted-imports': ['error', {
        paths: [
          { name: '@tabler/icons-react', message: 'Import icons from src/components/icons, not @tabler/icons-react.' },
          { name: 'lucide-react', message: 'Use src/components/icons instead of lucide-react.' },
          { name: 'react-chartjs-2', message: 'Use Recharts components instead of Chart.js.' },
          { name: 'chart.js', message: 'Use Recharts components instead of Chart.js.' },
          { name: 'react-plotly.js', message: 'Plotly is not used; prefer Recharts.' },
          { name: 'plotly.js', message: 'Plotly is not used; prefer Recharts.' },
          { name: 'plotly.js-dist-min', message: 'Plotly is not used; prefer Recharts.' }
        ]
      }]
    }
  },
  {
    files: ['src/components/icons/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off'
    }
  },
  {
    files: ['cypress/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}', 'src/test/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'src/mocks/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['src/setup/consoleToLogger.ts'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['scripts/**/*.{ts,tsx}', 'src/hooks/useAccessibilityAudit.tsx', 'src/services/loggingService.ts'],
    rules: {
      'no-console': 'off'
    }
  }
]);

export default createEslintReactConfig;
