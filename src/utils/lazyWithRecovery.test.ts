import { describe, it, expect, vi } from 'vitest';
import { importWithChunkRecovery, type ChunkRecoveryEnvironment } from './lazyWithRecovery';

const RELOAD_COOLDOWN_MS = 60_000;

// The wording Safari uses; the other engines are covered in chunkLoadError.test.ts.
const staleChunkError = (): Error => new TypeError('Importing a module script failed.');

interface TestHarness {
  environment: ChunkRecoveryEnvironment;
  reload: ReturnType<typeof vi.fn>;
  readGuard: () => string | null;
  advance: (ms: number) => void;
}

function createHarness(options: {
  now?: number;
  guard?: string | null;
  online?: boolean;
  storageWritable?: boolean;
} = {}): TestHarness {
  let now = options.now ?? 1_700_000_000_000;
  let guard = options.guard ?? null;
  const reload = vi.fn();

  return {
    environment: {
      now: () => now,
      readGuard: () => guard,
      writeGuard: (value: string) => {
        if (options.storageWritable === false) {
          return false;
        }
        guard = value;
        return true;
      },
      isOnline: () => options.online ?? true,
      reload,
    },
    reload,
    readGuard: () => guard,
    advance: (ms: number) => { now += ms; },
  };
}

type Settlement = { state: 'pending' } | { state: 'resolved'; value: unknown } | { state: 'rejected'; error: unknown };

// Recovery deliberately returns a promise that never settles while the document
// is being replaced, so every assertion has to allow for "still pending".
async function settle(promise: Promise<unknown>): Promise<Settlement> {
  let settlement: Settlement = { state: 'pending' };
  promise.then(
    value => { settlement = { state: 'resolved', value }; },
    error => { settlement = { state: 'rejected', error }; }
  );
  await new Promise(resolve => setTimeout(resolve, 0));
  return settlement;
}

describe('importWithChunkRecovery', () => {
  it('passes a successful import straight through and leaves the guard alone', async () => {
    const harness = createHarness();

    const module = await importWithChunkRecovery(
      () => Promise.resolve({ default: 'component' }),
      { environment: harness.environment }
    );

    expect(module).toEqual({ default: 'component' });
    expect(harness.reload).not.toHaveBeenCalled();
    expect(harness.readGuard()).toBeNull();
  });

  it('reloads once on a stale chunk, records the attempt, and never settles', async () => {
    const harness = createHarness({ now: 5_000 });

    const settlement = await settle(importWithChunkRecovery(
      () => Promise.reject(staleChunkError()),
      { environment: harness.environment }
    ));

    expect(harness.reload).toHaveBeenCalledTimes(1);
    expect(harness.readGuard()).toBe('5000');
    expect(settlement.state).toBe('pending');
  });

  it('throws instead of reloading again inside the cooldown', async () => {
    const harness = createHarness({ now: 5_000 });

    await settle(importWithChunkRecovery(
      () => Promise.reject(staleChunkError()),
      { environment: harness.environment }
    ));
    harness.advance(RELOAD_COOLDOWN_MS - 1);

    const error = staleChunkError();
    const settlement = await settle(importWithChunkRecovery(
      () => Promise.reject(error),
      { environment: harness.environment }
    ));

    expect(harness.reload).toHaveBeenCalledTimes(1);
    expect(settlement).toEqual({ state: 'rejected', error });
  });

  it('is not re-armed by a successful import in between, so it cannot loop', async () => {
    const harness = createHarness({ now: 5_000 });

    await settle(importWithChunkRecovery(
      () => Promise.reject(staleChunkError()),
      { environment: harness.environment }
    ));
    // What happens after the reload: the route chunk loads from the fresh index,
    // then a child chunk that is genuinely unfetchable fails again.
    await importWithChunkRecovery(
      () => Promise.resolve({ default: 'route' }),
      { environment: harness.environment }
    );
    harness.advance(2_000);

    const settlement = await settle(importWithChunkRecovery(
      () => Promise.reject(staleChunkError()),
      { environment: harness.environment }
    ));

    expect(harness.reload).toHaveBeenCalledTimes(1);
    expect(settlement.state).toBe('rejected');
  });

  it('recovers again once the cooldown has passed (a later deploy)', async () => {
    const harness = createHarness({ now: 5_000 });

    await settle(importWithChunkRecovery(
      () => Promise.reject(staleChunkError()),
      { environment: harness.environment }
    ));
    harness.advance(RELOAD_COOLDOWN_MS + 1);

    const settlement = await settle(importWithChunkRecovery(
      () => Promise.reject(staleChunkError()),
      { environment: harness.environment }
    ));

    expect(harness.reload).toHaveBeenCalledTimes(2);
    expect(settlement.state).toBe('pending');
  });

  it('treats a guard timestamp in the future as expired rather than wedging', async () => {
    const harness = createHarness({ now: 5_000, guard: '9999999999999' });

    const settlement = await settle(importWithChunkRecovery(
      () => Promise.reject(staleChunkError()),
      { environment: harness.environment }
    ));

    expect(harness.reload).toHaveBeenCalledTimes(1);
    expect(settlement.state).toBe('pending');
  });

  it('recovers a failure in the .then() that picks a named export', async () => {
    const harness = createHarness();

    const settlement = await settle(importWithChunkRecovery(
      () => Promise.reject(staleChunkError())
        .then((module: { InfiniteScrollTransactionList: string }) => ({ default: module.InfiniteScrollTransactionList })),
      { environment: harness.environment }
    ));

    expect(harness.reload).toHaveBeenCalledTimes(1);
    expect(settlement.state).toBe('pending');
  });

  it('rethrows a module that loaded and then crashed, without reloading', async () => {
    const harness = createHarness();
    const error = new TypeError("Cannot read properties of undefined (reading 'map')");

    const settlement = await settle(importWithChunkRecovery(
      () => Promise.reject(error),
      { environment: harness.environment }
    ));

    expect(harness.reload).not.toHaveBeenCalled();
    expect(settlement).toEqual({ state: 'rejected', error });
  });

  it('rethrows without reloading when the call site opts out', async () => {
    const harness = createHarness();
    const error = staleChunkError();

    const settlement = await settle(importWithChunkRecovery(
      () => Promise.reject(error),
      { autoReload: false, environment: harness.environment }
    ));

    expect(harness.reload).not.toHaveBeenCalled();
    expect(harness.readGuard()).toBeNull();
    expect(settlement).toEqual({ state: 'rejected', error });
  });

  it('rethrows without reloading when the browser is offline', async () => {
    const harness = createHarness({ online: false });

    const settlement = await settle(importWithChunkRecovery(
      () => Promise.reject(staleChunkError()),
      { environment: harness.environment }
    ));

    expect(harness.reload).not.toHaveBeenCalled();
    expect(settlement.state).toBe('rejected');
  });

  it('rethrows without reloading when the guard cannot be stored', async () => {
    const harness = createHarness({ storageWritable: false });

    const settlement = await settle(importWithChunkRecovery(
      () => Promise.reject(staleChunkError()),
      { environment: harness.environment }
    ));

    expect(harness.reload).not.toHaveBeenCalled();
    expect(settlement.state).toBe('rejected');
  });
});
