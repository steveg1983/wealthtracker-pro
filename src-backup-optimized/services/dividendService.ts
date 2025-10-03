/**
 * Dividend Service - Dividend tracking and management
 *
 * Features:
 * - Dividend payment tracking
 * - Yield calculations
 * - Dividend forecasting
 * - Ex-dividend date alerts
 * - Reinvestment calculations
 */

import { lazyLogger } from './serviceFactory';

const logger = lazyLogger.getLogger('DividendService');

export interface DividendPayment {
  id: string;
  stock_symbol: string;
  company_name: string;
  payment_date: string;
  ex_dividend_date: string;
  record_date: string;
  announcement_date: string;
  dividend_amount: number;
  shares_owned: number;
  total_payment: number;
  currency: string;
  dividend_type: 'regular' | 'special' | 'interim' | 'final';
  payment_frequency: 'monthly' | 'quarterly' | 'semi_annually' | 'annually';
  yield_on_cost: number;
  current_yield: number;
  is_qualified: boolean;
  tax_treatment: 'qualified' | 'ordinary' | 'foreign';
}

export interface DividendForecast {
  stock_symbol: string;
  company_name: string;
  estimated_annual_dividend: number;
  next_ex_date?: string;
  next_payment_date?: string;
  next_estimated_amount: number;
  confidence_level: 'high' | 'medium' | 'low';
  growth_rate: number;
  payout_ratio: number;
  dividend_sustainability: 'strong' | 'stable' | 'at_risk' | 'unsustainable';
}

export interface DividendSummary {
  total_annual_income: number;
  monthly_average: number;
  quarterly_breakdown: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
  };
  by_stock: Record<string, {
    annual_amount: number;
    yield_on_cost: number;
    payments_count: number;
  }>;
  by_sector: Record<string, number>;
  growth_year_over_year: number;
  tax_summary: {
    qualified_dividends: number;
    ordinary_dividends: number;
    foreign_dividends: number;
  };
}

export interface DividendReinvestment {
  id: string;
  dividend_payment_id: string;
  stock_symbol: string;
  dividend_amount: number;
  shares_purchased: number;
  price_per_share: number;
  transaction_date: string;
  fees: number;
  fractional_shares: boolean;
}

class DividendService {
  private static instance: DividendService;

  private constructor() {
    logger.info('DividendService initialized');
  }

  public static getInstance(): DividendService {
    if (!DividendService.instance) {
      DividendService.instance = new DividendService();
    }
    return DividendService.instance;
  }

  // Get dividend payments
  public static async getDividendPayments(
    portfolioId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DividendPayment[]> {
    logger.info('Getting dividend payments', { portfolioId, startDate, endDate });

    try {
      // Mock dividend payments data
      const payments: DividendPayment[] = [
        {
          id: 'div-1',
          stock_symbol: 'AAPL',
          company_name: 'Apple Inc.',
          payment_date: '2024-02-15',
          ex_dividend_date: '2024-02-09',
          record_date: '2024-02-12',
          announcement_date: '2024-01-25',
          dividend_amount: 0.24,
          shares_owned: 100,
          total_payment: 24.00,
          currency: 'USD',
          dividend_type: 'regular',
          payment_frequency: 'quarterly',
          yield_on_cost: 0.8,
          current_yield: 0.5,
          is_qualified: true,
          tax_treatment: 'qualified'
        },
        {
          id: 'div-2',
          stock_symbol: 'MSFT',
          company_name: 'Microsoft Corporation',
          payment_date: '2024-03-14',
          ex_dividend_date: '2024-02-21',
          record_date: '2024-02-22',
          announcement_date: '2024-02-15',
          dividend_amount: 0.75,
          shares_owned: 50,
          total_payment: 37.50,
          currency: 'USD',
          dividend_type: 'regular',
          payment_frequency: 'quarterly',
          yield_on_cost: 2.1,
          current_yield: 0.7,
          is_qualified: true,
          tax_treatment: 'qualified'
        },
        {
          id: 'div-3',
          stock_symbol: 'JNJ',
          company_name: 'Johnson & Johnson',
          payment_date: '2024-03-12',
          ex_dividend_date: '2024-02-26',
          record_date: '2024-02-27',
          announcement_date: '2024-02-20',
          dividend_amount: 1.19,
          shares_owned: 25,
          total_payment: 29.75,
          currency: 'USD',
          dividend_type: 'regular',
          payment_frequency: 'quarterly',
          yield_on_cost: 2.8,
          current_yield: 2.9,
          is_qualified: true,
          tax_treatment: 'qualified'
        }
      ];

      return payments;
    } catch (error) {
      logger.error('Error getting dividend payments:', error);
      throw error;
    }
  }

  // Get dividend summary
  public static async getDividendSummary(
    portfolioId: string,
    year?: number
  ): Promise<DividendSummary> {
    logger.info('Getting dividend summary', { portfolioId, year });

    try {
      const currentYear = year || new Date().getFullYear();
      const payments = await this.getDividendPayments(
        portfolioId,
        `${currentYear}-01-01`,
        `${currentYear}-12-31`
      );

      const totalAnnualIncome = payments.reduce((sum, payment) => sum + payment.total_payment, 0);

      // Calculate quarterly breakdown
      const quarterly = payments.reduce((quarters, payment) => {
        const month = new Date(payment.payment_date).getMonth();
        if (month < 3) quarters.q1 += payment.total_payment;
        else if (month < 6) quarters.q2 += payment.total_payment;
        else if (month < 9) quarters.q3 += payment.total_payment;
        else quarters.q4 += payment.total_payment;
        return quarters;
      }, { q1: 0, q2: 0, q3: 0, q4: 0 });

      // Calculate by stock
      const byStock = payments.reduce((stocks, payment) => {
        const symbol = payment.stock_symbol;
        if (!stocks[symbol]) {
          stocks[symbol] = {
            annual_amount: 0,
            yield_on_cost: payment.yield_on_cost,
            payments_count: 0
          };
        }
        stocks[symbol].annual_amount += payment.total_payment;
        stocks[symbol].payments_count += 1;
        return stocks;
      }, {} as Record<string, any>);

      // Mock sector breakdown
      const bySector: Record<string, number> = {
        'Technology': totalAnnualIncome * 0.4,
        'Healthcare': totalAnnualIncome * 0.3,
        'Financial Services': totalAnnualIncome * 0.2,
        'Consumer Goods': totalAnnualIncome * 0.1
      };

      // Calculate tax summary
      const taxSummary = payments.reduce((tax, payment) => {
        if (payment.tax_treatment === 'qualified') {
          tax.qualified_dividends += payment.total_payment;
        } else if (payment.tax_treatment === 'foreign') {
          tax.foreign_dividends += payment.total_payment;
        } else {
          tax.ordinary_dividends += payment.total_payment;
        }
        return tax;
      }, { qualified_dividends: 0, ordinary_dividends: 0, foreign_dividends: 0 });

      const summary: DividendSummary = {
        total_annual_income: totalAnnualIncome,
        monthly_average: totalAnnualIncome / 12,
        quarterly_breakdown: quarterly,
        by_stock: byStock,
        by_sector: bySector,
        growth_year_over_year: 0.08, // 8% growth
        tax_summary: taxSummary
      };

      return summary;
    } catch (error) {
      logger.error('Error getting dividend summary:', error);
      throw error;
    }
  }

  // Get dividend forecasts
  public static async getDividendForecasts(
    portfolioId: string
  ): Promise<DividendForecast[]> {
    logger.info('Getting dividend forecasts', { portfolioId });

    try {
      // Mock dividend forecasts
      const forecasts: DividendForecast[] = [
        {
          stock_symbol: 'AAPL',
          company_name: 'Apple Inc.',
          estimated_annual_dividend: 0.96,
          next_ex_date: '2024-05-10',
          next_payment_date: '2024-05-16',
          next_estimated_amount: 0.24,
          confidence_level: 'high',
          growth_rate: 0.05,
          payout_ratio: 0.15,
          dividend_sustainability: 'strong'
        },
        {
          stock_symbol: 'MSFT',
          company_name: 'Microsoft Corporation',
          estimated_annual_dividend: 3.00,
          next_ex_date: '2024-05-15',
          next_payment_date: '2024-06-13',
          next_estimated_amount: 0.75,
          confidence_level: 'high',
          growth_rate: 0.10,
          payout_ratio: 0.26,
          dividend_sustainability: 'strong'
        },
        {
          stock_symbol: 'JNJ',
          company_name: 'Johnson & Johnson',
          estimated_annual_dividend: 4.76,
          next_ex_date: '2024-05-20',
          next_payment_date: '2024-06-11',
          next_estimated_amount: 1.19,
          confidence_level: 'high',
          growth_rate: 0.03,
          payout_ratio: 0.65,
          dividend_sustainability: 'stable'
        }
      ];

      return forecasts;
    } catch (error) {
      logger.error('Error getting dividend forecasts:', error);
      throw error;
    }
  }

  // Track dividend reinvestment
  public static async recordDividendReinvestment(
    dividendPaymentId: string,
    sharesPerchased: number,
    pricePerShare: number,
    fees: number = 0
  ): Promise<DividendReinvestment> {
    logger.info('Recording dividend reinvestment', {
      dividendPaymentId,
      sharesPerchased,
      pricePerShare
    });

    try {
      // Mock reinvestment record
      const reinvestment: DividendReinvestment = {
        id: `reinvest-${Date.now()}`,
        dividend_payment_id: dividendPaymentId,
        stock_symbol: 'AAPL', // Would be looked up from dividend payment
        dividend_amount: 24.00, // Would be looked up from dividend payment
        shares_purchased: sharesPerchased,
        price_per_share: pricePerShare,
        transaction_date: new Date().toISOString().split('T')[0],
        fees,
        fractional_shares: sharesPerchased % 1 !== 0
      };

      logger.info('Dividend reinvestment recorded', { reinvestmentId: reinvestment.id });
      return reinvestment;
    } catch (error) {
      logger.error('Error recording dividend reinvestment:', error);
      throw error;
    }
  }

  // Get upcoming dividend dates
  public static async getUpcomingDividends(
    portfolioId: string,
    daysAhead: number = 30
  ): Promise<Array<{
    stock_symbol: string;
    company_name: string;
    ex_dividend_date: string;
    payment_date: string;
    estimated_amount: number;
    shares_owned: number;
    estimated_payment: number;
  }>> {
    logger.info('Getting upcoming dividends', { portfolioId, daysAhead });

    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysAhead);

      // Mock upcoming dividends
      const upcomingDividends = [
        {
          stock_symbol: 'AAPL',
          company_name: 'Apple Inc.',
          ex_dividend_date: '2024-05-10',
          payment_date: '2024-05-16',
          estimated_amount: 0.24,
          shares_owned: 100,
          estimated_payment: 24.00
        },
        {
          stock_symbol: 'MSFT',
          company_name: 'Microsoft Corporation',
          ex_dividend_date: '2024-05-15',
          payment_date: '2024-06-13',
          estimated_amount: 0.75,
          shares_owned: 50,
          estimated_payment: 37.50
        }
      ];

      return upcomingDividends;
    } catch (error) {
      logger.error('Error getting upcoming dividends:', error);
      throw error;
    }
  }

  // Calculate dividend yield
  public static async calculateYieldMetrics(
    stockSymbol: string,
    purchasePrice: number,
    currentPrice: number,
    annualDividend: number
  ): Promise<{
    yield_on_cost: number;
    current_yield: number;
    dividend_growth_rate: number;
    years_to_double: number;
  }> {
    logger.info('Calculating yield metrics', {
      stockSymbol,
      purchasePrice,
      currentPrice,
      annualDividend
    });

    try {
      const yieldOnCost = annualDividend / purchasePrice;
      const currentYield = annualDividend / currentPrice;

      // Mock dividend growth rate (would be calculated from historical data)
      const dividendGrowthRate = 0.07; // 7% annual growth

      // Calculate years to double dividend (Rule of 72)
      const yearsToDouble = dividendGrowthRate > 0 ? 72 / (dividendGrowthRate * 100) : Infinity;

      const metrics = {
        yield_on_cost: yieldOnCost,
        current_yield: currentYield,
        dividend_growth_rate: dividendGrowthRate,
        years_to_double: yearsToDouble
      };

      logger.debug('Yield metrics calculated', metrics);
      return metrics;
    } catch (error) {
      logger.error('Error calculating yield metrics:', error);
      throw error;
    }
  }

  // Get dividend calendar
  public static async getDividendCalendar(
    portfolioId: string,
    month: number,
    year: number
  ): Promise<Array<{
    date: string;
    events: Array<{
      type: 'ex_dividend' | 'payment' | 'announcement';
      stock_symbol: string;
      company_name: string;
      amount?: number;
      description: string;
    }>;
  }>> {
    logger.info('Getting dividend calendar', { portfolioId, month, year });

    try {
      // Mock calendar data
      const calendar = [
        {
          date: `${year}-${month.toString().padStart(2, '0')}-10`,
          events: [
            {
              type: 'ex_dividend' as const,
              stock_symbol: 'AAPL',
              company_name: 'Apple Inc.',
              amount: 0.24,
              description: 'Ex-dividend date'
            }
          ]
        },
        {
          date: `${year}-${month.toString().padStart(2, '0')}-15`,
          events: [
            {
              type: 'ex_dividend' as const,
              stock_symbol: 'MSFT',
              company_name: 'Microsoft Corporation',
              amount: 0.75,
              description: 'Ex-dividend date'
            }
          ]
        },
        {
          date: `${year}-${month.toString().padStart(2, '0')}-16`,
          events: [
            {
              type: 'payment' as const,
              stock_symbol: 'AAPL',
              company_name: 'Apple Inc.',
              amount: 0.24,
              description: 'Dividend payment'
            }
          ]
        }
      ];

      return calendar;
    } catch (error) {
      logger.error('Error getting dividend calendar:', error);
      throw error;
    }
  }
}

export const dividendService = new DividendService();
export default DividendService;