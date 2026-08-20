/**
 * THE DEPTH LADDER — one rule for every drill-down surface (owner, 20 Aug):
 *
 *   "across the board … the account group headings, there should be a shade
 *    darker grey, then for the institution (level down), the grey we have,
 *    and then the accounts, just plain white background. I think this ethos
 *    should go through the app. Wherever there are 'drill downs', the lowest
 *    is white, the next up is the grey you see, the next up is a darker
 *    shade."
 *
 * So: LEVEL 1 (outermost heading) wears the darker grey, LEVEL 2 (the tier
 * beneath) the lighter grey, and leaf rows the surface itself — no token,
 * because absence of a band IS the third step. Light greys come from the
 * house surface scale (tailwind.config.js); dark mode steps gray-700 →
 * gray-700/50 → gray-800 to keep the same three-rung read.
 *
 * `DEPTH_LEVEL_2_STICKY` exists for sticky table cells, which must be OPAQUE
 * (columns scroll beneath them): it is the literal blend of gray-700/50 over
 * gray-800, so a sticky first column matches its translucent row exactly.
 */
export const DEPTH_LEVEL_1 = 'bg-surface-tertiary dark:bg-gray-700';
export const DEPTH_LEVEL_2 = 'bg-surface-secondary dark:bg-gray-700/50';
export const DEPTH_LEVEL_2_STICKY = 'bg-surface-secondary dark:bg-[#2b3544]';
