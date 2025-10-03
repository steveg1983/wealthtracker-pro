import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['dist']),
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
      // Stricter defaults
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
      // Encourage centralized logging via logger service
      // Disallow console in app code (use logger). Allow warn/error only.
      'no-console': ['error', { allow: ['error', 'warn'] }],
      // Prevent reintroducing deprecated/removed heavy libs
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
  // Allow @tabler/icons-react only inside the icons facade
  {
    files: ['src/components/icons/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off'
    }
  },
  // Allow console usage in tests and Cypress helpers
  {
    files: ['cypress/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}', 'src/test/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'src/mocks/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off'
    }
  },
  // Allow console in the console-to-logger shim itself
  {
    files: ['src/setup/consoleToLogger.ts'],
    rules: {
      'no-console': 'off'
    }
  }
])
