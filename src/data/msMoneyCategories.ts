import type { CategoryTreeGroup } from '../utils/categoryTreeImport';

/**
 * Microsoft Money (UK) starter category set.
 *
 * Transcribed from a real Money Plus Sunset "Set up your categories" list.
 * Money's two levels map onto the app's hierarchy as:
 *   Money Category    → 'sub'    (under the Income/Expense type category)
 *   Money Subcategory → 'detail' (selectable on transactions)
 * Money's "Category Group" reporting rollup has no equivalent level and is
 * intentionally dropped. Groups with no subcategories get a single detail of
 * the same name so they remain selectable.
 */
export const MS_MONEY_CATEGORY_SET: CategoryTreeGroup[] = [
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
      'Other Bills',
      'Other Bills (Private/Not Seen)',
      'Telephone/Broadband/Sky/Tv Licence',
      'Water & Sewerage',
    ],
  },
  {
    name: 'Cars & Bikes',
    type: 'expense',
    children: [
      'Financing & Leasing Charges',
      'Insurance',
      'Other Costs',
      'Other/Misc Costs (Private/Not Seen)',
      'Petrol / Diesel',
      'Petrol / Diesel - (Private/Not Seen)',
      'Road Tax',
      'Servicing, Maintenance & Repairs',
      'Servicing, Maintenance & Repairs (Trackday/Sports Car Related)',
      'Taxis/UBER',
      'Taxis/UBER (Private/Not Seen)',
      'Trackday Related',
      'Trackday Related (Private/Not Seen)',
    ],
  },
  {
    name: 'Child Costs',
    type: 'expense',
    children: [
      'Child Support/Maintenance',
      'Clothes',
      'Days Out',
      'Other Child Costs (Private/Not Seen)',
      'Other/Misc',
      'School Related',
    ],
  },
  {
    name: 'Computer Related',
    type: 'expense',
    children: ['Hardware', 'Other Computer', 'Other Computer (Private/Not Seen)', 'Software'],
  },
  {
    name: 'Food Related Costs',
    type: 'expense',
    children: [
      'Dining Out',
      'Dining Out (Private/Not Seen)',
      'Food Shopping',
      'Food Shopping (Private/Not Seen)',
      'Takeaways',
      'Takeaways (Private/Not Seen)',
    ],
  },
  {
    name: 'Gifts',
    type: 'expense',
    children: ['Birthday Gifts', 'Other Gifts', 'Other Gifts (Private/Not Seen)', 'Xmas Gifts'],
  },
  {
    name: 'Healthcare',
    type: 'expense',
    children: ['Counsellor', 'Dental', 'Eyecare', 'Hospital', 'Life Insurance'],
  },
  {
    name: 'Holidays',
    type: 'expense',
    children: ['Family Holidays', 'Other', 'Other (Private/Not Seen)', 'Weekend Holidays'],
  },
  {
    name: 'Household',
    type: 'expense',
    children: [
      'Buying & Selling Costs',
      'Cleaning & Ironing',
      'Consumables',
      'Consumables (Private/Not Seen)',
      'Furnishings',
      'Improvements',
      'Insurance',
      'Maintenance, Repairs & Gardening',
      'Other/Misc (Private/Not Seen)',
    ],
  },
  {
    name: 'Personal',
    type: 'expense',
    children: [
      'Gem - House/Other',
      'Gem - Legal Fees',
      'Gem - Maintenance',
      'Steve - (Kids Investments)',
      'Steve - Cash Withdrawals',
      'Steve - Cash Withdrawals - (Private/Not Seen)',
      'Steve - Clothing',
      'Steve - Clothing - (Private/Not Seen)',
      'Steve - General',
      'Steve - General - (Private/Not Seen)',
      'Steve - John Green',
      'Steve - Legal & Professional',
    ],
  },
  {
    name: 'Xfer to Deleted Account',
    type: 'expense',
    children: [],
  },

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
    children: ['Consultancy', 'Net Pay', 'Net Pay - Golf Club'],
  },
  {
    name: 'Xfer from Deleted Account',
    type: 'income',
    children: [],
  },
];
