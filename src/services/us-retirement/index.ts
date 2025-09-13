/**
 * US Retirement Service Module
 * Comprehensive US retirement planning and calculations
 */

// Main service
export { usRetirementService, USRetirementService } from './usRetirementService';

// Calculators
export { socialSecurityCalculator, SocialSecurityCalculator } from './socialSecurityCalculator';
export { retirement401kCalculator, Retirement401kCalculator } from './retirement401kCalculator';
export { iraCalculator, IRACalculator } from './iraCalculator';
export { medicareCalculator, MedicareCalculator } from './medicareCalculator';
export { retirementOptimizer, RetirementOptimizer } from './retirementOptimizer';

// Types
export type {
  SocialSecurityCalculation,
  Retirement401kCalculation,
  IRACalculation,
  MedicareEstimate,
  USRetirementProjection,
  RetirementProjectionParams,
  OptimizationRecommendation
} from './types';