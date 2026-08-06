/**
 * The bank-link wizard's one non-account choice. It lives in its own module
 * (not in the modal) so the picker and the modal can agree on the sentinel
 * without either importing the other.
 *
 * Grouping and searching used to live here too, in a second table of section
 * titles that had drifted from the app's own ("Savings" vs "Savings Accounts",
 * a "Mortgages" band the Accounts page files under Loans). Both now come from
 * `utils/accountGrouping`, which the whole app shares.
 */
export const CREATE_NEW_VALUE = '__create_new__';
