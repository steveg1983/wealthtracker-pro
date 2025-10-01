import React from 'react';
import PageWrapper from '../components/PageWrapper';
import { PerformanceDashboard } from '../components/PerformanceDashboard';

const Performance: React.FC = () => {
  return (
    <PageWrapper title="Performance">
      <PerformanceDashboard />
    </PageWrapper>
  );
};

export default Performance;