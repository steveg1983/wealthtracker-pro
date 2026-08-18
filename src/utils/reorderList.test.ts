import { describe, it, expect } from 'vitest';
import { swapPositions, moveBySteps } from './reorderList';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('swapPositions — the hovered tile takes the dragged tile\'s seat', () => {
  it('swaps two seats and moves nobody else (owner: crossing tiles must not displace them)', () => {
    expect(swapPositions(IDS, 'a', 'e')).toEqual(['e', 'b', 'c', 'd', 'a', 'f']);
    expect(swapPositions(IDS, 'e', 'a')).toEqual(['e', 'b', 'c', 'd', 'a', 'f']);
  });

  it('previewing from the PRE-DRAG order is not cumulative — a new hover replaces the last, never stacks on it', () => {
    // Dragging 'a' across 'c' and then to 'e': each preview computes from the
    // base order, so 'c' is back in its own seat the moment the pointer moves
    // on. This is the whole of the owner's complaint with the first cut.
    const overC = swapPositions(IDS, 'a', 'c');
    const overE = swapPositions(IDS, 'a', 'e');
    expect(overC).toEqual(['c', 'b', 'a', 'd', 'e', 'f']);
    expect(overE).toEqual(['e', 'b', 'c', 'd', 'a', 'f']);
    expect(overE.indexOf('c')).toBe(2); // untouched by having been crossed
  });

  it('hovering a tile over itself changes nothing', () => {
    expect(swapPositions(IDS, 'c', 'c')).toEqual(IDS);
  });

  it('a drag that raced a deletion is a no-op, not a crash', () => {
    expect(swapPositions(IDS, 'gone', 'c')).toEqual(IDS);
    expect(swapPositions(IDS, 'c', 'gone')).toEqual(IDS);
  });

  it('never mutates its input', () => {
    const before = [...IDS];
    swapPositions(IDS, 'a', 'f');
    expect(IDS).toEqual(before);
  });
});

describe('moveBySteps — the keyboard version of the same gesture', () => {
  it('steps in both directions', () => {
    expect(moveBySteps(IDS, 'c', 1)).toEqual(['a', 'b', 'd', 'c', 'e', 'f']);
    expect(moveBySteps(IDS, 'c', -2)).toEqual(['c', 'a', 'b', 'd', 'e', 'f']);
  });

  it('clamps at the ends instead of wrapping or throwing', () => {
    expect(moveBySteps(IDS, 'a', -1)).toEqual(IDS);
    expect(moveBySteps(IDS, 'f', 5)).toEqual(IDS);
    expect(moveBySteps(IDS, 'e', 99)).toEqual(['a', 'b', 'c', 'd', 'f', 'e']);
  });
});
