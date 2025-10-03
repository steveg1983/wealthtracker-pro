/**
 * Lazy-loaded chart components to reduce bundle size
 * Only loads Recharts when actually rendered
 */

import React, { lazy, Suspense } from 'react';
import { LoadingSpinner } from '../LoadingSpinner';

// Lazy load each chart component
export const LazySpendingByCategoryChart = lazy(() => import('../SpendingByCategoryChart'));
export const LazyIncomeVsExpensesChart = lazy(() => import('../IncomeVsExpensesChart'));
export const LazyAccountBalancesChart = lazy(() => import('../AccountBalancesChart'));
export const LazyAllocationAnalysis = lazy(() => import('../AllocationAnalysis'));
export const LazyDebtManagement = lazy(() => import('../DebtManagement'));
export const LazyPortfolioRebalancer = lazy(() => import('../PortfolioRebalancer'));

// Chart wrapper with loading state
export function LazyChart({
  Component,
  ...props
}: {
  Component: React.ComponentType<any>;
  [key: string]: any;
}) {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading chart..." />}>
      <Component {...props} />
    </Suspense>
  );
}

// Export convenient wrappers for each chart
export function SpendingChart(props: any) {
  return <LazyChart Component={LazySpendingByCategoryChart} {...props} />;
}

export function IncomeExpenseChart(props: any) {
  return <LazyChart Component={LazyIncomeVsExpensesChart} {...props} />;
}

export function BalancesChart(props: any) {
  return <LazyChart Component={LazyAccountBalancesChart} {...props} />;
}

export function AllocationChart(props: any) {
  return <LazyChart Component={LazyAllocationAnalysis} {...props} />;
}

export function DebtChart(props: any) {
  return <LazyChart Component={LazyDebtManagement} {...props} />;
}

export function PortfolioChart(props: any) {
  return <LazyChart Component={LazyPortfolioRebalancer} {...props} />;
}