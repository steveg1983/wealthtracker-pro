#!/usr/bin/env node

import { spawn } from 'node:child_process';

const requiredEnv = ['RUN_SUPABASE_REAL_TESTS', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

const missing = requiredEnv.filter((key) => {
  const value = process.env[key];
  if (key === 'RUN_SUPABASE_REAL_TESTS') {
    return value !== 'true';
  }
  return !value;
});

if (missing.length > 0) {
  console.error(
    `[supabase:smoke] Missing configuration. Ensure RUN_SUPABASE_REAL_TESTS=true and Supabase credentials are provided (missing: ${missing.join(
      ', ',
    )}).`,
  );
  process.exit(1);
}

const vitestArgs = [
  'run',
  'src/test/integration/AppFlow.real.test.tsx',
  'src/test/integration/BudgetWorkflowIntegration.real.test.tsx',
  'src/test/integration/ComponentInteraction.real.test.tsx',
  'src/test/integration/CurrencyIntegration.real.test.tsx',
  'src/test/integration/DashboardInteractionsIntegration.real.test.tsx',
  'src/test/integration/DecimalFinancialIntegration.real.test.tsx',
  'src/test/integration/ErrorHandlingIntegration.real.test.tsx',
  'src/test/integration/InvestmentPortfolioIntegration.real.test.tsx',
  'src/test/integration/UserWorkflowIntegration.real.test.tsx',
];

const child = spawn('vitest', vitestArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITEST_SUPABASE_MODE: 'real',
  },
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});
