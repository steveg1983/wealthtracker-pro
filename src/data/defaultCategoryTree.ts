import type { CategoryTreeGroup } from '../utils/categoryTreeImport';

/**
 * The starter category tree every NEW user is seeded with.
 *
 * Curated by the owner (2026-08-05) from the classic Microsoft Money (UK)
 * set, with the personal and household-specific entries removed — a fresh
 * account gets a neutral, sensible UK tree it can immediately file against.
 * Every group carries an Other/Misc catch-all by design. Existing users are
 * never touched by this list: it only seeds accounts with no categories yet.
 *
 * Money's two levels map onto the app's hierarchy as:
 *   group → 'sub'    (under the Income/Expense type anchor)
 *   child → 'detail' (selectable on transactions)
 * A group with no children gets a single self-named detail so it remains
 * selectable (utils/categoryTreeImport.ts).
 */
export const DEFAULT_CATEGORY_TREE: CategoryTreeGroup[] = [
  // ── Income ─────────────────────────────────────────────────────────────────
  {
    name: 'Investment Income',
    type: 'income',
    children: ['Bank Interest', 'Capital Gains', 'Dividends', 'Interest', 'Mortgage Income', 'Other Income'],
  },
  {
    name: 'Other Income',
    type: 'income',
    children: ['Child Benefit', 'Rental Income'],
  },
  {
    name: 'Wages & Salary',
    type: 'income',
    children: ['Gross Pay', 'Net Pay', 'Consultancy', 'Other/Misc'],
  },

  // ── Expense ────────────────────────────────────────────────────────────────
  {
    name: 'Bank & Portfolio Charges',
    type: 'expense',
    children: ['Bank Charges & Fees', 'Interest Paid', 'Loan Interest Paid'],
  },
  {
    name: 'Bills (Household)',
    type: 'expense',
    children: [
      'Council Tax',
      'Gas & Electricity',
      'Mobile Phone',
      'Telephone/Broadband/Sky/Tv Licence',
      'Water & Sewerage',
      'Other/Misc',
    ],
  },
  {
    name: 'Cars & Bikes',
    type: 'expense',
    children: [
      'Financing & Leasing Charges',
      'Insurance',
      'Fuel Costs',
      'Road Tax',
      'Servicing, Maintenance & Repairs',
      'Other/Misc',
    ],
  },
  {
    name: 'Child Costs',
    type: 'expense',
    children: ['Clothes', 'Days Out', 'School Related', 'Other/Misc'],
  },
  {
    name: 'Food Related Costs',
    type: 'expense',
    children: ['Dining Out', 'Food Shopping', 'Coffee Shops', 'Other/Misc'],
  },
  {
    name: 'Gifts',
    type: 'expense',
    children: ['Gifts'],
  },
  {
    name: 'Healthcare',
    type: 'expense',
    children: ['Dental', 'Eyecare', 'Hospital', 'Life Insurance', 'Other/Misc'],
  },
  {
    name: 'Holidays',
    type: 'expense',
    children: ['Family Holidays', 'Other/Misc'],
  },
  {
    name: 'Household',
    type: 'expense',
    children: [
      'Buying & Selling Costs',
      'Cleaning Costs',
      'Consumables',
      'Furnishings',
      'Improvements',
      'Insurance',
      'Maintenance, Repairs & Gardening',
      'Other/Misc',
    ],
  },
  {
    name: 'Personal',
    type: 'expense',
    children: ['Cash Withdrawals', 'Clothing', 'Other/Misc'],
  },
];
