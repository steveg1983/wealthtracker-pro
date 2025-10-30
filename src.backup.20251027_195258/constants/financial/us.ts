/**
 * US Financial Constants and Tax Data
 * Updated for Tax Year 2024
 * Source: IRS.gov, SSA.gov
 */

export const US_FINANCIAL_CONSTANTS = {
  // Federal Income Tax Brackets 2024
  federalTaxBrackets: {
    single: [
      { min: 0, max: 11600, rate: 0.10 },
      { min: 11600, max: 47150, rate: 0.12 },
      { min: 47150, max: 100525, rate: 0.22 },
      { min: 100525, max: 191950, rate: 0.24 },
      { min: 191950, max: 243725, rate: 0.32 },
      { min: 243725, max: 609350, rate: 0.35 },
      { min: 609350, max: Infinity, rate: 0.37 }
    ],
    marriedFilingJointly: [
      { min: 0, max: 23200, rate: 0.10 },
      { min: 23200, max: 94300, rate: 0.12 },
      { min: 94300, max: 201050, rate: 0.22 },
      { min: 201050, max: 383900, rate: 0.24 },
      { min: 383900, max: 487450, rate: 0.32 },
      { min: 487450, max: 731200, rate: 0.35 },
      { min: 731200, max: Infinity, rate: 0.37 }
    ],
    marriedFilingSeparately: [
      { min: 0, max: 11600, rate: 0.10 },
      { min: 11600, max: 47150, rate: 0.12 },
      { min: 47150, max: 100525, rate: 0.22 },
      { min: 100525, max: 191950, rate: 0.24 },
      { min: 191950, max: 243725, rate: 0.32 },
      { min: 243725, max: 365600, rate: 0.35 },
      { min: 365600, max: Infinity, rate: 0.37 }
    ],
    headOfHousehold: [
      { min: 0, max: 16550, rate: 0.10 },
      { min: 16550, max: 63100, rate: 0.12 },
      { min: 63100, max: 100500, rate: 0.22 },
      { min: 100500, max: 191950, rate: 0.24 },
      { min: 191950, max: 243700, rate: 0.32 },
      { min: 243700, max: 609350, rate: 0.35 },
      { min: 609350, max: Infinity, rate: 0.37 }
    ]
  },
  
  // Standard Deductions 2024
  standardDeduction: {
    single: 14600,
    marriedFilingJointly: 29200,
    marriedFilingSeparately: 14600,
    headOfHousehold: 21900
  },
  
  // Retirement Account Limits 2024
  retirement: {
    traditional401k: {
      contributionLimit: 23000,
      catchUpLimit: 7500, // Additional for age 50+
      catchUpAge: 50,
      totalLimit: 69000 // Employee + employer contributions
    },
    traditionalIRA: {
      contributionLimit: 7000,
      catchUpLimit: 1000, // Additional for age 50+
      catchUpAge: 50,
      deductibilityPhaseout: {
        single: { start: 77000, end: 87000 },
        marriedFilingJointly: { start: 123000, end: 143000 }
      }
    },
    rothIRA: {
      contributionLimit: 7000,
      catchUpLimit: 1000,
      catchUpAge: 50,
      incomePhaseout: {
        single: { start: 153000, end: 161000 },
        marriedFilingJointly: { start: 240000, end: 250000 }
      }
    },
    sep: {
      contributionLimit: 69000,
      percentageLimit: 0.25 // 25% of compensation
    },
    simple: {
      contributionLimit: 16000,
      catchUpLimit: 3500,
      catchUpAge: 50
    }
  },
  
  // Social Security 2024
  socialSecurity: {
    wageBase: 168600, // Maximum taxable earnings
    taxRate: 0.062, // Employee portion
    fullRetirementAge: {
      bornBefore1955: 66,
      born1955: 66.17, // 66 and 2 months
      born1956: 66.33, // 66 and 4 months
      born1957: 66.5,  // 66 and 6 months
      born1958: 66.67, // 66 and 8 months
      born1959: 66.83, // 66 and 10 months
      born1960OrLater: 67
    },
    earlyRetirement: {
      minAge: 62,
      reduction: 0.30 // 30% reduction if taken at 62 (born 1960+)
    },
    delayedRetirement: {
      maxAge: 70,
      creditPerYear: 0.08 // 8% increase per year after FRA
    },
    benefitTaxThresholds: {
      single: {
        noTax: 25000,
        partialTax: 34000 // 50% taxable up to this, 85% above
      },
      marriedFilingJointly: {
        noTax: 32000,
        partialTax: 44000
      }
    }
  },
  
  // Medicare 2024
  medicare: {
    eligibilityAge: 65,
    partA: {
      premium: 0, // For those with 40 quarters of coverage
      deductible: 1632,
      coinsurance: {
        days1to60: 0,
        days61to90: 408, // Per day
        days91plus: 816  // Per lifetime reserve day
      }
    },
    partB: {
      standardPremium: 174.70,
      deductible: 240,
      irmaaThresholds: [ // Income-related monthly adjustment
        { single: 103000, married: 206000, premium: 244.60 },
        { single: 129000, married: 258000, premium: 349.40 },
        { single: 161000, married: 322000, premium: 454.20 },
        { single: 193000, married: 386000, premium: 559.00 },
        { single: 500000, married: 750000, premium: 594.00 }
      ]
    },
    taxRate: 0.0145 // Employee portion, no wage limit
  },
  
  // Capital Gains Tax Rates 2024
  capitalGains: {
    shortTerm: 'ordinary', // Taxed as ordinary income
    longTerm: {
      single: [
        { min: 0, max: 47025, rate: 0 },
        { min: 47025, max: 518900, rate: 0.15 },
        { min: 518900, max: Infinity, rate: 0.20 }
      ],
      marriedFilingJointly: [
        { min: 0, max: 94050, rate: 0 },
        { min: 94050, max: 583750, rate: 0.15 },
        { min: 583750, max: Infinity, rate: 0.20 }
      ]
    },
    netInvestmentIncomeTax: {
      rate: 0.038, // 3.8% additional tax
      thresholds: {
        single: 200000,
        marriedFilingJointly: 250000,
        marriedFilingSeparately: 125000
      }
    }
  },
  
  // Mortgage Related
  mortgage: {
    conformingLoanLimits: {
      baseline: 766550,
      highCost: 1149825 // 150% of baseline for expensive areas
    },
    fha: {
      loanLimit: 498257,
      minDownPayment: 0.035, // 3.5%
      mortgageInsurancePremium: {
        upfront: 0.0175, // 1.75% of loan amount
        annual: 0.0055 // 0.55% for most loans
      }
    },
    va: {
      fundingFee: {
        firstUse: 0.023, // 2.3% for 0% down
        subsequentUse: 0.036 // 3.6% for 0% down
      }
    },
    mortgageInterestDeduction: {
      limit: 750000, // For mortgages after Dec 15, 2017
      limitOld: 1000000 // For mortgages before Dec 15, 2017
    }
  },
  
  // State and Local Tax (SALT) Deduction
  salt: {
    deductionLimit: 10000
  },
  
  // Health Savings Account (HSA) 2024
  hsa: {
    contributionLimit: {
      individual: 4150,
      family: 8300,
      catchUp: 1000 // Age 55+
    },
    minimumDeductible: {
      individual: 1600,
      family: 3200
    },
    maxOutOfPocket: {
      individual: 8050,
      family: 16100
    }
  },
  
  // Flexible Spending Account (FSA) 2024
  fsa: {
    healthCare: {
      contributionLimit: 3200,
      carryover: 640 // Maximum carryover to next year
    },
    dependentCare: {
      contributionLimit: 5000, // Per household
      limitSingleOrSeparate: 2500
    }
  },
  
  // Estate and Gift Tax 2024
  estate: {
    exemption: 13610000, // Per person
    taxRate: 0.40, // Top rate
    annualGiftExclusion: 18000, // Per recipient
    lifetimeGiftExemption: 13610000
  },
  
  // Alternative Minimum Tax (AMT) 2024
  amt: {
    exemption: {
      single: 85700,
      marriedFilingJointly: 133300,
      marriedFilingSeparately: 66650
    },
    phaseout: {
      single: 609350,
      marriedFilingJointly: 1218700,
      marriedFilingSeparately: 609350
    },
    rates: [
      { max: 220700, rate: 0.26 }, // First $220,700 (MFJ)
      { min: 220700, rate: 0.28 }  // Above $220,700
    ]
  },
  
  // Required Minimum Distributions (RMD)
  rmd: {
    startAge: 73, // As of 2023 SECURE Act 2.0
    uniformLifetimeTable: [
      { age: 73, factor: 26.5 },
      { age: 74, factor: 25.5 },
      { age: 75, factor: 24.6 },
      { age: 76, factor: 23.7 },
      { age: 77, factor: 22.9 },
      { age: 78, factor: 22.0 },
      { age: 79, factor: 21.1 },
      { age: 80, factor: 20.2 },
      // ... continues with decreasing factors
    ]
  }
};

// State tax information (simplified - would need full tables in production)
export const STATE_TAX_RATES = {
  // No income tax states
  noTax: ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'],
  
  // Flat tax states (2024 rates)
  flat: {
    'CO': 0.044,
    'IL': 0.0495,
    'IN': 0.0323,
    'KY': 0.045,
    'MA': 0.05,
    'MI': 0.0425,
    'NC': 0.045,
    'PA': 0.0307,
    'UT': 0.0485
  },
  
  // Progressive tax states would need full bracket tables
  // This is simplified for demonstration
  progressive: {
    'CA': { min: 0.01, max: 0.133 }, // 1% to 13.3%
    'NY': { min: 0.04, max: 0.109 },  // 4% to 10.9%
    'NJ': { min: 0.014, max: 0.109 }, // 1.4% to 10.9%
    // ... other states
  }
};