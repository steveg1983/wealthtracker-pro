/**
 * US Mortgage Form Service
 * Handles US-specific mortgage calculations and data
 */

export interface USState {
  code: string;
  name: string;
}

export interface CreditScoreCategory {
  label: string;
  color: string;
  description: string;
}

export interface LoanTypeInfo {
  minDown: number;
  pmi: boolean;
  description: string;
  benefits: string[];
  requirements: string[];
}

class USMortgageFormService {
  /**
   * Get all US states
   */
  getUSStates(): USState[] {
    return [
      { code: 'AL', name: 'Alabama' },
      { code: 'AK', name: 'Alaska' },
      { code: 'AZ', name: 'Arizona' },
      { code: 'AR', name: 'Arkansas' },
      { code: 'CA', name: 'California' },
      { code: 'CO', name: 'Colorado' },
      { code: 'CT', name: 'Connecticut' },
      { code: 'DE', name: 'Delaware' },
      { code: 'FL', name: 'Florida' },
      { code: 'GA', name: 'Georgia' },
      { code: 'HI', name: 'Hawaii' },
      { code: 'ID', name: 'Idaho' },
      { code: 'IL', name: 'Illinois' },
      { code: 'IN', name: 'Indiana' },
      { code: 'IA', name: 'Iowa' },
      { code: 'KS', name: 'Kansas' },
      { code: 'KY', name: 'Kentucky' },
      { code: 'LA', name: 'Louisiana' },
      { code: 'ME', name: 'Maine' },
      { code: 'MD', name: 'Maryland' },
      { code: 'MA', name: 'Massachusetts' },
      { code: 'MI', name: 'Michigan' },
      { code: 'MN', name: 'Minnesota' },
      { code: 'MS', name: 'Mississippi' },
      { code: 'MO', name: 'Missouri' },
      { code: 'MT', name: 'Montana' },
      { code: 'NE', name: 'Nebraska' },
      { code: 'NV', name: 'Nevada' },
      { code: 'NH', name: 'New Hampshire' },
      { code: 'NJ', name: 'New Jersey' },
      { code: 'NM', name: 'New Mexico' },
      { code: 'NY', name: 'New York' },
      { code: 'NC', name: 'North Carolina' },
      { code: 'ND', name: 'North Dakota' },
      { code: 'OH', name: 'Ohio' },
      { code: 'OK', name: 'Oklahoma' },
      { code: 'OR', name: 'Oregon' },
      { code: 'PA', name: 'Pennsylvania' },
      { code: 'RI', name: 'Rhode Island' },
      { code: 'SC', name: 'South Carolina' },
      { code: 'SD', name: 'South Dakota' },
      { code: 'TN', name: 'Tennessee' },
      { code: 'TX', name: 'Texas' },
      { code: 'UT', name: 'Utah' },
      { code: 'VT', name: 'Vermont' },
      { code: 'VA', name: 'Virginia' },
      { code: 'WA', name: 'Washington' },
      { code: 'WV', name: 'West Virginia' },
      { code: 'WI', name: 'Wisconsin' },
      { code: 'WY', name: 'Wyoming' }
    ];
  }

  /**
   * Get credit score category based on score
   */
  getCreditScoreCategory(score: number): CreditScoreCategory {
    if (score >= 800) {
      return { 
        label: 'Excellent', 
        color: 'text-green-600 dark:text-green-400', 
        description: 'Best rates available' 
      };
    }
    if (score >= 740) {
      return { 
        label: 'Very Good', 
        color: 'text-green-600 dark:text-green-400', 
        description: 'Qualify for good rates' 
      };
    }
    if (score >= 670) {
      return { 
        label: 'Good', 
        color: 'text-yellow-600 dark:text-yellow-400', 
        description: 'Average rates' 
      };
    }
    if (score >= 580) {
      return { 
        label: 'Fair', 
        color: 'text-orange-600 dark:text-orange-400', 
        description: 'Higher rates, FHA eligible' 
      };
    }
    return { 
      label: 'Poor', 
      color: 'text-red-600 dark:text-red-400', 
      description: 'Limited options, high rates' 
    };
  }

  /**
   * Get loan type information
   */
  getLoanTypeInfo(loanType: string, downPaymentPercent: number): LoanTypeInfo | null {
    switch (loanType) {
      case 'conventional':
        return {
          minDown: 3,
          pmi: downPaymentPercent < 20,
          description: 'Standard loan, PMI required if down payment < 20%',
          benefits: [
            'No upfront mortgage insurance', 
            'Can be used for any property type', 
            'No income limits'
          ],
          requirements: [
            'Good credit score (620+)', 
            'Stable income', 
            'Debt-to-income ratio < 43%'
          ]
        };
      
      case 'fha':
        return {
          minDown: 3.5,
          pmi: true,
          description: 'Government-backed loan with lower credit requirements',
          benefits: [
            'Lower credit score accepted (580+)', 
            'Lower down payment', 
            'Gift funds allowed'
          ],
          requirements: [
            'Mortgage insurance required', 
            'Property must be primary residence', 
            'Loan limits apply'
          ]
        };
      
      case 'va':
        return {
          minDown: 0,
          pmi: false,
          description: 'For veterans and active military, no down payment required',
          benefits: [
            'No down payment required', 
            'No PMI', 
            'Competitive interest rates'
          ],
          requirements: [
            'Military service required', 
            'VA funding fee', 
            'Primary residence only'
          ]
        };
      
      case 'usda':
        return {
          minDown: 0,
          pmi: true,
          description: 'Rural and suburban homebuyers, no down payment',
          benefits: [
            'No down payment required', 
            'Lower interest rates', 
            'Flexible credit guidelines'
          ],
          requirements: [
            'Property in eligible rural area', 
            'Income limits apply', 
            'Primary residence only'
          ]
        };
      
      case 'jumbo':
        return {
          minDown: 10,
          pmi: false,
          description: 'For loan amounts exceeding conforming limits',
          benefits: [
            'Finance expensive properties', 
            'Competitive rates for qualified borrowers'
          ],
          requirements: [
            'Excellent credit (700+)', 
            'Large down payment', 
            'Significant cash reserves'
          ]
        };
      
      default:
        return null;
    }
  }

  /**
   * Validate form data
   */
  validateFormData(formData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (formData.homePrice <= 0) {
      errors.push('Home price must be greater than 0');
    }

    if (formData.downPayment < 0) {
      errors.push('Down payment cannot be negative');
    }

    if (formData.downPayment > formData.homePrice) {
      errors.push('Down payment cannot exceed home price');
    }

    if (formData.interestRate < 0 || formData.interestRate > 20) {
      errors.push('Interest rate must be between 0% and 20%');
    }

    if (formData.termYears !== 15 && formData.termYears !== 30) {
      errors.push('Term must be 15 or 30 years');
    }

    if (formData.creditScore < 300 || formData.creditScore > 850) {
      errors.push('Credit score must be between 300 and 850');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate down payment percentage
   */
  calculateDownPaymentPercentage(downPayment: number, homePrice: number): number {
    if (homePrice <= 0) return 0;
    return (downPayment / homePrice) * 100;
  }
}

export const usMortgageFormService = new USMortgageFormService();