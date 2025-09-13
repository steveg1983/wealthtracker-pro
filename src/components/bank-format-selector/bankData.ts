// Local BankFormat interface used for selector only

export interface BankFormat {
  key: string;
  name: string;
  region: string;
  type: 'bank' | 'credit-card' | 'investment' | 'payment';
}

export const REGION_GROUPS = {
  uk: 'United Kingdom',
  us: 'United States',
  eu: 'Europe',
  ca: 'Canada',
  au: 'Australia',
  asia: 'Asia Pacific',
  global: 'Global Services'
} as const;

export const TYPE_GROUPS = {
  bank: 'Banks & Credit Unions',
  'credit-card': 'Credit Cards',
  investment: 'Investment Platforms',
  payment: 'Payment Services'
} as const;

export const BANK_FORMATS: BankFormat[] = [
  // UK Banks
  { key: 'barclays', name: 'Barclays', region: 'UK', type: 'bank' },
  { key: 'hsbc-uk', name: 'HSBC UK', region: 'UK', type: 'bank' },
  { key: 'lloyds', name: 'Lloyds Bank', region: 'UK', type: 'bank' },
  { key: 'natwest', name: 'NatWest', region: 'UK', type: 'bank' },
  { key: 'santander-uk', name: 'Santander UK', region: 'UK', type: 'bank' },
  { key: 'halifax', name: 'Halifax', region: 'UK', type: 'bank' },
  { key: 'nationwide', name: 'Nationwide Building Society', region: 'UK', type: 'bank' },
  { key: 'tesco-bank', name: 'Tesco Bank', region: 'UK', type: 'bank' },
  { key: 'first-direct', name: 'First Direct', region: 'UK', type: 'bank' },
  { key: 'monzo', name: 'Monzo', region: 'UK', type: 'bank' },
  { key: 'starling', name: 'Starling Bank', region: 'UK', type: 'bank' },
  { key: 'revolut', name: 'Revolut', region: 'UK', type: 'bank' },
  
  // UK Credit Cards
  { key: 'amex-uk', name: 'American Express UK', region: 'UK', type: 'credit-card' },
  { key: 'barclaycard', name: 'Barclaycard', region: 'UK', type: 'credit-card' },
  { key: 'capital-one-uk', name: 'Capital One UK', region: 'UK', type: 'credit-card' },
  
  // UK Investment Platforms
  { key: 'hargreaves-lansdown', name: 'Hargreaves Lansdown', region: 'UK', type: 'investment' },
  { key: 'aj-bell', name: 'AJ Bell', region: 'UK', type: 'investment' },
  { key: 'interactive-investor', name: 'Interactive Investor', region: 'UK', type: 'investment' },
  { key: 'freetrade', name: 'Freetrade', region: 'UK', type: 'investment' },
  { key: 'trading212', name: 'Trading 212', region: 'UK', type: 'investment' },
  
  // US Banks
  { key: 'chase', name: 'JPMorgan Chase', region: 'US', type: 'bank' },
  { key: 'bank-of-america', name: 'Bank of America', region: 'US', type: 'bank' },
  { key: 'wells-fargo', name: 'Wells Fargo', region: 'US', type: 'bank' },
  { key: 'citi', name: 'Citibank', region: 'US', type: 'bank' },
  { key: 'us-bank', name: 'U.S. Bank', region: 'US', type: 'bank' },
  { key: 'pnc', name: 'PNC Bank', region: 'US', type: 'bank' },
  { key: 'truist', name: 'Truist', region: 'US', type: 'bank' },
  { key: 'td-bank', name: 'TD Bank', region: 'US', type: 'bank' },
  { key: 'regions', name: 'Regions Bank', region: 'US', type: 'bank' },
  { key: 'fifth-third', name: 'Fifth Third Bank', region: 'US', type: 'bank' },
  
  // US Credit Cards
  { key: 'amex-us', name: 'American Express US', region: 'US', type: 'credit-card' },
  { key: 'discover', name: 'Discover', region: 'US', type: 'credit-card' },
  { key: 'capital-one-us', name: 'Capital One US', region: 'US', type: 'credit-card' },
  
  // US Investment Platforms
  { key: 'fidelity', name: 'Fidelity Investments', region: 'US', type: 'investment' },
  { key: 'schwab', name: 'Charles Schwab', region: 'US', type: 'investment' },
  { key: 'vanguard', name: 'Vanguard', region: 'US', type: 'investment' },
  { key: 'etrade', name: 'E*TRADE', region: 'US', type: 'investment' },
  { key: 'td-ameritrade', name: 'TD Ameritrade', region: 'US', type: 'investment' },
  { key: 'robinhood', name: 'Robinhood', region: 'US', type: 'investment' },
  
  // European Banks
  { key: 'ing', name: 'ING Bank', region: 'EU', type: 'bank' },
  { key: 'deutsche-bank', name: 'Deutsche Bank', region: 'EU', type: 'bank' },
  { key: 'bnp-paribas', name: 'BNP Paribas', region: 'EU', type: 'bank' },
  { key: 'credit-agricole', name: 'Crédit Agricole', region: 'EU', type: 'bank' },
  { key: 'societe-generale', name: 'Société Générale', region: 'EU', type: 'bank' },
  { key: 'unicredit', name: 'UniCredit', region: 'EU', type: 'bank' },
  { key: 'santander-es', name: 'Santander Spain', region: 'EU', type: 'bank' },
  { key: 'bbva', name: 'BBVA', region: 'EU', type: 'bank' },
  { key: 'rabobank', name: 'Rabobank', region: 'EU', type: 'bank' },
  { key: 'abn-amro', name: 'ABN AMRO', region: 'EU', type: 'bank' },
  
  // Canadian Banks
  { key: 'td-canada', name: 'TD Canada Trust', region: 'CA', type: 'bank' },
  { key: 'rbc', name: 'Royal Bank of Canada', region: 'CA', type: 'bank' },
  { key: 'scotiabank', name: 'Scotiabank', region: 'CA', type: 'bank' },
  { key: 'bmo', name: 'Bank of Montreal', region: 'CA', type: 'bank' },
  { key: 'cibc', name: 'CIBC', region: 'CA', type: 'bank' },
  
  // Australian Banks
  { key: 'anz', name: 'ANZ Bank', region: 'AU', type: 'bank' },
  { key: 'cba', name: 'Commonwealth Bank', region: 'AU', type: 'bank' },
  { key: 'westpac', name: 'Westpac', region: 'AU', type: 'bank' },
  { key: 'nab', name: 'National Australia Bank', region: 'AU', type: 'bank' },
  
  // Payment Services
  { key: 'paypal', name: 'PayPal', region: 'Global', type: 'payment' },
  { key: 'stripe', name: 'Stripe', region: 'Global', type: 'payment' },
  { key: 'wise', name: 'Wise (TransferWise)', region: 'Global', type: 'payment' },
  { key: 'remitly', name: 'Remitly', region: 'Global', type: 'payment' }
];
