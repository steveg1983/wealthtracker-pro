#!/usr/bin/env node

/**
 * Comprehensive test runner that bypasses npm script timeout issues
 * Runs all tests in logical batches and provides detailed reporting
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const TEST_BATCHES = [
  {
    name: 'Services',
    pattern: 'src/services/**/*.test.ts',
  },
  {
    name: 'Contexts',
    pattern: 'src/contexts/**/*.test.tsx',
  },
  {
    name: 'Store/Slices',
    pattern: 'src/store/**/*.test.ts',
  },
  {
    name: 'Components',
    pattern: 'src/components/**/*.test.tsx',
  },
  {
    name: 'Integration Tests',
    pattern: 'src/test/integration/**/*.test.tsx',
  },
  {
    name: 'Hooks',
    pattern: 'src/hooks/**/*.test.ts',
  },
  {
    name: 'Utils',
    pattern: 'src/utils/**/*.test.ts',
  },
];

const results = {
  batches: [],
  totalTests: 0,
  totalPassed: 0,
  totalFailed: 0,
  totalSkipped: 0,
  duration: 0,
};

function runVitest(pattern, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const args = ['run', pattern, '--reporter=verbose'];

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Running: npx vitest ${args.join(' ')}`);
    console.log(`${'='.repeat(80)}\n`);

    const proc = spawn('npx', ['vitest', ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: { ...process.env },
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Test batch timed out after ${timeout}ms`));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const duration = Date.now() - startTime;
      resolve({ code, duration });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runBatch(batch) {
  console.log(`\n🧪 Running ${batch.name}...\n`);

  try {
    const result = await runVitest(batch.pattern);

    return {
      name: batch.name,
      pattern: batch.pattern,
      success: result.code === 0,
      duration: result.duration,
      exitCode: result.code,
    };
  } catch (error) {
    console.error(`❌ Error running ${batch.name}:`, error.message);
    return {
      name: batch.name,
      pattern: batch.pattern,
      success: false,
      duration: 0,
      error: error.message,
    };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    WealthTracker Test Suite Runner                        ║');
  console.log('║              Bypasses npm script timeouts by running direct Vitest        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  const overallStart = Date.now();

  // Run all batches sequentially
  for (const batch of TEST_BATCHES) {
    const batchResult = await runBatch(batch);
    results.batches.push(batchResult);
  }

  const overallDuration = Date.now() - overallStart;

  // Print summary
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                           TEST RESULTS SUMMARY                             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  const successfulBatches = results.batches.filter(b => b.success);
  const failedBatches = results.batches.filter(b => !b.success);

  console.log(`Total Batches: ${results.batches.length}`);
  console.log(`✅ Successful: ${successfulBatches.length}`);
  console.log(`❌ Failed: ${failedBatches.length}`);
  console.log(`⏱️  Total Duration: ${(overallDuration / 1000).toFixed(2)}s\n`);

  if (successfulBatches.length > 0) {
    console.log('✅ Successful Batches:');
    successfulBatches.forEach(b => {
      console.log(`   - ${b.name} (${(b.duration / 1000).toFixed(2)}s)`);
    });
    console.log('');
  }

  if (failedBatches.length > 0) {
    console.log('❌ Failed Batches:');
    failedBatches.forEach(b => {
      console.log(`   - ${b.name}`);
      console.log(`     Pattern: ${b.pattern}`);
      if (b.error) {
        console.log(`     Error: ${b.error}`);
      } else {
        console.log(`     Exit Code: ${b.exitCode}`);
      }
    });
    console.log('');
  }

  // Save detailed results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const logDir = path.join(process.cwd(), 'logs', 'test-runs');
  await fs.mkdir(logDir, { recursive: true });

  const logFile = path.join(logDir, `test-run-${timestamp}.json`);
  await fs.writeFile(
    logFile,
    JSON.stringify({ ...results, overallDuration, timestamp: new Date().toISOString() }, null, 2)
  );

  console.log(`📝 Detailed results saved to: ${logFile}\n`);

  // Exit with appropriate code
  const exitCode = failedBatches.length > 0 ? 1 : 0;

  if (exitCode === 0) {
    console.log('✅ All test batches passed!\n');
  } else {
    console.log('❌ Some test batches failed. Review the output above for details.\n');
  }

  process.exit(exitCode);
}

main().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
