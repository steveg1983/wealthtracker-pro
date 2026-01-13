#!/usr/bin/env node

/**
 * Financial Code Safety Auditor
 *
 * Scans for violations of WealthTracker financial software standards:
 * - parseFloat usage in financial code
 * - Missing Decimal.js usage
 * - "as any" casts in financial services
 * - toFixed without proper Decimal.js
 *
 * Enforces RULE #4 and Financial Software Standards from CLAUDE.md
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const FINANCIAL_PATHS = [
  'src/services',
  'src/utils/financial',
  'src/components/widgets',
  'src/store/slices'
];

const VIOLATIONS = {
  parseFloat: {
    pattern: 'parseFloat',
    severity: 'CRITICAL',
    message: 'parseFloat() usage detected - financial calculations MUST use Decimal.js'
  },
  asAny: {
    pattern: 'as any',
    severity: 'CRITICAL',
    message: '"as any" cast detected - violates RULE #4: ABSOLUTE TYPE SAFETY'
  },
  toFixed: {
    pattern: '\\.toFixed\\(',
    severity: 'WARNING',
    message: 'toFixed() usage - verify this is display-only, not calculation'
  },
  Number: {
    pattern: 'Number\\(',
    severity: 'WARNING',
    message: 'Number() conversion - verify not used in financial calculations'
  }
};

let exitCode = 0;
const results = {
  critical: [],
  warnings: [],
  clean: []
};

console.log('🔍 WealthTracker Financial Safety Audit\n');
console.log('Scanning paths:', FINANCIAL_PATHS.join(', '));
console.log('─'.repeat(70));

for (const [name, config] of Object.entries(VIOLATIONS)) {
  console.log(`\n${config.severity === 'CRITICAL' ? '🚨' : '⚠️'}  Checking for: ${name}`);

  for (const path of FINANCIAL_PATHS) {
    const fullPath = resolve(process.cwd(), path);

    if (!existsSync(fullPath)) {
      continue;
    }

    try {
      // Use grep to search for violations
      const cmd = `grep -rn --include="*.ts" --include="*.tsx" "${config.pattern}" ${fullPath} || true`;
      const output = execSync(cmd, { encoding: 'utf8' });

      if (output.trim()) {
        const matches = output.trim().split('\n');
        const entry = {
          violation: name,
          severity: config.severity,
          message: config.message,
          matches: matches
        };

        if (config.severity === 'CRITICAL') {
          results.critical.push(entry);
          exitCode = 1;
        } else {
          results.warnings.push(entry);
        }

        console.log(`  ${config.severity === 'CRITICAL' ? '❌' : '⚠️'}  Found ${matches.length} occurrence(s) in ${path}`);

        // Show first few matches
        matches.slice(0, 3).forEach(match => {
          console.log(`      ${match.split(':').slice(0, 2).join(':')}`);
        });

        if (matches.length > 3) {
          console.log(`      ... and ${matches.length - 3} more`);
        }
      } else {
        console.log(`  ✅ Clean in ${path}`);
        results.clean.push({ violation: name, path });
      }
    } catch (error) {
      // grep returns exit code 1 when no matches found, which is good
      if (error.status === 1 && !error.stdout) {
        console.log(`  ✅ Clean in ${path}`);
        results.clean.push({ violation: name, path });
      } else {
        console.error(`  ⚠️  Error scanning ${path}:`, error.message);
      }
    }
  }
}

console.log('\n' + '═'.repeat(70));
console.log('📊 AUDIT SUMMARY\n');

if (results.critical.length > 0) {
  console.log(`🚨 CRITICAL VIOLATIONS: ${results.critical.length}`);
  console.log('   These MUST be fixed before any commit/deploy');
  console.log('   See CLAUDE.md RULE #4 and Financial Software Standards\n');
}

if (results.warnings.length > 0) {
  console.log(`⚠️  WARNINGS: ${results.warnings.length}`);
  console.log('   Review these - may need correction\n');
}

if (results.clean.length > 0 && results.critical.length === 0 && results.warnings.length === 0) {
  console.log('✅ ALL CHECKS PASSED');
  console.log('   Financial code meets safety standards');
}

console.log('═'.repeat(70));

if (exitCode !== 0) {
  console.log('\n❌ AUDIT FAILED - Fix critical violations before proceeding');
  process.exit(1);
} else {
  console.log('\n✅ Financial safety audit passed');
  process.exit(0);
}
