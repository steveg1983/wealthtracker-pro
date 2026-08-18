import { describe, it, expect } from 'vitest';
import { moveToPosition, moveBySteps } from './reorderList';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('moveToPosition — drag a tile onto another seat', () => {
  it('moves forward, shifting the crossed members back', () => {
    expect(moveToPosition(IDS, 'b', 'e')).toEqual(['a', 'c', 'd', 'e', 'b', 'f']);
  });

  it('moves backward, shifting the crossed members forward', () => {
    expect(moveToPosition(IDS, 'e', 'b')).toEqual(['a', 'e', 'b', 'c', 'd', 'f']);
  });

  it('dropping a tile on itself changes nothing', () => {
    expect(moveToPosition(IDS, 'c', 'c')).toEqual(IDS);
  });

  it('a drag that raced a deletion is a no-op, not a crash', () => {
    expect(moveToPosition(IDS, 'gone', 'c')).toEqual(IDS);
    expect(moveToPosition(IDS, 'c', 'gone')).toEqual(IDS);
  });

  it('never mutates its input', () => {
    const before = [...IDS];
    moveToPosition(IDS, 'a', 'f');
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
