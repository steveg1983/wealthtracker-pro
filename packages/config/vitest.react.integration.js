import path from 'node:path';
import { createVitestReactConfig } from './vitest.react.js';

export const createVitestReactIntegrationConfig = ({
  appRoot,
  defineConfig,
  setupFiles = ['./src/test/setup/vitest-setup.integration.ts'],
  alias,
  test = {},
  plugins = [],
  defineConfigOverrides = {}
} = {}) => {
  const resolvedAlias = alias ?? {
    '@': path.resolve(appRoot, './src'),
  };

  return createVitestReactConfig({
    appRoot,
    defineConfig,
    setupFiles,
    include: [
      '**/*.real.test.ts',
      '**/*.real.test.tsx'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
    ],
    coverage: { enabled: false },
    alias: resolvedAlias,
    test: {
      testTimeout: 60000,
      hookTimeout: 60000,
      ...test,
    },
    plugins,
    defineConfigOverrides,
  });
};

export default createVitestReactIntegrationConfig;
