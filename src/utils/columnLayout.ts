/**
 * Pure helpers for a drag-controlled, persisted table column layout.
 * Kept separate from the register component so the ordering logic is testable
 * without simulating drag-and-drop.
 */

/**
 * Order the base column keys by a saved preference, appending any columns the
 * saved order doesn't mention. This means added/removed columns can never
 * corrupt a persisted layout — unknown saved keys are dropped, new base keys
 * are appended in their default position.
 */
export function orderColumnKeys(baseKeys: string[], saved: string[]): string[] {
  const known = new Set(baseKeys);
  const ordered = saved.filter(key => known.has(key));
  const orderedSet = new Set(ordered);
  return [...ordered, ...baseKeys.filter(key => !orderedSet.has(key))];
}

/**
 * Move `fromKey` to sit immediately before `toKey`. No-op (returns the input)
 * if either key is missing or they're the same.
 */
export function moveColumnKey(order: string[], fromKey: string, toKey: string): string[] {
  if (fromKey === toKey || !order.includes(fromKey) || !order.includes(toKey)) {
    return order;
  }
  const withoutFrom = order.filter(key => key !== fromKey);
  const targetIndex = withoutFrom.indexOf(toKey);
  withoutFrom.splice(targetIndex, 0, fromKey);
  return withoutFrom;
}
