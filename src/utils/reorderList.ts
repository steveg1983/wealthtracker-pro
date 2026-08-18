/**
 * Move one member of a list to another member's position, preserving every
 * other relative order — the arithmetic behind dragging a Key Account Balance
 * tile onto a new seat (owner, 17 Aug: "like moving an app around on an
 * iPhone screen").
 *
 * Pure and id-based, because the caller persists an ID LIST: the dashboard's
 * chosen accounts are stored as an array of ids, and from this change onward
 * that array's ORDER is the display order.
 */
export function moveToPosition(
  ids: readonly string[],
  movingId: string,
  targetId: string
): string[] {
  if (movingId === targetId) return [...ids];
  const from = ids.indexOf(movingId);
  const to = ids.indexOf(targetId);
  // A member the list does not hold cannot be moved, and moving ONTO one
  // would invent a position — both answer with the list unchanged rather
  // than a throw: a drag that raced a deletion is a no-op, not a crash.
  if (from === -1 || to === -1) return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, movingId);
  return next;
}

/**
 * Move one member a signed number of steps, clamped to the ends — the
 * keyboard's version of the same gesture (Alt+arrows), where "one step" is a
 * neighbouring seat and the grid's own wrap decides what that looks like.
 */
export function moveBySteps(
  ids: readonly string[],
  movingId: string,
  steps: number
): string[] {
  const from = ids.indexOf(movingId);
  if (from === -1 || steps === 0) return [...ids];
  const to = Math.min(ids.length - 1, Math.max(0, from + steps));
  if (to === from) return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, movingId);
  return next;
}
