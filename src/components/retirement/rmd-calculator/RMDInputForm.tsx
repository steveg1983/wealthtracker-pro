import { memo, useEffect } from 'react';
import { RMDCalculatorService, type RMDCalculation } from '../../../services/rmdCalculatorService';
import { logger } from '../../../services/loggingService';

interface RMDInputFormProps {
  calculation: RMDCalculation;
  currentYear: number;
  onCalculationChange: (calculation: RMDCalculation) => void;
}

/**
 * RMD input form component
 * Handles all inputs for RMD calculation
 */
export const RMDInputForm = memo(function RMDInputForm({
  calculation,
  currentYear,
  onCalculationChange
}: RMDInputFormProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RMDInputForm component initialized', {
      componentName: 'RMDInputForm'
    });
  }, []);

  const handleAgeChange = (age: number) => {
    onCalculationChange({
      ...calculation,
      age,
      birthYear: currentYear - age
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Current Age
        </label>
        <input
          type="number"
          value={calculation.age}
          onChange={(e) => handleAgeChange(Number(e.target.value) || 0)}
          min="50"
          max="120"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Account Balance (as of Dec 31 last year)
        </label>
        <input
          type="number"
          value={calculation.accountBalance}
          onChange={(e) => onCalculationChange({
            ...calculation,
            accountBalance: Number(e.target.value) || 0
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
          placeholder="500000"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Account Type
        </label>
        <select
          value={calculation.accountType}
          onChange={(e) => onCalculationChange({
            ...calculation,
            accountType: e.target.value as RMDCalculation['accountType']
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          {RMDCalculatorService.getAccountTypes().map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {(calculation.accountType === '401k' || calculation.accountType === '403b') && (
        <StillWorkingCheckbox
          stillWorking={calculation.stillWorking}
          onChange={(stillWorking) => onCalculationChange({ ...calculation, stillWorking })}
        />
      )}

      <SpouseBeneficiarySection
        spouseBeneficiary={calculation.spouseBeneficiary}
        spouseAge={calculation.spouseAge}
        onSpouseBeneficiaryChange={(spouseBeneficiary) => 
          onCalculationChange({ ...calculation, spouseBeneficiary })
        }
        onSpouseAgeChange={(spouseAge) => 
          onCalculationChange({ ...calculation, spouseAge })
        }
      />
    </div>
  );
});

/**
 * Still working checkbox component
 */
const StillWorkingCheckbox = memo(function StillWorkingCheckbox({
  stillWorking,
  onChange
}: {
  stillWorking: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        id="stillWorking"
        checked={stillWorking}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 text-gray-600"
      />
      <label htmlFor="stillWorking" className="text-sm font-medium text-gray-700">
        Still working for this employer (delays RMD)
      </label>
    </div>
  );
});

/**
 * Spouse beneficiary section component
 */
const SpouseBeneficiarySection = memo(function SpouseBeneficiarySection({
  spouseBeneficiary,
  spouseAge,
  onSpouseBeneficiaryChange,
  onSpouseAgeChange
}: {
  spouseBeneficiary: boolean;
  spouseAge?: number;
  onSpouseBeneficiaryChange: (value: boolean) => void;
  onSpouseAgeChange: (age?: number) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="spouseBeneficiary"
          checked={spouseBeneficiary}
          onChange={(e) => onSpouseBeneficiaryChange(e.target.checked)}
          className="h-4 w-4 text-gray-600"
        />
        <label htmlFor="spouseBeneficiary" className="text-sm font-medium text-gray-700">
          Spouse is sole beneficiary
        </label>
      </div>

      {spouseBeneficiary && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Spouse's Age
          </label>
          <input
            type="number"
            value={spouseAge || ''}
            onChange={(e) => onSpouseAgeChange(
              e.target.value ? Number(e.target.value) : undefined
            )}
            min="20"
            max="120"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            placeholder="Enter spouse's age"
          />
        </div>
      )}
    </>
  );
});