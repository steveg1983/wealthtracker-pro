import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Configuration for REAL database integration tests
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup/vitest-setup.integration.ts'],
    testTimeout: 60000, // Longer timeout for real database operations
    hookTimeout: 60000, // Longer hook timeout for setup/teardown
    include: [
      '**/*.real.test.ts',
      '**/*.real.test.tsx'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});