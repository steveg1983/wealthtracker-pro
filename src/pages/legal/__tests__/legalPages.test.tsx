/**
 * The legal pages say what the code does, and say when they are not yet
 * finished. These specs hold the statements that other code depends on
 * being true, so a change to deletion, retention or consent that forgets the
 * policy fails here.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrivacyPolicy from '../PrivacyPolicy';
import TermsOfService from '../TermsOfService';
import { LEGAL_LAST_UPDATED, LEGAL_REVIEW_COMPLETE, operatorDetailsComplete } from '../legalIdentity';
import { getConsent, setConsent } from '../../../utils/consent';

vi.mock('../../../lib/sentry', () => ({ enableAnalyticsConsent: vi.fn() }));

const renderAt = (element: React.ReactElement) => render(<MemoryRouter>{element}</MemoryRouter>);

describe('the privacy policy', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('names the processors the code uses, the London database, the six-year audit log and the deletion order', () => {
    renderAt(<PrivacyPolicy />);
    const text = document.body.textContent ?? '';
    for (const processor of ['Supabase', 'Clerk', 'Vercel', 'Stripe', 'TrueLayer', 'Sentry', 'Apple', 'Twelve Data', 'Frankfurter', 'Anthropic']) {
      expect(text, processor).toContain(processor);
    }
    expect(text).toContain('London');
    expect(text).toContain('six years');
    expect(text).toContain('seven-day');
    expect(text).toContain('Settings → Security → Danger zone');
    expect(text).toContain('never moves money');
    expect(text).toContain(`Last updated: ${LEGAL_LAST_UPDATED}`);
  });

  it('says so at the top while the operator’s details are placeholders or the review is not done', () => {
    renderAt(<PrivacyPolicy />);
    const note = screen.queryByRole('note');
    if (!operatorDetailsComplete() || !LEGAL_REVIEW_COMPLETE) {
      expect(note).not.toBeNull();
      expect(note?.textContent).toMatch(/not been reviewed by a solicitor/);
    } else {
      expect(note).toBeNull();
    }
  });

  it('lets diagnostics consent be changed on the page, not only at the banner', () => {
    setConsent('essential');
    renderAt(<PrivacyPolicy />);
    expect(screen.getByText(/Your current choice on this device/).textContent).toContain('essential only');
    expect(screen.getByRole('button', { name: 'Essential only' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Allow diagnostics' }));
    expect(getConsent()).toBe('all');
    expect(screen.getByText(/Your current choice on this device/).textContent).toContain('diagnostics allowed');
    expect(screen.getByRole('button', { name: 'Allow diagnostics' })).toBeDisabled();
  });
});

describe('the terms of service', () => {
  it('carry the catalogue’s prices, the read-only bank connection, the connector, and the liability floor the law requires', () => {
    renderAt(<TermsOfService />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('£7.99');
    expect(text).toContain('£15.99');
    expect(text).toContain('read-only');
    expect(text).toContain('Claude');
    expect(text).toContain('death or personal injury');
    expect(text).toContain('England and Wales');
    expect(text).toContain('not financial advice');
  });

  it('link to each other', () => {
    renderAt(<TermsOfService />);
    expect(screen.getAllByRole('link', { name: 'Privacy Policy' }).length).toBeGreaterThan(0);
  });
});
