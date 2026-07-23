import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_TYPE_SECTIONS,
  ALL_ACCOUNT_SECTIONS,
  OTHER_SECTION,
  sectionTypeForAccount,
  sectionForAccountType,
} from './accountSections';
import type { Account } from '../types';

/**
 * The invariant these pin: EVERY account type files into SOME section. An
 * account whose type had no section used to render nowhere under type
 * grouping — creatable in the Add Account modal ("Other Assets"), counted in
 * the search denominator, absent from the page.
 */
describe('sectionTypeForAccount', () => {
  it('files every member of the Account type union into a real section', () => {
    // The union from types/index.ts:19, spelled out so adding a type without
    // deciding its section fails HERE rather than vanishing in the UI.
    const union: Account['type'][] = [
      'current', 'savings', 'credit', 'loan', 'investment', 'asset',
      'liability', 'mortgage', 'assets', 'other', 'checking',
    ];
    const sectionTypes = new Set(ALL_ACCOUNT_SECTIONS.map(s => s.type));
    for (const type of union) {
      expect(sectionTypes.has(sectionTypeForAccount(type)), `type '${type}' files nowhere`).toBe(true);
    }
  });

  it('aliases the legacy spellings onto their real sections', () => {
    expect(sectionTypeForAccount('checking')).toBe('current');   // the DB's spelling
    expect(sectionTypeForAccount('assets')).toBe('asset');       // the modal's "Other Assets"
    // The app's own label for a loan is "Mortgages, personal loans".
    expect(sectionTypeForAccount('mortgage')).toBe('loan');
  });

  it('sends anything without a section to the catch-all, never nowhere', () => {
    expect(sectionTypeForAccount('other')).toBe(OTHER_SECTION.type);
    expect(sectionTypeForAccount('cash')).toBe(OTHER_SECTION.type);        // in the DB constraint
    expect(sectionTypeForAccount('hoverboard-fund')).toBe(OTHER_SECTION.type); // the future
  });

  it('leaves every type that has its own section alone', () => {
    for (const section of ACCOUNT_TYPE_SECTIONS) {
      expect(sectionTypeForAccount(section.type)).toBe(section.type);
    }
  });
});

describe('sectionForAccountType', () => {
  it('never returns undefined any more', () => {
    expect(sectionForAccountType('mortgage').title).toBe('Loans');
    expect(sectionForAccountType('assets').title).toBe('Assets');
    expect(sectionForAccountType('other')).toBe(OTHER_SECTION);
  });
});

describe('ALL_ACCOUNT_SECTIONS', () => {
  it('is the section list with the catch-all last — what a grouping page iterates', () => {
    expect(ALL_ACCOUNT_SECTIONS.slice(0, -1)).toEqual(ACCOUNT_TYPE_SECTIONS);
    expect(ALL_ACCOUNT_SECTIONS[ALL_ACCOUNT_SECTIONS.length - 1]).toBe(OTHER_SECTION);
  });
});
