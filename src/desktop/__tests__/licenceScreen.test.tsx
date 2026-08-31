/**
 * THE LICENCE SCREEN, and the one promise it exists to keep.
 *
 * The enforcement is not here and cannot be tested here — it is
 * `apps/desktop/src-tauri/src/main.rs`'s `licence_gate`, in Rust, with its own
 * suite proving that an expired window is refused a write BY NAME and still
 * answers a read and an export. What this file holds is the other half: that the
 * person in front of the window is told the truth about it.
 *
 * The sentence in `status.message` is the SHELL'S, and every assertion below
 * that quotes it quotes it as prose rather than as a shape — if the Rust ever
 * stops saying "export", this fails, which is the point.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LicenceStatusLine } from '../LicenceScreen';
import type { Invoke } from '../../services/local/coreTransport';

/** The shell's answer, in the shape `license_status` serialises. */
const status = (over: Record<string, unknown>): Record<string, unknown> => ({
  state: 'unlicensed',
  kind: null,
  licensedTo: null,
  expiresAt: null,
  mayWrite: false,
  clockWentBack: false,
  message: 'No licence has been entered on this machine.',
  ...over
});

/**
 * A shell that answers the two licence commands and nothing else.
 *
 * `apply` is a function so a case can decide what a paste does: verify, refuse
 * with the shell's own words, or reject the way Tauri rejects (with a string).
 */
const shell = (
  initial: Record<string, unknown>,
  apply: (key: string) => Promise<unknown> = () => Promise.reject('no key was expected')
): Invoke => {
  let current = initial;
  return async (command, args) => {
    if (command === 'license_status') return current;
    if (command === 'license_apply') {
      const answer = await apply(String((args as { key?: unknown }).key));
      current = answer as Record<string, unknown>;
      return answer;
    }
    throw new Error(`this test's shell was asked ${command}`);
  };
};

/** The sentence the Rust writes for a lapsed trial, verbatim. */
const EXPIRED_MESSAGE =
  'Your trial has ended, so this ledger is open read-only. Nothing has been removed: every ' +
  'screen still works and you can export the whole file whenever you want it. Enter a licence ' +
  'key to write again.';

describe('the licence line', () => {
  it('says nothing at all when there is no shell to ask', () => {
    // A renderer opened in an ordinary browser, or any test that did not supply
    // a shell. Silence, not an alarm — and nothing about what may be written
    // changes either way, because that was never decided here.
    const { container } = render(<LicenceStatusLine invoke={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says nothing when the shell answers something it cannot read', async () => {
    // An older shell without the command, or a harness stubbing every invoke.
    const stub: Invoke = async () => ({ ok: true, result: { answer: {} } });
    const { container } = render(<LicenceStatusLine invoke={stub} />);
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('names the licensee when there is a lifetime licence', async () => {
    render(
      <LicenceStatusLine
        invoke={shell(
          status({
            state: 'licensed',
            kind: 'lifetime',
            licensedTo: 'Ada Lovelace',
            mayWrite: true,
            message: 'Licensed to Ada Lovelace.'
          })
        )}
      />
    );

    // IDENTITY-IN-LICENCE IS THE ENFORCEMENT at this scale, and it only works
    // if the name is actually on screen.
    expect(await screen.findByText(/Licensed to Ada Lovelace/)).toBeInTheDocument();
  });

  it('says when a trial ends, in this app’s dates', async () => {
    render(
      <LicenceStatusLine
        invoke={shell(
          status({
            state: 'licensed',
            kind: 'trial',
            licensedTo: 'Grace Hopper',
            // 2027-03-04 at midday UTC — midday so that no machine's timezone
            // can move it to the day before, and 4 March because 04/03 reads as
            // two different days in the two Englishes, which is the reason the
            // format is pinned rather than defaulted.
            expiresAt: 1_804_161_600,
            mayWrite: true,
            message: 'Trial licensed to Grace Hopper.'
          })
        )}
      />
    );

    expect(await screen.findByText(/Trial until 4 March 2027/)).toBeInTheDocument();
  });

  it('shows a development build as one rather than as a licence', async () => {
    render(
      <LicenceStatusLine
        invoke={shell(
          status({
            state: 'unenforced',
            mayWrite: true,
            message: 'Development build — no licence key is compiled into it.'
          })
        )}
      />
    );

    expect(await screen.findByText(/Development build/)).toBeInTheDocument();
  });
});

describe('the licence panel', () => {
  const open = async (invoke: Invoke): Promise<void> => {
    render(<LicenceStatusLine invoke={invoke} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Manage licence' }));
  };

  it('shows the shell’s own sentence, and the promise that nothing is held', async () => {
    await open(
      shell(status({ state: 'expired', kind: 'trial', licensedTo: 'Grace Hopper', message: EXPIRED_MESSAGE }))
    );

    // THE SHELL'S SENTENCE, VERBATIM. Not re-worded on its way to a screen.
    expect(screen.getByText(EXPIRED_MESSAGE)).toBeInTheDocument();

    // AND THE PROMISE THE LANDING PAGE MAKES — "your ledger exports in full
    // whenever you want it" — said again, in front of the one person it was
    // made to. Both halves: that reading continues, and that the export does.
    const held = screen.getByText(/Nothing is being held back/);
    expect(held).toHaveTextContent(/Export screen still takes the whole ledger/);
    expect(held).toHaveTextContent(/What is paused is writing/);
  });

  it('does not talk about read-only when there is nothing read-only about it', async () => {
    await open(
      shell(
        status({
          state: 'licensed',
          kind: 'lifetime',
          licensedTo: 'Ada Lovelace',
          mayWrite: true,
          message: 'Licensed to Ada Lovelace.'
        })
      )
    );

    expect(screen.queryByText(/Nothing is being held back/)).toBeNull();
  });

  it('takes a pasted key and reports where that leaves the window', async () => {
    const applied: string[] = [];
    await open(
      shell(status({}), key => {
        applied.push(key);
        return Promise.resolve(
          status({
            state: 'licensed',
            kind: 'lifetime',
            licensedTo: 'Ada Lovelace',
            mayWrite: true,
            message: 'Licensed to Ada Lovelace.'
          })
        );
      })
    );

    // The button is dead until there is something to apply: a blank paste is a
    // question the shell should never have to be asked.
    expect(screen.getByRole('button', { name: 'Apply licence' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Licence key'), 'WTL1-abc.def');
    await userEvent.click(screen.getByRole('button', { name: 'Apply licence' }));

    expect(applied).toEqual(['WTL1-abc.def']);
    // Two elements say it once the licence lands — the line's label and the
    // shell's own sentence in the panel — and that is the point: the state
    // moved, in both places, without the window being reloaded.
    expect(await screen.findAllByText(/Licensed to Ada Lovelace/)).toHaveLength(2);
    // …and the read-only note is gone, because the state it described is gone.
    expect(screen.queryByText(/Nothing is being held back/)).toBeNull();
  });

  it('shows a refused key in the shell’s words, and stays read-only', async () => {
    await open(
      shell(status({ message: EXPIRED_MESSAGE, state: 'expired' }), () =>
        // Tauri rejects a command with its `Err` value, which for this shell is
        // always a string. This is what a wrong key really looks like.
        Promise.reject(
          'That licence key was not signed for this app. Check you have pasted the whole key.'
        )
      )
    );

    await userEvent.type(screen.getByLabelText('Licence key'), 'WTL1-not.mine');
    await userEvent.click(screen.getByRole('button', { name: 'Apply licence' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That licence key was not signed for this app.');
    // The window has not quietly promoted itself on a refusal.
    expect(screen.getByText(EXPIRED_MESSAGE)).toBeInTheDocument();
  });

  it('mentions a clock that has gone backwards without punishing it', async () => {
    await open(
      shell(
        status({
          state: 'licensed',
          kind: 'lifetime',
          licensedTo: 'Ada Lovelace',
          mayWrite: true,
          clockWentBack: true,
          message: 'Licensed to Ada Lovelace.'
        })
      )
    );

    expect(screen.getByText(/clock reads earlier/)).toBeInTheDocument();
    // Reported, never punished: a lifetime licence has no expiry, so a clock
    // that disagrees with the mark is not this window's problem.
    expect(screen.queryByText(/Nothing is being held back/)).toBeNull();
  });
});
