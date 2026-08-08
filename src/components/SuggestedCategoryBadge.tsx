import React from 'react';

/** Where the badge is standing: a dense list line, or beside a form label. */
export type SuggestedCategoryBadgeSize = 'row' | 'field';

interface SuggestedCategoryBadgeProps {
  /**
   * Same badge, two densities. In a list it is sized like the tag pills those
   * lists already carry, because a register line is 36–44px tall and its
   * category column also holds the category's own name; beside a form label it
   * is the one the quick-edit panel established.
   */
  size?: SuggestedCategoryBadgeSize;
  /**
   * What the user should do about it HERE. The fact is the same on every
   * surface; the next step is not (a register row is clicked, a form is saved),
   * so the guidance is the caller's to write.
   */
  title: string;
  /** Spacing and alignment belong to the surface; the badge owns its own look. */
  className?: string;
}

const SIZE_CLASSES: Record<SuggestedCategoryBadgeSize, string> = {
  // The size of the pills the register and the transactions table already use
  // for tags, so a marked row reads as part of the list rather than as
  // something bolted onto it.
  row: 'px-1.5 py-0 text-xs',
  field: 'px-1.5 py-0.5 text-[11px]',
};

/**
 * "The app guessed this category, and nobody has agreed with it yet."
 *
 * ── WHY ONE COMPONENT ───────────────────────────────────────────────────────
 * Five surfaces say this — the quick-edit panel, the account register, the
 * phone card list, the transactions table and the full editor — and they have
 * to say it IDENTICALLY. A row that looks suggested in the register and
 * ordinary in the editor is worse than no marker at all, because the user would
 * have to work out which screen is lying. The word, the amber and the
 * screen-reader wording live here so there is only one of each.
 *
 * ── WHY NEVER COLOUR ALONE (WCAG 1.4.1) ─────────────────────────────────────
 * Amber is the colour this app already uses for "this needs your attention"
 * (the uncategorised bar, the Categorisation page). It is a fast signal when
 * scanning a column and no signal at all to someone who cannot separate it from
 * grey, so the word "Suggested" is always present, in text, for everyone —
 * including anyone reading a screenshot in an email.
 *
 * The sr-only clause after it exists because "Suggested" alone, read out
 * immediately after a category name, is ambiguous: it could as easily be the
 * name of a category. Saying "category — not confirmed yet" makes the provenance
 * unmistakable without adding a word to the screen.
 */
export default function SuggestedCategoryBadge({
  size = 'row',
  title,
  className = '',
}: SuggestedCategoryBadgeProps): React.JSX.Element {
  return (
    <>
      <span
        className={`inline-flex items-center flex-shrink-0 rounded font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ${SIZE_CLASSES[size]} ${className}`}
        title={title}
      >
        Suggested
      </span>
      {/* Absolutely positioned by Tailwind's sr-only, so it never disturbs the
          flex or inline layout it sits in. */}
      <span className="sr-only"> category — not confirmed yet</span>
    </>
  );
}
