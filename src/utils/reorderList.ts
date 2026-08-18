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
 * What a drag's preview should do, given which tile is under the pointer —
 * the ANTI-JUDDER rule, pure so it can be pinned without a laid-out grid.
 *
 * The flap it exists to prevent (owner, 18 Aug: "the highlight quickly jumps
 * back and forth between the moved from and the moved to"): previewing a
 * swap moves the DRAGGED tile into the seat under the pointer, so the next
 * pointer move finds the dragged tile there; treating that as "no target"
 * cleared the preview, which put the target back under the pointer, which
 * swapped again — every frame.
 *
 * Three stable answers instead:
 *  - the dragged tile, or no tile at all (a grid gap), is the current
 *    preview holding steady: KEEP;
 *  - the current partner under the pointer means the pointer is at the
 *    drag's ORIGIN seat (the swap is what moved the partner into it) — the
 *    drag came home: REVERT;
 *  - only a genuinely new third tile changes anything: SWAP.
 */
export type PreviewStep =
  | { kind: 'keep' }
  | { kind: 'revert' }
  | { kind: 'swap'; targetId: string };

export function previewStep(
  underPointer: string | null,
  draggedId: string,
  partnerId: string | null
): PreviewStep {
  if (!underPointer || underPointer === draggedId) return { kind: 'keep' };
  if (partnerId !== null && underPointer === partnerId) return { kind: 'revert' };
  return { kind: 'swap', targetId: underPointer };
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
