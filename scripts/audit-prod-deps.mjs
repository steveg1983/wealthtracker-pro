/**
 * The production dependency audit, with a place to stand exceptions.
 *
 * `npm audit --audit-level=high` is the right gate and has no ignore
 * mechanism, so the first unreachable advisory forces a choice between a
 * broken pipeline and `|| true` — and `|| true` is how gates die. This wraps
 * the same audit and fails on exactly what npm would fail on, MINUS an
 * explicit allowlist where every entry must say why the vulnerability cannot
 * reach this app and when the exception expires. An expired entry fails the
 * build as loudly as the advisory itself would — an exception nobody
 * re-examines is just a hole with paperwork.
 */
import { execSync } from 'node:child_process';

/**
 * Shape of an entry: `{ id: 'GHSA-…', reason: 'why it cannot reach this app',
 * reviewBy: 'YYYY-MM-DD' }`. Empty since 2 Oct 2026: the one exception
 * (GHSA-qwww-vcr4-c8h2, React Router RSC-mode CSRF, review due 2026-10-01)
 * was retired on its review date because the lockfile had moved to
 * react-router 7.18.2 — the patched version — and the advisory no longer
 * appears in the audit at all. An expired entry fails the build (below), and
 * that is what made this one get looked at.
 */
const ALLOWLIST = [];

const today = new Date().toISOString().slice(0, 10);
const expired = ALLOWLIST.filter(e => e.reviewBy <= today);
if (expired.length > 0) {
  console.error('Audit exceptions past their review date — re-justify or fix:');
  for (const e of expired) console.error(`  ${e.id} (review was due ${e.reviewBy})`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(execSync('npm audit --omit=dev --json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
} catch (error) {
  // npm audit exits non-zero when vulnerabilities exist; the JSON is still on stdout.
  if (!error.stdout) throw error;
  report = JSON.parse(error.stdout);
}

const allowed = new Set(ALLOWLIST.map(e => e.id));
const failures = [];
for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  if (vuln.severity !== 'high' && vuln.severity !== 'critical') continue;
  // `via` mixes advisory objects (direct) and package-name strings (transitive
  // — those packages have their own entries and are judged there).
  const advisories = vuln.via.filter(v => typeof v === 'object');
  const unallowed = advisories.filter(a => {
    const id = (a.url ?? '').split('/').pop() ?? '';
    return !allowed.has(id);
  });
  if (advisories.length > 0 && unallowed.length === 0) {
    console.log(`allowed: ${name} (${advisories.map(a => (a.url ?? '').split('/').pop()).join(', ')})`);
    continue;
  }
  if (unallowed.length > 0) {
    failures.push({ name, severity: vuln.severity, advisories: unallowed });
  }
}

if (failures.length > 0) {
  console.error('\nHigh/critical production vulnerabilities NOT covered by an exception:');
  for (const f of failures) {
    console.error(`  ${f.name} [${f.severity}]`);
    for (const a of f.advisories) console.error(`    ${a.title} — ${a.url}`);
  }
  process.exit(1);
}

console.log('Production dependency audit clean (allowlist applied).');
