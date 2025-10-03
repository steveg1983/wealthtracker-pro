/**
 * Subscription Page - Route handler for subscription management
 */

import React from 'react';
import { SubscriptionPage } from '../components/subscription';
import PageWrapper from '../components/PageWrapper';

export default function Subscription(): React.JSX.Element {
  return (
    <PageWrapper title="Subscription" description="Manage your WealthTracker subscription">
      <SubscriptionPage />
    </PageWrapper>
  );
}