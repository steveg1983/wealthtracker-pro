/**
 * UK Financial Constants and Tax Data
 * Updated for Tax Year 2024/25 (6 April 2024 - 5 April 2025)
 * Source: HMRC.gov.uk, GOV.UK
 */

export const UK_FINANCIAL_CONSTANTS = {
  // Income Tax Bands 2024/25 (England, Wales, Northern Ireland)
  incomeTaxBands: {
    englishWelshNI: [
      { min: 0, max: 12570, rate: 0, name: 'Personal Allowance' },
      { min: 12570, max: 50270, rate: 0.20, name: 'Basic Rate' },
      { min: 50270, max: 125140, rate: 0.40, name: 'Higher Rate' },
      { min: 125140, max: Infinity, rate: 0.45, name: 'Additional Rate' }
    ],
    // Scotland has different bands
    scottish: [
      { min: 0, max: 12570, rate: 0, name: 'Personal Allowance' },
      { min: 12570, max: 14876, rate: 0.19, name: 'Starter Rate' },
      { min: 14876, max: 26561, rate: 0.20, name: 'Basic Rate' },
      { min: 26561, max: 43662, rate: 0.21, name: 'Intermediate Rate' },
      { min: 43662, max: 125140, rate: 0.42, name: 'Higher Rate' },
      { min: 125140, max: Infinity, rate: 0.47, name: 'Top Rate' }
    ],
    // Personal Allowance reduction
    personalAllowanceReduction: {
      threshold: 100000, // Starts reducing at £100k
      reductionRate: 0.5, // £1 for every £2 over threshold
      zeroAt: 125140 // Completely gone at this income
    }
  },
  
  // National Insurance 2024/25
  nationalInsurance: {
    class1: {
      employee: [
        { min: 0, max: 242, rate: 0, period: 'weekly' }, // Below primary threshold
        { min: 242, max: 967, rate: 0.08, period: 'weekly' }, // 8% (reduced from 10% in Jan 2024)
        { min: 967, max: Infinity, rate: 0.02, period: 'weekly' } // 2% above upper limit
      ],
      employer: [
        { min: 0, max: 175, rate: 0, period: 'weekly' }, // Below secondary threshold
        { min: 175, max: Infinity, rate: 0.138, period: 'weekly' } // 13.8%
      ],
      annualThresholds: {
        primaryThreshold: 12570,
        upperEarningsLimit: 50270,
        secondaryThreshold: 9100
      }
    },
    class2: {
      weeklyRate: 3.45,
      smallProfitsThreshold: 6725 // Annual
    },
    class3: {
      weeklyRate: 17.45 // Voluntary contributions
    },
    class4: {
      lowerProfitsLimit: 12570,
      upperProfitsLimit: 50270,
      mainRate: 0.06, // 6% (reduced from 9% in April 2024)
      additionalRate: 0.02 // 2% above upper limit
    }
  },
  
  // Pension Contributions 2024/25
  pensions: {
    statePension: {
      fullNewStatePension: 221.20, // Per week
      fullOldStatePension: 169.50, // Per week (reached SPA before April 2016)
      qualifyingYears: 35, // For full new state pension
      minQualifyingYears: 10, // Minimum to get any state pension
      pensionAge: {
        bornBefore1960: 66,
        born1960to1961: 67,
        born1961to1977: 68, // Gradually increasing
        bornAfter1977: 68 // Subject to review
      }
    },
    workplace: {
      autoEnrollment: {
        minAge: 22,
        maxAge: 'statePensionAge',
        earningsThreshold: 10000, // Annual
        minContribution: {
          employee: 0.05, // 5%
          employer: 0.03, // 3%
          total: 0.08 // 8% minimum
        }
      }
    },
    personalPension: {
      annualAllowance: 60000, // Increased from £40k in 2023/24
      taperedAnnualAllowance: {
        threshold: 260000, // Adjusted income threshold
        minAllowance: 10000,
        reductionRate: 0.5 // £1 for every £2 over threshold
      },
      lifetimeAllowance: null, // Abolished from April 2024
      carryForward: 3, // Can carry forward 3 previous years' unused allowance
      taxRelief: {
        basicRate: 0.20,
        higherRate: 0.40,
        additionalRate: 0.45
      }
    },
    minimumPensionAge: {
      current: 55,
      from2028: 57
    }
  },
  
  // ISA Allowances 2024/25
  isa: {
    annual: {
      total: 20000,
      junior: 9000,
      lifetime: 4000 // Max contribution to Lifetime ISA
    },
    lifetime: {
      maxAge: 50, // Can't contribute after 50
      minAge: 18, // Must be 18-39 to open
      maxOpeningAge: 39,
      governmentBonus: 0.25, // 25% bonus
      maxPropertyPrice: 450000, // For first-time buyer
      withdrawalPenalty: 0.25 // If not for house/retirement
    },
    types: ['Cash', 'Stocks & Shares', 'Innovative Finance', 'Lifetime']
  },
  
  // Capital Gains Tax 2024/25
  capitalGains: {
    annualExemption: 3000, // Reduced from £6,000 in 2023/24
    rates: {
      basic: {
        standard: 0.10, // 10% for basic rate taxpayers
        residential: 0.18 // 18% for residential property
      },
      higher: {
        standard: 0.20, // 20% for higher rate taxpayers
        residential: 0.24 // 24% for residential property (reduced from 28%)
      }
    },
    businessAssetDisposalRelief: {
      lifetimeLimit: 1000000,
      rate: 0.10
    }
  },
  
  // Dividend Tax 2024/25
  dividendTax: {
    allowance: 500, // Reduced from £1,000 in 2023/24
    rates: {
      basic: 0.0875,     // 8.75%
      higher: 0.3375,    // 33.75%
      additional: 0.393  // 39.35%
    }
  },
  
  // Stamp Duty Land Tax 2024/25 (England & Northern Ireland)
  stampDuty: {
    residential: {
      standard: [
        { min: 0, max: 250000, rate: 0 },
        { min: 250000, max: 925000, rate: 0.05 },
        { min: 925000, max: 1500000, rate: 0.10 },
        { min: 1500000, max: Infinity, rate: 0.12 }
      ],
      firstTimeBuyer: [
        { min: 0, max: 425000, rate: 0 }, // No tax up to £425k
        { min: 425000, max: 625000, rate: 0.05 },
        // No relief above £625,000 - standard rates apply
      ],
      additionalProperty: 0.03 // 3% surcharge on all bands
    },
    nonResidential: [
      { min: 0, max: 150000, rate: 0 },
      { min: 150000, max: 250000, rate: 0.02 },
      { min: 250000, max: Infinity, rate: 0.05 }
    ]
  },
  
  // Scottish Land and Buildings Transaction Tax (LBTT)
  lbtt: {
    residential: [
      { min: 0, max: 145000, rate: 0 },
      { min: 145000, max: 250000, rate: 0.02 },
      { min: 250000, max: 325000, rate: 0.05 },
      { min: 325000, max: 750000, rate: 0.10 },
      { min: 750000, max: Infinity, rate: 0.12 }
    ],
    firstTimeBuyer: [
      { min: 0, max: 175000, rate: 0 } // No tax up to £175k
    ],
    additionalDwelling: 0.06 // 6% surcharge
  },
  
  // Welsh Land Transaction Tax (LTT)
  ltt: {
    residential: [
      { min: 0, max: 225000, rate: 0 },
      { min: 225000, max: 400000, rate: 0.06 },
      { min: 400000, max: 750000, rate: 0.075 },
      { min: 750000, max: 1500000, rate: 0.10 },
      { min: 1500000, max: Infinity, rate: 0.12 }
    ],
    higherRate: 0.04 // 4% surcharge for additional properties
  },
  
  // Inheritance Tax 2024/25
  inheritanceTax: {
    nilRateBand: 325000,
    residenceNilRateBand: 175000, // Additional for main residence to direct descendants
    standardRate: 0.40, // 40%
    reducedRate: 0.36, // 36% if 10% or more left to charity
    tapering: {
      threshold: 2000000, // Estate value where RNRB starts tapering
      rate: 0.5 // £1 for every £2 over threshold
    },
    gifts: {
      annualExemption: 3000,
      smallGifts: 250, // Per person per year
      wedding: {
        parent: 5000,
        grandparent: 2500,
        other: 1000
      },
      taperRelief: [ // For gifts made 3-7 years before death
        { years: 3, reduction: 0.20 },
        { years: 4, reduction: 0.40 },
        { years: 5, reduction: 0.60 },
        { years: 6, reduction: 0.80 },
        { years: 7, reduction: 1.00 }
      ]
    }
  },
  
  // Council Tax Bands (varies by location - this is example)
  councilTax: {
    bands: {
      'A': { min: 0, max: 40000 },
      'B': { min: 40000, max: 52000 },
      'C': { min: 52000, max: 68000 },
      'D': { min: 68000, max: 88000 },
      'E': { min: 88000, max: 120000 },
      'F': { min: 120000, max: 160000 },
      'G': { min: 160000, max: 320000 },
      'H': { min: 320000, max: Infinity }
    },
    discounts: {
      singleOccupancy: 0.25,
      studentHousehold: 1.00,
      empty: 0 // Varies by council
    }
  },
  
  // Student Loan Repayment 2024/25
  studentLoan: {
    plan1: {
      threshold: 22015, // Annual
      rate: 0.09 // 9% of income above threshold
    },
    plan2: {
      threshold: 27295, // Annual
      rate: 0.09
    },
    plan4: { // Scotland
      threshold: 27660,
      rate: 0.09
    },
    plan5: {
      threshold: 25000,
      rate: 0.09
    },
    postgraduate: {
      threshold: 21000,
      rate: 0.06
    }
  },
  
  // Child Benefit 2024/25
  childBenefit: {
    rates: {
      eldest: 25.60, // Per week
      additional: 16.95 // Per week per additional child
    },
    highIncomeCharge: {
      threshold: 60000, // Starts at £60k (increased from £50k)
      fullCharge: 80000, // 100% charge at £80k (increased from £60k)
      chargeRate: 0.01 // 1% for every £200 over threshold
    }
  },
  
  // Marriage Allowance 2024/25
  marriageAllowance: {
    amount: 1260, // Can transfer to spouse
    eligibility: {
      transferor: 'notHigherRateTaxpayer',
      recipient: 'basicRateTaxpayer'
    }
  },
  
  // Help to Buy Schemes
  helpToBuy: {
    equityLoan: {
      maxLoanPercent: 0.20, // 20% (40% in London)
      maxLoanPercentLondon: 0.40,
      maxPropertyPrice: 600000,
      minDeposit: 0.05 // 5%
    },
    sharedOwnership: {
      minShare: 0.10, // Can buy 10% minimum
      maxShare: 0.75, // Usually 75% maximum
      rent: 'onRemainingShare' // Pay rent on unowned portion
    }
  },
  
  // VAT Rates
  vat: {
    standard: 0.20,
    reduced: 0.05, // Home energy, children's car seats, etc.
    zero: 0 // Food, children's clothes, books, etc.
  }
};

// UK Bank Holidays (affects payment dates)
export const UK_BANK_HOLIDAYS_2024 = [
  '2024-01-01', // New Year's Day
  '2024-03-29', // Good Friday
  '2024-04-01', // Easter Monday
  '2024-05-06', // Early May bank holiday
  '2024-05-27', // Spring bank holiday
  '2024-08-26', // Summer bank holiday
  '2024-12-25', // Christmas Day
  '2024-12-26', // Boxing Day
];

// Regions with different tax rules
export const UK_REGIONS = {
  england: ['England'],
  scotland: ['Scotland'],
  wales: ['Wales'],
  northernIreland: ['Northern Ireland']
};