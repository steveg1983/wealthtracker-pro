import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoryDataHealthPanel from './CategoryDataHealthPanel';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import type { CategoryHealth } from '../utils/categoryHealth';

/**
 * The data-health line for rows filed under a category that no longer exists.
 *
 * Two things are pinned here, and they are the two the owner ruled on when a
 * real user met this on 1 Sep 2026:
 *
 *  1. THE REMEDY IS ON THIS PAGE. The line used to link to Accounts →
 *     Categorisation, whose own amber note about the same rows linked back
 *     here. Following either arrived at the other announcement and never at a
 *     row. A dangling row HAS a category — a dead one — so putting it right is
 *     a change to something already filed, which is the housekeeping tool at
 *     the foot of this page. So this line no longer navigates anywhere: it asks
 *     the page it is on to open those rows.
 *
 *  2. THE LINE WEARS THE AMBER, AND ITS NEIGHBOURS DO NOT. Money filed under a
 *     category that does not exist is in no report at all — absent from the
 *     totals without being absent from the ledger, which is the one finding
 *     here a reader cannot see for themselves anywhere else. An unused category
 *     and an ordinary backlog are housekeeping, and colour marks what needs
 *     attention (house rule) or it stops marking anything.
 *
 * Every figure below is invented: this repo is public.
 */

const CLEAN: CategoryHealth = {
  uncategorizedCount: 0,
  uncategorizedIn: 0,
  uncategorizedOut: 0,
  unassignedBucketCount: 0,
  unassignedBucketCategoryId: null,
  danglingCount: 0,
  emptyCategoryCount: 0,
  emptyCategoryIds: [],
  transferFilingMismatchCount: 0,
  transferFilingMismatchIds: [],
  holdsForeign: false,
  hasWarnings: false,
};

/** Dangling rows beside a neighbour that is NOT a warning. */
const DANGLING_AND_A_NEIGHBOUR: CategoryHealth = {
  ...CLEAN,
  danglingCount: 4,
  emptyCategoryCount: 2,
  emptyCategoryIds: ['cat-unused-a', 'cat-unused-b'],
  hasWarnings: true,
};

const onReviewDangling = vi.fn();

const renderPanel = (health: CategoryHealth, wearsAmber = false): void => {
  render(
    <MemoryRouter>
      <PreferencesProvider>
        <CategoryDataHealthPanel
          health={health}
          wearsAmber={wearsAmber}
          onFileUnassignedBucket={vi.fn()}
          onShowEmptyCategories={vi.fn()}
          onFixTransferFilings={vi.fn()}
          onReviewDangling={onReviewDangling}
        />
      </PreferencesProvider>
    </MemoryRouter>
  );
};

/** The whole line, found through the action that belongs to it. */
const danglingLine = (): HTMLElement => {
  const line = screen.getByRole('button', { name: /^Re-file/ }).closest('li');
  if (!(line instanceof HTMLElement)) throw new Error('the dangling line has no row');
  return line;
};

const emptyCategoriesLine = (): HTMLElement => {
  const line = screen.getByRole('button', { name: /^Show/ }).closest('li');
  if (!(line instanceof HTMLElement)) throw new Error('the empty-categories line has no row');
  return line;
};

beforeEach(() => {
  onReviewDangling.mockClear();
});

afterEach(cleanup);

describe('the “category no longer exists” line — where it goes', () => {
  it('asks THIS page for the rows instead of linking away', () => {
    renderPanel(DANGLING_AND_A_NEIGHBOUR);

    // Not a link: the loop it used to close was two pages pointing at each
    // other, and the cure is on this one.
    expect(within(danglingLine()).queryByRole('link')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Re-file them now' }));

    expect(onReviewDangling).toHaveBeenCalledTimes(1);
    // No arguments: the section finds the rows by the same rule this count was
    // measured with, so handing ids across would be a second definition of
    // "dangling" and eventually a disagreement between number and list.
    expect(onReviewDangling).toHaveBeenCalledWith();
  });

  it('reads as one row when there is one, verb and all', () => {
    renderPanel({ ...CLEAN, danglingCount: 1, hasWarnings: true });

    // "1 row POINTS at", not "1 row point at" — the agreement every other line
    // on this panel already makes. (The count sits in its own <strong>, so it
    // is asked about separately: getByText reads an element's own text nodes.)
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/^row points at a category that no longer exists/))
      .toBeInTheDocument();
    expect(screen.getByText(/re-file it so nothing is silently dropped/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-file it now' })).toBeInTheDocument();
  });

  it('reads as many when there are many', () => {
    renderPanel(DANGLING_AND_A_NEIGHBOUR);

    expect(screen.getByText(/^rows point at a category that no longer exists/))
      .toBeInTheDocument();
    expect(screen.getByText(/re-file them so nothing is silently dropped/)).toBeInTheDocument();
  });

  it('names the consequence: nothing is silently dropped', () => {
    renderPanel(DANGLING_AND_A_NEIGHBOUR);

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/so nothing is silently dropped/)).toBeInTheDocument();
  });
});

describe('the “category no longer exists” line — the amber it earns', () => {
  it('carries the warning ink, in both grounds', () => {
    renderPanel(DANGLING_AND_A_NEIGHBOUR);

    // The same treatment Categorisation's note about these rows carries, so
    // the two surfaces say one thing in one voice.
    expect(danglingLine().className).toContain('text-amber-700');
    expect(danglingLine().className).toContain('dark:text-amber-400');
  });

  it('leaves its neighbours alone — they are housekeeping, not warnings', () => {
    renderPanel(DANGLING_AND_A_NEIGHBOUR);

    expect(emptyCategoriesLine().className).not.toContain('amber');
  });

  it('is the LINE that wears it, not the panel', () => {
    renderPanel(DANGLING_AND_A_NEIGHBOUR);

    // The panel's own colour answers to the attention ladder ("which work is
    // next"), which is a different question. Standing down, it stays neutral
    // while this one finding still reads as a warning.
    const panel = screen.getByRole('region', { name: 'Data health' });
    expect(panel.className).toContain('border-line');
    expect(panel.className).not.toContain('amber');
  });

  it('still reads as a warning when the panel is lit as well', () => {
    renderPanel(DANGLING_AND_A_NEIGHBOUR, true);

    const panel = screen.getByRole('region', { name: 'Data health' });
    expect(panel.className).toContain('border-amber-300');
    expect(danglingLine().className).toContain('text-amber-700');
  });
});

describe('the “category no longer exists” line — a zero says nothing', () => {
  it('renders no line, no colour and no action when nothing dangles', () => {
    renderPanel({
      ...CLEAN,
      emptyCategoryCount: 2,
      emptyCategoryIds: ['cat-unused-a', 'cat-unused-b'],
      hasWarnings: true,
    });

    // The panel IS showing — this is a per-line rule, not an empty panel.
    expect(screen.getByText('Data health')).toBeInTheDocument();
    expect(screen.queryByText(/no longer exists/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Re-file/ })).not.toBeInTheDocument();
    // Not "0 rows", and no amber anywhere on the lines.
    expect(emptyCategoriesLine().className).not.toContain('amber');
  });
});
