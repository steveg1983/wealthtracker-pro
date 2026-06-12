#!/usr/bin/env node
/**
 * Large-dataset stress test — how the app behaves with 10,000 transactions.
 *
 * Context: getTransactions now pages through the FULL history (the silent
 * 1000-row truncation was a P1 fix), so a long-lived account WILL hold
 * thousands of rows in context state. This measures what that costs:
 *   - initial render time of /transactions
 *   - whether the list virtualises or renders 10k DOM nodes
 *   - main-thread blocking while typing in the search box (INP proxy)
 *
 * Usage: npx vite preview --port 4173 &  then  node scripts/audit-performance-stress.mjs
 */

import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4173';
const TXN_COUNT = 10_000;

const CATEGORIES = ['groceries', 'restaurants', 'fuel', 'salary', 'rent', 'electricity', 'subscriptions', 'clothing'];
const DESCRIPTIONS = ['Tesco', 'Sainsburys', 'Shell Garage', 'Acme Payroll', 'Landlord Ltd', 'EDF Energy', 'Netflix', 'Next Retail'];

const makeTransactions = () => {
  const txns = [];
  const start = new Date('2023-01-01').getTime();
  const span = new Date('2026-06-01').getTime() - start;
  for (let i = 0; i < TXN_COUNT; i++) {
    const isIncome = i % 12 === 0;
    const date = new Date(start + (span * i) / TXN_COUNT);
    txns.push({
      id: `stress-${i}`,
      accountId: i % 3 === 0 ? 'demo-acc-1' : i % 3 === 1 ? 'demo-acc-2' : 'demo-acc-3',
      amount: isIncome ? 2500 : -(10 + (i % 90) + (i % 100) / 100),
      type: isIncome ? 'income' : 'expense',
      category: CATEGORIES[i % CATEGORIES.length],
      description: `${DESCRIPTIONS[i % DESCRIPTIONS.length]} ${i}`,
      date: date.toISOString().slice(0, 10),
      cleared: i % 2 === 0
    });
  }
  return txns.sort((a, b) => b.date.localeCompare(a.date));
};

const ACCOUNTS = [
  { id: 'demo-acc-1', name: 'Stress Current', type: 'current', balance: 5000, currency: 'GBP', institution: 'Stress Bank', lastUpdated: new Date().toISOString() },
  { id: 'demo-acc-2', name: 'Stress Savings', type: 'savings', balance: 20000, currency: 'GBP', institution: 'Stress Bank', lastUpdated: new Date().toISOString() },
  { id: 'demo-acc-3', name: 'Stress Credit', type: 'credit', balance: -1500, currency: 'GBP', institution: 'Stress Bank', lastUpdated: new Date().toISOString() }
];

const main = async () => {
  console.log(`── Performance stress test: ${TXN_COUNT.toLocaleString()} transactions ──\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const transactions = makeTransactions();
  await page.addInitScript(({ txns, accounts }) => {
    localStorage.setItem('demoMode', 'true');
    // wealthtracker_-prefixed keys: storageAdapter migrates these into the
    // encrypted IndexedDB store on first init — the app's real read path.
    localStorage.setItem('wealthtracker_accounts', JSON.stringify(accounts));
    localStorage.setItem('wealthtracker_transactions', JSON.stringify(txns));
    localStorage.setItem('wealthtracker_budgets', JSON.stringify([]));
    localStorage.setItem('wealthtracker_goals', JSON.stringify([]));
    localStorage.setItem('onboardingCompleted', 'true');
    localStorage.setItem('testDataWarningDismissed', 'true');
    // Long-task collector for blocking measurements
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__longTasks.push({ start: e.startTime, dur: e.duration });
    }).observe({ entryTypes: ['longtask'] });
  }, { txns: transactions, accounts: ACCOUNTS });

  // ── Initial render ──
  const t0 = Date.now();
  await page.goto(`${BASE}/transactions?demo=true`, { waitUntil: 'networkidle' });
  await page.waitForSelector('table tbody tr, [data-testid="transaction-row"], [role="row"]', { timeout: 30000 }).catch(() => {});
  const renderMs = Date.now() - t0;

  await page.waitForTimeout(2000);

  const domStats = await page.evaluate(() => ({
    totalNodes: document.querySelectorAll('*').length,
    rows: document.querySelectorAll('table tbody tr, [data-testid="transaction-row"]').length,
    bootLongTasks: window.__longTasks.length,
    bootBlockedMs: Math.round(window.__longTasks.reduce((s, t) => s + t.dur, 0))
  }));

  console.log(`Initial load+render:        ${renderMs} ms`);
  console.log(`Rendered transaction rows:  ${domStats.rows} ${domStats.rows < 200 ? '(virtualised/paginated ✓)' : domStats.rows >= TXN_COUNT * 0.9 ? '(ALL ROWS IN DOM ✗)' : ''}`);
  console.log(`Total DOM nodes:            ${domStats.totalNodes.toLocaleString()}`);
  console.log(`Boot long tasks:            ${domStats.bootLongTasks} (${domStats.bootBlockedMs} ms blocked)`);

  // ── Search typing responsiveness ──
  // Remove the fixed test-mode banner that intercepts pointer events.
  await page.evaluate(() => {
    document.querySelectorAll('.fixed.top-0').forEach((el) => el.remove());
    window.__longTasks = [];
  });
  const search = page.locator('input[type="search"], input[placeholder*="earch"]').first();
  const hasSearch = await search.count() > 0;
  if (hasSearch) {
    const tType = Date.now();
    await search.click();
    await search.pressSequentially('tesco 42', { delay: 60 });
    await page.waitForTimeout(800);
    const typeMs = Date.now() - tType;
    const typing = await page.evaluate(() => ({
      tasks: window.__longTasks.length,
      blockedMs: Math.round(window.__longTasks.reduce((s, t) => s + t.dur, 0)),
      worstMs: Math.round(Math.max(0, ...window.__longTasks.map(t => t.dur)))
    }));
    console.log(`\nSearch typing (8 chars):    ${typeMs} ms wall`);
    console.log(`Long tasks while typing:    ${typing.tasks} (${typing.blockedMs} ms blocked, worst ${typing.worstMs} ms)`);
    if (typing.worstMs > 200) console.log('  ✗ worst task >200ms — visible input jank (INP fail territory)');
    else if (typing.worstMs > 50) console.log('  △ tasks 50–200ms — measurable but tolerable');
    else console.log('  ✓ no significant blocking');
  } else {
    console.log('\n(no search input found on /transactions)');
  }

  // ── Dashboard with 10k txns (the Decimal metric sums run over all of them) ──
  await page.evaluate(() => { window.__longTasks = []; });
  const tDash = Date.now();
  await page.goto(`${BASE}/dashboard?demo=true`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const dashMs = Date.now() - tDash;
  const dash = await page.evaluate(() => ({
    tasks: window.__longTasks.length,
    blockedMs: Math.round(window.__longTasks.reduce((s, t) => s + t.dur, 0)),
    worstMs: Math.round(Math.max(0, ...window.__longTasks.map(t => t.dur)))
  }));
  console.log(`\nDashboard load (10k txns):  ${dashMs} ms wall, ${dash.tasks} long tasks (${dash.blockedMs} ms blocked, worst ${dash.worstMs} ms)`);

  await browser.close();
};

main().catch((err) => {
  console.error('Stress test failed:', err.message);
  process.exit(1);
});
