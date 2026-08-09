/**
 * The mark the register's row editor wears, and the one question everything
 * outside it has to ask about it.
 *
 * ─ WHY THERE IS A MARK AT ALL ──────────────────────────────────────────────
 * The register claims most of the keyboard for itself: Space reconciles the
 * highlighted row, Delete offers to delete it, a bare letter searches for a
 * payee. Every one of those must stand down for the editor — and since the
 * editor became the row ITSELF, its fields are cells of the very grid the
 * register is listening on, so its keys arrive at the register's own handler.
 *
 * ─ WHY IT IS NOT ONE ELEMENT ───────────────────────────────────────────────
 * There is nothing to point at any more. The editor is three cells inside one
 * row and a strip inside the next, and no element holds all four without also
 * holding the rest of the row. So each part carries the mark and the question
 * is asked of the nearest one — which is what closest() is for.
 *
 * The parts, and their values: `date`, `description`, `category` (the cells)
 * and `actions` (the strip). See QuickEditRow, which writes them.
 */

/** Anything wearing the row editor's mark. */
export const QUICK_EDIT_SCOPE_SELECTOR = '[data-quick-edit]';

/**
 * Did this event target — or this focused element — come from inside the row
 * editor?
 *
 * Element rather than HTMLElement: the ×'s target is the <svg> inside it, which
 * is an Element and is NOT an HTMLElement, and a guard that misses it lets
 * Space reconcile the row while the user is pressing the close button.
 */
export function isInsideQuickEdit(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(QUICK_EDIT_SCOPE_SELECTOR) !== null;
}
