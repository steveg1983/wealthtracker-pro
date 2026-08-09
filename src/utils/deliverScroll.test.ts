import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deliverScroll } from './deliverScroll';

/**
 * Delivering a scroll to a list that may not be there yet.
 *
 * The behaviour under test is entirely about WHEN, so the clock is a fake one
 * and every assertion is made at a named moment. What it stands in for is the
 * browser measuring an element: AutoSizer renders no list at all until it has,
 * so "is there anything to scroll" is answered here by a flag the test flips.
 */

// The shared setup pins the clock (src/test/setup.ts), and vitest refuses to
// install fake timers over a mocked date — so this file takes the clock back
// first, and hands it over again afterwards.
beforeEach(() => {
  vi.useRealTimers();
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); });

describe('deliverScroll', () => {
  it('scrolls at once when the list is already there', () => {
    const apply = vi.fn(() => true);

    const cancel = deliverScroll(apply);

    expect(apply).toHaveBeenCalledTimes(1);
    cancel();
  });

  it('settles twice more after it lands, to absorb a re-measure', () => {
    const apply = vi.fn(() => true);
    const cancel = deliverScroll(apply);

    vi.advanceTimersByTime(99);
    expect(apply).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(apply).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(200);
    expect(apply).toHaveBeenCalledTimes(3);
    // …and then it stops. A scroll that keeps re-applying itself for ever is a
    // list the user cannot scroll away from.
    vi.advanceTimersByTime(5000);
    expect(apply).toHaveBeenCalledTimes(3);
    cancel();
  });

  it('keeps asking until there is something to scroll', () => {
    let listHasMounted = false;
    const apply = vi.fn(() => listHasMounted);
    const cancel = deliverScroll(apply);

    // The old blind retry ran at 0, 100 and 300ms and then gave up, so a
    // measurement this late was simply lost and the register stayed at the top
    // of the account — which for the owner's is 2008.
    expect(apply).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    const askedWhileWaiting = apply.mock.calls.length;
    expect(askedWhileWaiting).toBeGreaterThan(3);

    listHasMounted = true;
    vi.advanceTimersByTime(50);

    expect(apply).toHaveBeenCalledTimes(askedWhileWaiting + 1);
    // Landed: the two settling passes follow, and the asking stops.
    vi.advanceTimersByTime(300);
    expect(apply).toHaveBeenCalledTimes(askedWhileWaiting + 3);
    vi.advanceTimersByTime(5000);
    expect(apply).toHaveBeenCalledTimes(askedWhileWaiting + 3);
    cancel();
  });

  it('gives up rather than polling for ever', () => {
    const apply = vi.fn(() => false);
    const cancel = deliverScroll(apply);

    vi.advanceTimersByTime(10_000);
    const gaveUpAfter = apply.mock.calls.length;
    vi.advanceTimersByTime(10_000);

    // A row that will never render — deleted elsewhere, filtered away, a page
    // the user has left — must not leave a timer running behind it.
    expect(apply).toHaveBeenCalledTimes(gaveUpAfter);
    expect(gaveUpAfter).toBeLessThan(40);
    cancel();
  });

  it('stops the moment it is cancelled', () => {
    const apply = vi.fn(() => false);

    const cancel = deliverScroll(apply);
    expect(apply).toHaveBeenCalledTimes(1);
    cancel();
    vi.advanceTimersByTime(5000);

    // The cancel is an effect's cleanup: the user has asked for a different row
    // (or left the page), and yesterday's request must not land on top of it.
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('stops a landed request from settling once cancelled', () => {
    const apply = vi.fn(() => true);

    const cancel = deliverScroll(apply);
    cancel();
    vi.advanceTimersByTime(5000);

    expect(apply).toHaveBeenCalledTimes(1);
  });
});
