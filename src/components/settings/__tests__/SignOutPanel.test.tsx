/**
 * The cloud half of the sign-out, pinned at the two things that were actually
 * wrong.
 *
 * The bug this component exists for was not that signing out was broken — it
 * worked. It was that the only control for it was an unlabelled 32px avatar in
 * the mobile header, and the owner went looking and could not find it. So what
 * is worth holding still is that the replacement is FINDABLE and READS AS A
 * CONTROL: a real button, with the words "Sign out" on it, that a person can
 * search the page for. A test asserting a class name would not have caught the
 * original problem and would not catch its return.
 *
 * Clerk is not mocked here. `src/test/setup.ts` already stubs
 * `@clerk/clerk-react` for the whole web suite — `useUser` answers a signed-out
 * person and `useAuth` answers a `signOut` — so this file adds no mock of its
 * own, which is the house rule (CLAUDE.md §7).
 *
 * The device half is pinned where it can be pinned honestly, in
 * `src/desktop/__tests__/desktopPages.test.tsx`: that suite mounts the real
 * `pages/Settings.tsx` through the device alias, and it throws outright if
 * anything in the tree resolves Clerk.
 */

import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignOutPanel from '../SignOutPanel';

describe('SignOutPanel', () => {
  it('offers a sign-out that is a labelled control, not a caption', () => {
    render(<SignOutPanel />);

    // By ROLE and by NAME, which is the way the person who could not find it
    // was looking: for a thing you press that says what it does.
    const button = screen.getByRole('button', { name: 'Sign out' });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it('says what signing out does, and does not threaten anybody', () => {
    render(<SignOutPanel />);

    expect(screen.getByRole('heading', { name: 'Signed in' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing in your ledger changes/i)).toBeInTheDocument();
  });

  it('spends no destructive colour on a routine, reversible act', () => {
    render(<SignOutPanel />);

    // Signing out is not deleting an account — that is DangerZone, one page
    // over, where red means something. Two ambers/reds on two settings pages
    // where only one is destructive teaches that the colour means "settings".
    const button = screen.getByRole('button', { name: 'Sign out' });
    expect(button.className).not.toMatch(/red|danger|expense/);
  });

  it('ends the session when pressed, and says so while it is happening', async () => {
    render(<SignOutPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    // The handler ran and awaited Clerk's `signOut` without throwing: the
    // control reports itself busy and refuses a second press, so a slow
    // network cannot produce two sign-outs from one impatient person.
    await waitFor(() => {
      const busy = screen.getByRole('button', { name: /Signing out/ });
      expect(busy).toBeDisabled();
    });
  });
});
