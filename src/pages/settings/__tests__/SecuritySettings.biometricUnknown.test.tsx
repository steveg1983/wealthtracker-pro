/**
 * P8 — nothing may speak until it knows.
 *
 * `biometricAvailable` used to start `false`, and the page rendered that as a
 * finding: a disabled button reading "Not Available" and a warning panel saying
 * "Biometric authentication is not available on this device". On a phone with
 * Face ID both statements were false, and they were shown before
 * `securityService.isBiometricAvailable()` had been asked.
 *
 * The three states are now distinct, and the third test here is the one that
 * makes the principle enforceable: a device that genuinely cannot do this must
 * STILL be told so. Without it the fix could be "delete the message", which
 * trades a false statement for a silence.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../../contexts/ToastContext';

/** Resolves only when the test says so, so the "still asking" window is real. */
let answer: (available: boolean) => void = () => {};
const isBiometricAvailable = vi.fn(
  () => new Promise<boolean>(resolve => { answer = resolve; })
);

vi.mock('../../../services/securityService', () => ({
  securityService: {
    isBiometricAvailable,
    getSecuritySettings: () => ({
      twoFactorEnabled: false,
      biometricEnabled: false,
      encryptionEnabled: false,
      sessionTimeout: 30,
      autoLockEnabled: false,
      requirePasswordForExport: false,
    }),
    updateSecuritySettings: vi.fn(),
    generateTwoFactorSecret: vi.fn(),
    setupBiometric: vi.fn(),
  },
}));

const { default: SecuritySettings } = await import('../SecuritySettings');

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SecuritySettings />
      </ToastProvider>
    </MemoryRouter>
  );
}

/** The card headed "Biometric Authentication", so sibling sections' buttons don't match. */
function biometricCard(): HTMLElement {
  const heading = screen.getByText('Biometric Authentication');
  const card = heading.closest('div.bg-white');
  if (!card) throw new Error('biometric card not found');
  return card as HTMLElement;
}

describe('Security settings — the biometric capability check', () => {
  beforeEach(() => {
    isBiometricAvailable.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('says nothing about the device while the check is still out', async () => {
    renderPage();

    // The claim that used to be here, on a device that may well have Face ID.
    expect(
      screen.queryByText(/not available on this device/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Not Available')).not.toBeInTheDocument();
  });

  it('offers the control once the device says yes', async () => {
    renderPage();
    answer(true);

    // Two-Factor and Data Encryption carry "Enable" buttons of their own, so the
    // query is scoped to the biometric card rather than the page.
    await waitFor(() => {
      expect(within(biometricCard()).getByRole('button', { name: 'Enable' })).toBeEnabled();
    });
    expect(
      screen.queryByText(/not available on this device/i)
    ).not.toBeInTheDocument();
  });

  it('STILL tells a device that genuinely cannot do it', async () => {
    renderPage();
    answer(false);

    await waitFor(() => {
      expect(screen.getByText(/not available on this device/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Not Available' })).toBeDisabled();
  });
});
