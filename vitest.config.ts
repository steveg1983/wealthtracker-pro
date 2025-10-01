import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // PROPER test configuration for REAL testing
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup/vitest-setup.ts'],
    testTimeout: 30000, // Increased timeout for database operations
    hookTimeout: 30000, // Increased hook timeout for setup/teardown
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'dist/**',
      '**/e2e/**',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      'src.backup.*',
      'src.backup.*/**',
      '**/src.backup.*/**',
      '**/*.backup.*/**',
      '**/CLAUDE.md.backup.*'
    ],
    // Include real tests - we want to run them!
    include: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.real.test.ts',
      '**/*.real.test.tsx'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'src/main.tsx',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/test-utils.ts',
        '**/test-setup.ts',
        '**/src.backup.*/**',
        '**/*.backup.*/**',
      ],
      include: ['src/**/*.{ts,tsx}'],
      all: true,
      clean: true,
      reportsDirectory: './coverage',
      thresholds: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80
        }
      }
    },
  },
  bench: {
    include: ['**/*.bench.ts'],
    exclude: ['node_modules'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
