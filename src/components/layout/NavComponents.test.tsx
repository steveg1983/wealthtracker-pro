import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TopNavDropdown } from './NavComponents';
import { SettingsIcon, Settings2Icon } from '../icons';

/**
 * ONE MENU LIT PER PAGE. Categories lives under /settings but belongs to
 * Manage, and for a while BOTH top-bar menus highlighted over it (owner,
 * 30 Aug: "It should only be Manage"). The claim/disclaim pair is what
 * keeps ownership single: Settings claims the /settings prefix and names
 * what Manage took from it.
 */

const renderPair = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TopNavDropdown
        label="Manage"
        icon={SettingsIcon}
        homeTo="/settings/categories"
        items={[{ to: '/settings/categories', icon: SettingsIcon, label: 'Categories' }]}
        activePaths={['/settings/categories', '/settings/tags']}
        openDropdown={null}
        setOpenDropdown={vi.fn()}
      />
      <TopNavDropdown
        label="Settings"
        icon={Settings2Icon}
        homeTo="/settings"
        items={[{ to: '/settings', icon: Settings2Icon, label: 'General' }]}
        activePaths={['/settings', '/subscription']}
        inactivePaths={['/settings/categories', '/settings/tags']}
        openDropdown={null}
        setOpenDropdown={vi.fn()}
      />
    </MemoryRouter>
  );

/** The lit treatment is bg-white/20, worn by the row DIV around the split
 *  trigger (label-link + chevron-button read as one control) — the one class
 *  separating active from resting (hover:bg-white/10). */
const isLit = (label: string): boolean => {
  const link = screen.getByRole('link', { name: label });
  return (link.parentElement?.className ?? '').includes('bg-white/20');
};

describe('the top-bar menus claim one owner per page', () => {
  it('a Manage-owned page under /settings lights Manage alone', () => {
    renderPair('/settings/categories');
    expect(isLit('Manage')).toBe(true);
    expect(isLit('Settings')).toBe(false);
  });

  it('a genuine Settings page still lights Settings', () => {
    renderPair('/settings/app');
    expect(isLit('Settings')).toBe(true);
    expect(isLit('Manage')).toBe(false);
  });

  it('the disclaimed list is a scalpel — the /settings root itself stays Settings', () => {
    renderPair('/settings');
    expect(isLit('Settings')).toBe(true);
    expect(isLit('Manage')).toBe(false);
  });
});
