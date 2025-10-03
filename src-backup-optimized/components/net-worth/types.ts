export interface NetWorthProjection {
  currentNetWorth: number;
  projectedNetWorth: number;
  monthlyChange: number;
  yearlyChange: number;
  projectionYears: Array<{
    year: number;
    netWorth: number;
    assets: number;
    liabilities: number;
    change: number;
  }>;
  milestones: Array<{
    amount: number;
    expectedDate: Date;
    yearsAway: number;
  }>;
}

export interface NetWorthPlannerProps {
  onDataChange: () => void;
}

export interface AccountBreakdown {
  name: string;
  type: string;
  balance: number;
  icon: React.ReactNode;
}

export interface ProjectionSettings {
  projectionYears: number;
  assumedGrowthRate: number;
  monthlySavings: number;
  inflationRate: number;
}

export const DEFAULT_PROJECTION_SETTINGS: ProjectionSettings = {
  projectionYears: 10,
  assumedGrowthRate: 0.06,
  monthlySavings: 0,
  inflationRate: 0.02
};

export const MILESTONE_AMOUNTS = [
  10000,
  25000,
  50000,
  100000,
  250000,
  500000,
  1000000
];