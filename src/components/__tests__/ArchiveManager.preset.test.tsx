import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../contexts/ToastContext';
import ArchiveManager from '../ArchiveManager';
import { preferences } from '../../services/preferencesService';

/**
 * The bug, as the owner reported it: he set the archive range, came back to the
 * page, and it was on twelve months again. The per-account overrides beside it
 * WERE remembered, so the page came back saying something he had not said —
 * the worst of both.
 *
 * It was a plain `useState('12m')` with nothing behind it. It is a preference
 * about HIS accounts now, which means it survives a refresh AND travels to the
 * next machine, like the overrides it overrides.
 *
 * The app context is the shared synthetic double from src/test/setup.ts — this
 * repo is public, so no real figures appear anywhere.
 */

const renderArchiveManager = () =>
  render(
    <MemoryRouter initialEntries={['/settings/data']}>
      <ToastProvider>
        <ArchiveManager />
      </ToastProvider>
    </MemoryRouter>
  );

const presetButton = (label: string) => screen.getByRole('button', { name: label });

describe('ArchiveManager — the range it opens on', () => {
  beforeEach(() => {
    preferences.detach();
    localStorage.clear();
  });

  it('starts on twelve months when nothing has been chosen', () => {
    renderArchiveManager();
    expect(presetButton('12 months')).toHaveAttribute('aria-pressed', 'true');
    expect(preferences.getItem('archiveManager.preset.v1')).toBeNull();
  });

  it('remembers the range across a remount — the reported bug', () => {
    const first = renderArchiveManager();
    fireEvent.click(presetButton('24 months'));
    expect(presetButton('24 months')).toHaveAttribute('aria-pressed', 'true');
    first.unmount();

    renderArchiveManager();
    expect(presetButton('24 months')).toHaveAttribute('aria-pressed', 'true');
    expect(presetButton('12 months')).toHaveAttribute('aria-pressed', 'false');
  });

  it('stores the choice as a preference, so it follows the account', () => {
    renderArchiveManager();
    fireEvent.click(presetButton('6 months'));
    expect(preferences.getItem('archiveManager.preset.v1')).toBe('6m');
  });

  it('remembers a custom date, not just the fact that it was custom', () => {
    const first = renderArchiveManager();
    fireEvent.click(presetButton('Custom date'));
    // Typed the way the field is read — dd/mm/yyyy everywhere, because a native
    // date input would render in the browser's locale rather than the app's.
    fireEvent.change(screen.getByLabelText('Custom archive cutoff date'), {
      target: { value: '06/04/2019' },
    });
    expect(preferences.getItem('archiveManager.customDate.v1')).toBe('2019-04-06');
    first.unmount();

    renderArchiveManager();
    expect(presetButton('Custom date')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Custom archive cutoff date')).toHaveValue('06/04/2019');
  });

  it('ignores a stored value that is not one of the ranges offered', () => {
    // Storage is hand-editable and travels through a JSON document; a value the
    // picker cannot show must not leave the page with no range selected.
    preferences.setItem('archiveManager.preset.v1', 'since-the-dawn-of-time');
    renderArchiveManager();
    expect(presetButton('12 months')).toHaveAttribute('aria-pressed', 'true');
  });
});
