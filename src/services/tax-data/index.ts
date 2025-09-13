/**
 * Tax Data Service Module
 * Provides comprehensive tax calculation, verification, and update services
 */

// Main service
export { taxDataService, TaxDataService } from './taxDataService';

// Tax calculator
export { taxCalculator, TaxCalculator } from './taxCalculator';

// Tax verifier
export { taxVerifier, TaxVerifier } from './taxVerifier';

// Tax updater
export { taxUpdater, TaxUpdater } from './taxUpdater';

// Types
export type {
  // Core types
  TaxDataVersion,
  TaxUpdateNotification,
  TaxVerificationResult,
  TaxTestCase,
  UKTaxYear,
  USFilingStatus,
  
  // Tax structure types
  TaxBracket,
  StandardDeduction,
  TaxConstants,
  
  // Calculation types
  TaxCalculationResult,
  TaxBreakdown,
  
  // Update types
  TaxDataUpdate,
  TaxDataCache
} from './types';