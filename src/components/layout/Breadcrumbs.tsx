import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { preserveDemoParam } from '../../utils/navigation';

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  find: 'Find',
  accounts: 'Accounts',
  budget: 'Budget',
  goals: 'Goals',
  investments: 'Investments',
  analytics: 'Analytics',
  'ai-analytics': 'AI Analytics',
  'custom-reports': 'Custom Reports',
  'tax-planning': 'Tax Planning',
  household: 'Household',
  'business-features': 'Business Features',
  'financial-planning': 'Financial Planning',
  'data-intelligence': 'Data Intelligence',
  summaries: 'Summaries',
  settings: 'Settings',
  'app': 'App Settings',
  'data': 'Data Management',
  'categories': 'Categories',
  'tags': 'Tags',
  'security': 'Security',
  'enhanced-import': 'Import Data',
  'export-manager': 'Export Data',
  'documents': 'Documents',
  'open-banking': 'Open Banking',
  'reconciliation': 'Reconciliation'
};

/**
 * Mobile-only back link to the PARENT route. Deliberately not a breadcrumb
 * trail — the trail was removed app-wide as it crowded narrow viewports.
 *
 * ─ WHY IT RENDERS NOTHING ON A TOP-LEVEL PAGE ──────────────────────────────
 * On `/find` this row said "‹ Find", directly above a page title reading
 * "Find", directly above a nav bar whose middle tab reads "Find" — three in
 * about 250px of a 812px screen, of which this row spent ~60px
 * (PHONE_CAPTURES_REVIEW_2026-08-13 §3.4).
 *
 * The repetition was a symptom of something worse: the row was labelled with
 * the page you are ON and linked to the page you would GO to. On `/find` that
 * is a control saying "Find" which takes you to the Dashboard. So on a
 * top-level route it was simultaneously the title again and a mis-signed exit,
 * and the honest back affordance is the one already on screen — the bottom nav
 * reaches every top-level route, and the OS edge gesture reaches the last one.
 *
 * ─ WHY IT STILL RENDERS ON A NESTED ONE ────────────────────────────────────
 * "Drop it on mobile" would take the row out everywhere, because `sm:hidden`
 * means mobile is the only place it has ever rendered. But `/settings/tags`
 * has no tab in the bottom nav (Home · Accounts · Find · Reconcile ·
 * Categorise), so up-one-level is genuinely unreachable there without this.
 * The rule that keeps both facts is therefore about DEPTH, not width: a route
 * with one segment repeats the title and is covered by the nav; a route with
 * two or more has a parent worth a control.
 *
 * And the surviving row now names its DESTINATION — "‹ Settings" from
 * `/settings/tags`, "‹ Accounts" from an account register — so it no longer
 * repeats the title of the page it sits on, which was the finding.
 */
/**
 * Nested pages that draw their OWN back control ("← Back to Accounts" on an
 * account register, "← All reports" on a report) — rendering this row above
 * them put two back buttons in the first 120px of a phone screen, saying the
 * same thing in different words (owner, 26 Aug, item 7). The page's own
 * control wins: it can say more (provenance-aware labels like "Back to
 * report") than a path segment ever could. Keyed by PARENT segment, so
 * /settings/* — whose subpages have no back of their own — keeps this row.
 */
const PARENTS_WITH_OWN_BACK = new Set(['accounts', 'reports']);

export function MobileBreadcrumb() {
  const location = useLocation();
  const { accounts } = useApp();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Home, and every top-level page: the bottom nav is the affordance.
  if (pathSegments.length < 2) {
    return null;
  }

  const parentPath = `/${pathSegments.slice(0, -1).join('/')}`;
  const parentSegment = pathSegments[pathSegments.length - 2];

  if (PARENTS_WITH_OWN_BACK.has(parentSegment)) {
    return null;
  }
  // A route nested under a single account names that account, not its id.
  const matchedAccount = accounts.find(a => a.id === parentSegment);
  const label = matchedAccount
    ? matchedAccount.name
    : routeLabels[parentSegment] || parentSegment.charAt(0).toUpperCase() + parentSegment.slice(1);

  return (
    <div className="sm:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <Link
        to={preserveDemoParam(parentPath, location.search)}
        aria-label={`Back to ${label}`}
        className="flex items-center gap-2 text-primary dark:text-primary-light"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm font-medium">{label}</span>
      </Link>
    </div>
  );
}
