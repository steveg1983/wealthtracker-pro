#!/usr/bin/env node

/**
 * Type Safety Auditor
 *
 * Scans entire codebase for type safety violations:
 * - "as any" casts
 * - "@ts-ignore" comments
 * - "@ts-nocheck" comments
 * - "as unknown as" double casts
 *
 * Enforces RULE #4: ABSOLUTE TYPE SAFETY from CLAUDE.md
 *
 * Current baseline: 3,901 "as any" violations (BLOCKER #2)
 * Target: ZERO violations for enterprise-ready status
 */

import { execSync } from 'child_process';
import { resolve } from 'path';

const VIOLATIONS = {
  'as any': {
    pattern: 'as any',
    severity: 'CRITICAL',
    blocker: true,
    message: 'Type assertion to "any" - completely bypasses type safety'
  },
  '@ts-ignore': {
    pattern: '@ts-ignore',
    severity: 'CRITICAL',
    blocker: true,
    message: 'TypeScript error suppression - hides real type errors'
  },
  '@ts-nocheck': {
    pattern: '@ts-nocheck',
    severity: 'CRITICAL',
    blocker: true,
    message: 'Disables type checking for entire file'
  },
  'as unknown as': {
    pattern: 'as unknown as',
    severity: 'HIGH',
    blocker: true,
    message: 'Double cast through unknown - indicates type system abuse'
  },
  '// @ts-expect-error': {
    pattern: '@ts-expect-error',
    severity: 'MEDIUM',
    blocker: false,
    message: 'Expected error - verify this is still needed'
  }
};

const SRC_PATHS = ['src'];
const EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.backup',
  '*.test.ts',
  '*.test.tsx'
];

let exitCode = 0;
const results = {
  blockers: [],
  warnings: [],
  total: 0
};

console.log('🔒 WealthTracker Type Safety Audit');
console.log('Enforcing RULE #4: ABSOLUTE TYPE SAFETY - ZERO "AS ANY" TOLERANCE\n');
console.log('Scanning: src/');
console.log('═'.repeat(70));

for (const [name, config] of Object.entries(VIOLATIONS)) {
  console.log(`\n${config.blocker ? '🚨' : '⚠️'}  Scanning for: ${name}`);

  try {
    const excludeArgs = EXCLUDE_PATTERNS.map(p => `--exclude-dir="${p}"`).join(' ');
    const cmd = `grep -rn --include="*.ts" --include="*.tsx" ${excludeArgs} "${config.pattern}" src/ || true`;
    const output = execSync(cmd, { encoding: 'utf8', cwd: process.cwd() });

    if (output.trim()) {
      const matches = output.trim().split('\n').filter(line => line.trim());
      const count = matches.length;
      results.total += count;

      const entry = {
        violation: name,
        severity: config.severity,
        count,
        matches: matches.slice(0, 5) // Show first 5
      };

      if (config.blocker) {
        results.blockers.push(entry);
        exitCode = 1;
        console.log(`  ❌ Found ${count} violation(s) - ENTERPRISE BLOCKER`);
      } else {
        results.warnings.push(entry);
        console.log(`  ⚠️  Found ${count} occurrence(s) - needs review`);
      }

      // Show sample violations
      console.log(`\n  Sample locations (showing max 5):`);
      matches.slice(0, 5).forEach(match => {
        const [file, ...rest] = match.split(':');
        const lineNum = rest[0];
        const relativePath = file.replace(process.cwd() + '/', '');
        console.log(`    • ${relativePath}:${lineNum}`);
      });

      if (count > 5) {
        console.log(`    ... and ${count - 5} more\n`);
      }
    } else {
      console.log(`  ✅ No violations found`);
    }
  } catch (error) {
    if (error.status === 1 && !error.stdout) {
      console.log(`  ✅ No violations found`);
    } else {
      console.error(`  ⚠️  Error scanning:`, error.message);
    }
  }
}

console.log('\n' + '═'.repeat(70));
console.log('📊 TYPE SAFETY AUDIT SUMMARY\n');

if (results.blockers.length > 0) {
  console.log(`🚨 ENTERPRISE BLOCKERS FOUND: ${results.blockers.length} types`);
  console.log(`   Total blocking violations: ${results.blockers.reduce((sum, b) => sum + b.count, 0)}`);
  console.log('\n   ⚠️  CRITICAL: These violations prevent enterprise deployment');
  console.log('   See CLAUDE.md RULE #4 for remediation guidelines:\n');
  console.log('   1. Create proper type definitions');
  console.log('   2. Use type guards for runtime checks');
  console.log('   3. Use unknown + type narrowing (NOT casting to any)');
  console.log('   4. Ask for help if stuck on complex types');
  console.log('   5. Refactor code if it cannot be properly typed\n');

  console.log('   Current baseline: 3,901 "as any" violations');
  console.log('   Target: ZERO for enterprise-ready status');
}

if (results.warnings.length > 0) {
  console.log(`\n⚠️  WARNINGS: ${results.warnings.length} types`);
  console.log(`   Total warning items: ${results.warnings.reduce((sum, w) => sum + w.count, 0)}`);
  console.log('   Review and eliminate where possible');
}

if (results.total === 0) {
  console.log('✅ PERFECT TYPE SAFETY - ZERO VIOLATIONS');
  console.log('   Codebase meets Apple/Google/Microsoft standards');
  console.log('   Ready for enterprise deployment');
}

console.log('\n' + '═'.repeat(70));

if (exitCode !== 0) {
  console.log('\n❌ TYPE SAFETY AUDIT FAILED');
  console.log('   Fix violations before committing');
  console.log('   This is an enterprise blocker per CLAUDE.md RULE #4\n');
  process.exit(1);
} else {
  console.log('\n✅ Type safety audit passed (warnings may exist)\n');
  process.exit(0);
}
