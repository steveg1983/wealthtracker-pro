import type { AIServices, ExplainContext, ExplainResponse } from './types';

// Lightweight, on-device adapter. No network calls.
// Generates helpful, static-but-contextual explanations.

function explainForRoute(ctx: ExplainContext): ExplainResponse {
  const route = ctx.route || '/';
  const title = ctx.title || 'This Page';

  const base: ExplainResponse = {
    title: `About ${title}`,
    markdown: `WealthTracker helps you manage accounts, transactions, budgets and goals.

Here are useful pointers for this view:

- Navigation: Use Ctrl+K to search globally, '/' to focus search, and '?' for keyboard shortcuts.
- Data Safety: Money amounts use precise math (no floating-point) and XSS-protected inputs.
- Offline: Works offline; changes sync when online.
`,
    sources: [
      { label: 'User docs plan', path: 'USER_DOCUMENTATION_PLAN.md:1' },
      { label: 'CLAUDE.md (dev guide)', path: 'CLAUDE.md:1' }
    ]
  };

  const sections: Record<string, string> = {
    '/dashboard': `- Dashboard: High-level net worth, budgets, and trends. Click cards for drill-down.\n- Tip: Use the filter bar to narrow the time range.`,
    '/transactions': `- Transactions: Add, edit, and categorize.\n- Smart Categorization: Use AI suggestions and bulk apply with a confidence threshold.\n- Shortcuts: 'n t' for new transaction.`,
    '/reconciliation': `- Reconciliation: Match account statements with your ledger.\n- Mark as cleared when it appears on bank statements.`,
    '/budget': `- Budget: Set monthly limits per category.\n- Recommendations: AI suggests category budgets based on history and seasonality.`,
    '/goals': `- Goals: Set savings targets and track progress.\n- Link to accounts for automatic updates.`,
    '/analytics': `- Analytics: Explore trends by category, merchant, and time.\n- Export charts or data for reporting.`,
    '/ai-features': `- AI Features: Smart Categorization, Anomaly Detection, Budget Recommendations.\n- Start by re-learning patterns from existing transactions, then auto-categorize with a confidence threshold.`,
    '/ocr-test': `- Receipt OCR: Upload an image to extract merchant, date, and totals.\n- Then match to a transaction and apply suggested category.`
  };

  const match = Object.keys(sections).find(key => route.startsWith(key));
  if (match) {
    base.markdown += `\n\n${sections[match]}`;
  }

  // Add tiny dynamic signal rendering if provided
  if (ctx.signals && Object.keys(ctx.signals).length > 0) {
    base.markdown += `\n\nContext:\n` + Object.entries(ctx.signals)
      .map(([k, v]) => `- ${k}: ${String(v)}`)
      .join('\n');
  }

  return base;
}

export const localAdapter: AIServices = {
  async explainPage(ctx: ExplainContext): Promise<ExplainResponse> {
    return explainForRoute(ctx);
  }
};

