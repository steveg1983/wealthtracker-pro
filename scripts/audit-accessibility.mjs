#!/usr/bin/env node
/**
 * Accessibility audit — axe-core (WCAG 2.1 A/AA) across every routed page.
 *
 * Runs against a local dev server in demo mode (?demo=true bypasses Clerk and
 * seeds sample data, so authenticated pages render with realistic content).
 * Real browser rendering, so color-contrast checks are valid.
 *
 * Usage:
 *   npm run dev            # in another terminal (or already running)
 *   node scripts/audit-accessibility.mjs [--base=http://localhost:5173]
 *
 * Report: logs/accessibility/<timestamp>_audit.json + latest.json
 * Exit 2 when serious/critical violations exist.
 */

import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const baseArg = process.argv.find((a) => a.startsWith('--base='));
const BASE = baseArg ? baseArg.split('=')[1] : 'http://localhost:5173';

const ROUTES = [
  '/login',
  '/dashboard',
  '/accounts',
  '/transactions',
  '/reconciliation',
  '/investments',
  '/budget',
  '/calendar',
  '/reports',
  '/goals',
  '/analytics',
  '/custom-reports',
  '/summaries',
  '/export-manager',
  '/enhanced-import',
  '/documents',
  '/subscription',
  '/settings',
  '/settings/app',
  '/settings/data',
  '/settings/categories',
  '/settings/tags',
  '/settings/notifications',
  '/settings/accessibility',
  '/settings/security',
  '/settings/deleted-accounts'
];

const main = async () => {
  console.log(`── Accessibility audit (axe-core, WCAG 2.1 A/AA) ──`);
  console.log(`Base: ${BASE} (demo mode)\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];
  let totalViolations = 0;
  let seriousOrCritical = 0;

  for (const route of ROUTES) {
    const url = `${BASE}${route}?demo=true`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      // Allow lazy chunks + charts to settle.
      await page.waitForTimeout(1500);

      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const violations = axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.length,
        sampleTargets: v.nodes.slice(0, 3).map((n) => n.target.join(' '))
      }));

      const sc = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      totalViolations += violations.length;
      seriousOrCritical += sc.length;

      const flag = sc.length > 0 ? '✗' : violations.length > 0 ? '△' : '✓';
      console.log(`${flag} ${route.padEnd(30)} ${violations.length} violation type(s)${sc.length ? ` — ${sc.length} serious/critical` : ''}`);
      for (const v of violations) {
        console.log(`    [${(v.impact ?? '?').padEnd(8)}] ${v.id}: ${v.help} (${v.nodes} node${v.nodes === 1 ? '' : 's'})`);
      }

      results.push({ route, violations, passes: axe.passes.length });
    } catch (err) {
      console.log(`! ${route.padEnd(30)} FAILED TO AUDIT: ${err.message.split('\n')[0]}`);
      results.push({ route, error: err.message.split('\n')[0] });
    }
  }

  await browser.close();

  const report = {
    auditedAt: new Date().toISOString(),
    base: BASE,
    standard: 'WCAG 2.1 A/AA (axe-core)',
    routes: results.length,
    totalViolationTypes: totalViolations,
    seriousOrCritical,
    results
  };
  mkdirSync('logs/accessibility', { recursive: true });
  const file = path.join('logs/accessibility', `${report.auditedAt.replace(/[:.]/g, '-')}_audit.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  writeFileSync('logs/accessibility/latest.json', JSON.stringify(report, null, 2));

  console.log(`\nTotal violation types across routes: ${totalViolations} (${seriousOrCritical} serious/critical)`);
  console.log(`Report: ${file}`);

  if (seriousOrCritical > 0) process.exit(2);
};

main().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
