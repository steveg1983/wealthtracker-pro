/**
 * The envelope, against the REAL crate.
 *
 * @vitest-environment node
 *
 * `services/local/__tests__/coreTransport.test.ts` proves what the port does
 * with each half of the envelope, over a transport of its own. It cannot prove
 * that the crate really produces those two halves, or that the spawn transport
 * reads them — and that is the part with a process boundary in it, which is
 * exactly the kind of thing a stub is worst at.
 *
 * Three facts, end to end:
 *
 *   A REFUSAL IS AN ANSWER. serde refuses an unrecognised field before a
 *   connection is opened, the bin exits ZERO with `{"ok":false,…}`, and the
 *   transport turns that into an `Error` carrying the crate's own words. This
 *   is the whole `ok:false` half of the wire, and no read verb in the contract
 *   suite can reach it (a read has no refusal in it — an owner with no accounts
 *   has an empty list, which is an answer).
 *
 *   A FAULT IS NOT. A file that is not there is a storage fault: non-zero exit,
 *   a line on stderr, and a rejected promise with a sentence naming the verb.
 *
 *   NOTHING TOUCHES A FILE UNTIL THE COMMAND PARSES. The refusal above arrives
 *   from a path that does not exist, which is only possible because `parse`
 *   runs before `db::open` — the property `command.rs` claims in prose, checked
 *   here rather than read.
 */

import { afterAll, describe, it, expect } from 'vitest';
import { createSpawnTransport } from '../../local/coreTransport';
import { LedgerFiles, locateBridge } from './localCore.fixtureFile';

const OWNER = '11111111-1111-1111-1111-111111111111';

const bridge = locateBridge();
const files = new LedgerFiles(bridge);

afterAll(() => {
  files.dispose();
});

describe('the spawn transport, against the ledger crate', () => {
  it('hands back a read’s answer', async () => {
    const transport = createSpawnTransport({
      binary: bridge,
      database: files.create('transport')
    });

    const answer = await transport.call('list_accounts', { user_id: OWNER });

    expect(answer).toEqual({ answer: { accounts: [] } });
  });

  it('turns a refusal into an Error carrying the crate’s own words', async () => {
    const transport = createSpawnTransport({
      binary: bridge,
      database: files.create('transport')
    });

    // `deny_unknown_fields` on every payload — divergence D-7's local half,
    // where the cloud silently discards a key it does not know.
    const refused = transport.call('list_accounts', { user_id: OWNER, sneaky: true });

    await expect(refused).rejects.toThrow(/unknown field `sneaky`/);
    // NOT wrapped in a sentence of the transport's own: the message the crate
    // wrote is the message a person reads (seam rule 4).
    await expect(refused).rejects.not.toThrow(/could not answer/);
  });

  it('refuses an unknown verb without opening anything', async () => {
    // The file does not exist, so if a connection were opened first this would
    // be a fault instead — which is the property being checked.
    const transport = createSpawnTransport({ binary: bridge, database: files.missing() });

    await expect(transport.call('drop_everything', { user_id: OWNER })).rejects.toThrow(
      /unknown variant `drop_everything`/
    );
  });

  it('rejects with a fault, naming the verb, when the file will not open', async () => {
    const transport = createSpawnTransport({ binary: bridge, database: files.missing() });

    await expect(transport.call('load_boot', { user_id: OWNER })).rejects.toThrow(
      /could not answer load_boot/
    );
  });
});
