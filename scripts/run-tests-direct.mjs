#!/usr/bin/env node

/**
 * Direct Vitest runner - bypasses npm scripts entirely
 * Runs the full test suite with proper timeout handling
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║               WealthTracker Direct Test Runner (No npm)                   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    // Run vitest directly with explicit arguments
    const args = ['run', '--reporter=verbose', '--no-coverage'];

    console.log(`Running: npx vitest ${args.join(' ')}\n`);

    const proc = spawn('npx', ['vitest', ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // Force colors in output
        FORCE_COLOR: '1',
      },
    });

    // No timeout - let it run as long as needed
    proc.on('close', (code) => {
      const duration = Date.now() - startTime;

      console.log('\n');
      console.log('╔════════════════════════════════════════════════════════════════════════════╗');
      console.log('║                              TEST RUN COMPLETE                             ║');
      console.log('╚════════════════════════════════════════════════════════════════════════════╝');
      console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
      console.log(`Exit Code: ${code}`);

      if (code === 0) {
        console.log('✅ All tests passed!\n');
      } else {
        console.log('❌ Some tests failed. See output above for details.\n');
      }

      resolve({ code, duration });
    });

    proc.on('error', (err) => {
      console.error('❌ Error spawning vitest:', err);
      reject(err);
    });
  });
}

async function main() {
  try {
    const result = await runTests();
    process.exit(result.code);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
