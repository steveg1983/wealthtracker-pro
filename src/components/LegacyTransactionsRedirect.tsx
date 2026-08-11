import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { legacyTransactionsDestination } from './legacyTransactionsDestination';

/**
 * The retired `/transactions` address, still answering. The rules — and why
 * they are what they are — live in legacyTransactionsDestination beside this.
 */
export default function LegacyTransactionsRedirect(): React.JSX.Element {
  const location = useLocation();
  const { pathname, search } = legacyTransactionsDestination(location.search);
  // `replace`, so the retired address does not sit in the back button waiting
  // to bounce the user straight back out of wherever they landed.
  return <Navigate to={{ pathname, search }} replace />;
}
