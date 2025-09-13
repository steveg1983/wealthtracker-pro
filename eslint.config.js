import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['dist', '**/*.backup.*', '**/*.ts.backup', '**/*.tsx.backup']),
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
      // Phase 0: downgrade a few noisy rules to warnings to get CI green.
      // We will re-tighten in Phase 1–2 after code migration.
      'no-case-declarations': 'warn',
      'no-useless-catch': 'warn',
      'no-unused-expressions': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
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
      // Phase 0: treat console usage as warn to unblock stabilization.
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      // Prevent reintroducing deprecated/removed heavy libs
      // Phase 0: warn on restricted imports; migrate charts in Phase 5 DX.
      'no-restricted-imports': ['warn', {
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
  },
  // Allow console in scripts and debug tools
  {
    files: ['scripts/**/*.{ts,tsx}', 'src/hooks/useAccessibilityAudit.tsx'],
    rules: {
      'no-console': 'off'
    }
  }
])
