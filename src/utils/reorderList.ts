/**
 * Swap two members' seats, leaving everyone else exactly where they were —
 * the arithmetic behind dragging a Key Account Balance tile (owner, 18 Aug:
 * "whatever other account I am hovering over slips into the position I have
 * just left — but that only gets confirmed once I let go").
 *
 * A SWAP, deliberately not an insertion. The first cut re-seated the list
 * live as the pointer crossed each tile, so dragging top-right to
 * bottom-left displaced every tile crossed on the way — "it is too easy to
 * move the wrong one". The caller now previews `swapPositions(preDragOrder,
 * dragged, hovered)` — always computed from the order the drag STARTED from,
 * never cumulatively — and commits only on release.
 *
 * Pure and id-based, because the caller persists an ID LIST: the dashboard's
 * chosen accounts are stored as an array of ids, and that array's order is
 * the display order.
 */
export function swapPositions(
  ids: readonly string[],
  aId: string,
  bId: string
): string[] {
  const next = [...ids];
  if (aId === bId) return next;
  const a = ids.indexOf(aId);
  const b = ids.indexOf(bId);
  // A member the list does not hold has no seat to swap — a drag that raced
  // a deletion is a no-op, not a crash.
  if (a === -1 || b === -1) return next;
  next[a] = bId;
  next[b] = aId;
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
