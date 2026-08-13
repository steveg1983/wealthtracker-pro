import React, { useId, useMemo, useState } from 'react';
import type { BankTemplate, BankTemplateRegion } from '../services/enhancedCsvImportService';
import {
  BANK_TEMPLATE_REGIONS,
  enhancedCsvImportService
} from '../services/enhancedCsvImportService';

interface CSVBankTemplatesProps {
  /** The template already applied, so the list can show which one it was. */
  selectedId?: string | null;
  onSelectBank: (template: BankTemplate) => void;
}

/**
 * "Which bank is this from?" — a PREFILL, offered second.
 *
 * ── WHAT THIS USED TO BE, AND WHY IT READ AS BROKEN ─────────────────────────
 * Forty-one bank buttons in a two-column grid, below the drop zone, inside a
 * vertically-CENTRED flex column. Centred content that overflows its scroll
 * container overflows in both directions, and the half above the scroll origin
 * cannot be scrolled to — so on a laptop the drop zone was pushed off the top
 * of the dialog and the first thing the user saw, with no way to reach the file
 * picker at all, was a wall of bank names. Choosing one jumped straight to
 * Column Mapping WITHOUT A FILE, where the dropdowns had no columns to offer
 * because no file had been read.
 *
 * And half the buttons did nothing even then: they were a hand-typed list of
 * names looked up by `name.toLowerCase()` against the service's ids, and twenty
 * of them — MBNA, Amex, Bank of America, Chase UK, Metro Bank, Tesco Bank —
 * matched no id, so they applied an empty mapping. The list now comes FROM the
 * service, so what is offered is what exists.
 *
 * ── WHAT IT IS NOW ──────────────────────────────────────────────────────────
 * A search box and a scrolling list, secondary to the file. Picking one does
 * not navigate anywhere: it fills in column names, which is all it ever did.
 * Each entry shows the columns it expects, so the user can compare them with
 * the file in front of them — a bank can change its export at any time and this
 * app will not have heard.
 */
export default function CSVBankTemplates({
  selectedId,
  onSelectBank
}: CSVBankTemplatesProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const searchId = useId();

  const templates = useMemo(() => enhancedCsvImportService.listBankTemplates(), []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter(template => {
      if (template.label.toLowerCase().includes(needle)) return true;
      // Searching by a column name is how somebody with an unfamiliar export
      // finds a format that matches it — "paid out" finds the UK two-column
      // banks.
      return template.mappings.some(mapping =>
        mapping.sourceColumn.toLowerCase().includes(needle)
      );
    });
  }, [query, templates]);

  const byRegion = useMemo(() => {
    const groups = new Map<BankTemplateRegion, BankTemplate[]>();
    for (const template of matches) {
      const existing = groups.get(template.region);
      if (existing) existing.push(template);
      else groups.set(template.region, [template]);
    }
    return BANK_TEMPLATE_REGIONS.filter(region => groups.has(region)).map(region => ({
      region,
      templates: groups.get(region) ?? []
    }));
  }, [matches]);

  return (
    <div className="w-full">
      <label
        htmlFor={searchId}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        Search {templates.length} bank formats
      </label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Barclays, Monzo, Wells Fargo, &quot;paid out&quot;…"
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-transparent dark:bg-gray-700 dark:text-white"
      />

      {matches.length === 0 ? (
        // The consequence, not the count: an unlisted bank costs nothing,
        // because the next step reads the file's own headings either way.
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          No format here matches &ldquo;{query.trim()}&rdquo;. You don&apos;t need one — the next
          step reads the column headings out of your file and fills in what it recognises.
        </p>
      ) : (
        <div className="mt-3 max-h-64 overflow-y-auto pr-1">
          {byRegion.map(({ region, templates: group }) => (
            <div key={region} className="mb-3">
              <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 sticky top-0 bg-white dark:bg-gray-800 py-1">
                {region}
              </h5>
              <ul className="space-y-1">
                {group.map(template => {
                  const isSelected = template.id === selectedId;
                  return (
                    <li key={template.id}>
                      <button
                        type="button"
                        // aria-pressed rather than a tick alone: a screen reader
                        // hears which format is applied without having to find
                        // the banner further up the step.
                        aria-pressed={isSelected}
                        onClick={() => onSelectBank(template)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <span className="block text-sm text-gray-900 dark:text-white">
                          {template.label}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                          {template.mappings.map(mapping => mapping.sourceColumn).join(' · ')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
