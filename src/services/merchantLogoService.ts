interface MerchantLogo {
  name: string;
  logo: string; // URL or emoji
  color: string;
  keywords: string[];
}

// UK-focused merchant database with logos/emojis and brand colors
const merchantDatabase: MerchantLogo[] = [
  // Supermarkets
  { name: 'Tesco', logo: '🛒', color: '#005EB8', keywords: ['tesco', 'tesco express', 'tesco metro', 'tesco extra'] },
  { name: 'Sainsbury\'s', logo: '🛒', color: '#FF7200', keywords: ['sainsbury', 'sainsburys', 'sainsbury\'s'] },
  { name: 'ASDA', logo: '🛒', color: '#7DC242', keywords: ['asda'] },
  { name: 'Morrisons', logo: '🛒', color: '#FFD700', keywords: ['morrison', 'morrisons'] },
  { name: 'Waitrose', logo: '🛒', color: '#81B93F', keywords: ['waitrose'] },
  { name: 'Aldi', logo: '🛒', color: '#00559F', keywords: ['aldi'] },
  { name: 'Lidl', logo: '🛒', color: '#0050AA', keywords: ['lidl'] },
  { name: 'Co-op', logo: '🛒', color: '#00B1E7', keywords: ['co-op', 'coop', 'cooperative'] },
  { name: 'M&S', logo: '🛒', color: '#000000', keywords: ['m&s', 'marks spencer', 'marks and spencer', 'marks & spencer'] },
  
  // Transport
  { name: 'TfL', logo: '🚇', color: '#DC241F', keywords: ['tfl', 'transport for london', 'london underground', 'oyster'] },
  { name: 'National Rail', logo: '🚂', color: '#C00000', keywords: ['national rail', 'trainline', 'rail', 'railway'] },
  { name: 'Uber', logo: '🚗', color: '#000000', keywords: ['uber'] },
  { name: 'Addison Lee', logo: '🚕', color: '#E30613', keywords: ['addison lee'] },
  { name: 'British Airways', logo: '✈️', color: '#2E5C99', keywords: ['british airways', 'ba.com'] },
  { name: 'EasyJet', logo: '✈️', color: '#FF6600', keywords: ['easyjet'] },
  { name: 'Ryanair', logo: '✈️', color: '#073590', keywords: ['ryanair'] },
  
  // Fuel
  { name: 'Shell', logo: '⛽', color: '#DD1D21', keywords: ['shell'] },
  { name: 'BP', logo: '⛽', color: '#006F51', keywords: ['bp', 'british petroleum'] },
  { name: 'Esso', logo: '⛽', color: '#CE1126', keywords: ['esso'] },
  { name: 'Texaco', logo: '⛽', color: '#FF0000', keywords: ['texaco'] },
  
  // Restaurants & Fast Food
  { name: 'McDonald\'s', logo: '🍔', color: '#FFC72C', keywords: ['mcdonald', 'mcdonalds', 'mcd'] },
  { name: 'KFC', logo: '🍗', color: '#F40027', keywords: ['kfc', 'kentucky fried chicken'] },
  { name: 'Burger King', logo: '🍔', color: '#D62300', keywords: ['burger king'] },
  { name: 'Subway', logo: '🥪', color: '#008C15', keywords: ['subway'] },
  { name: 'Greggs', logo: '🥐', color: '#00539F', keywords: ['greggs'] },
  { name: 'Pret', logo: '☕', color: '#862633', keywords: ['pret', 'pret a manger'] },
  { name: 'Costa', logo: '☕', color: '#6C1F45', keywords: ['costa', 'costa coffee'] },
  { name: 'Starbucks', logo: '☕', color: '#00704A', keywords: ['starbucks'] },
  { name: 'Nando\'s', logo: '🍗', color: '#DC241F', keywords: ['nando', 'nandos'] },
  { name: 'Pizza Hut', logo: '🍕', color: '#ED1C24', keywords: ['pizza hut'] },
  { name: 'Domino\'s', logo: '🍕', color: '#006491', keywords: ['domino', 'dominos'] },
  { name: 'Wagamama', logo: '🍜', color: '#ED1C24', keywords: ['wagamama'] },
  
  // Retail
  { name: 'Amazon', logo: '📦', color: '#FF9900', keywords: ['amazon', 'amzn'] },
  { name: 'Argos', logo: '🛍️', color: '#ED1B24', keywords: ['argos'] },
  { name: 'John Lewis', logo: '🏬', color: '#000000', keywords: ['john lewis', 'johnlewis'] },
  { name: 'Next', logo: '👕', color: '#000000', keywords: ['next', 'next retail'] },
  { name: 'Primark', logo: '👗', color: '#0066B3', keywords: ['primark'] },
  { name: 'H&M', logo: '👔', color: '#E50010', keywords: ['h&m', 'h & m', 'hennes'] },
  { name: 'Zara', logo: '👗', color: '#000000', keywords: ['zara'] },
  { name: 'Boots', logo: '💊', color: '#005EB8', keywords: ['boots'] },
  { name: 'Superdrug', logo: '💄', color: '#E6007E', keywords: ['superdrug'] },
  
  // Entertainment & Subscriptions
  { name: 'Netflix', logo: '📺', color: '#E50914', keywords: ['netflix'] },
  { name: 'Spotify', logo: '🎵', color: '#1DB954', keywords: ['spotify'] },
  { name: 'Disney+', logo: '🎬', color: '#113CCF', keywords: ['disney', 'disney+', 'disney plus'] },
  { name: 'Amazon Prime', logo: '📺', color: '#00A8E1', keywords: ['amazon prime', 'prime video'] },
  { name: 'Sky', logo: '📡', color: '#0072C9', keywords: ['sky'] },
  { name: 'BT', logo: '📞', color: '#5514B4', keywords: ['bt', 'british telecom'] },
  { name: 'Virgin Media', logo: '📶', color: '#ED1A3B', keywords: ['virgin media', 'virgin'] },
  { name: 'EE', logo: '📱', color: '#00B5B0', keywords: ['ee', 'everything everywhere'] },
  { name: 'O2', logo: '📱', color: '#0019A5', keywords: ['o2'] },
  { name: 'Three', logo: '📱', color: '#EE2E7B', keywords: ['three', '3 mobile'] },
  { name: 'Vodafone', logo: '📱', color: '#E60000', keywords: ['vodafone'] },
  
  // Utilities
  { name: 'British Gas', logo: '🔥', color: '#0396D6', keywords: ['british gas'] },
  { name: 'E.ON', logo: '⚡', color: '#E2001A', keywords: ['eon', 'e.on'] },
  { name: 'EDF', logo: '⚡', color: '#0066CC', keywords: ['edf', 'edf energy'] },
  { name: 'Thames Water', logo: '💧', color: '#0082CA', keywords: ['thames water'] },
  { name: 'Council Tax', logo: '🏛️', color: '#2B3E50', keywords: ['council tax', 'council'] },
  
  // Banks & Financial
  { name: 'Barclays', logo: '🏦', color: '#00AEEF', keywords: ['barclays'] },
  { name: 'HSBC', logo: '🏦', color: '#DB0011', keywords: ['hsbc'] },
  { name: 'Lloyds', logo: '🏦', color: '#024731', keywords: ['lloyds'] },
  { name: 'NatWest', logo: '🏦', color: '#5A287F', keywords: ['natwest'] },
  { name: 'Santander', logo: '🏦', color: '#EC0000', keywords: ['santander'] },
  { name: 'Halifax', logo: '🏦', color: '#005EB8', keywords: ['halifax'] },
  { name: 'Nationwide', logo: '🏦', color: '#1B3A6B', keywords: ['nationwide'] },
  { name: 'PayPal', logo: '💳', color: '#003087', keywords: ['paypal'] },
  { name: 'ATM', logo: '🏧', color: '#4A90E2', keywords: ['atm', 'cash machine', 'cashpoint'] },
  
  // Fitness & Health
  { name: 'PureGym', logo: '💪', color: '#E4002B', keywords: ['puregym', 'pure gym'] },
  { name: 'David Lloyd', logo: '🏃', color: '#003DA5', keywords: ['david lloyd'] },
  { name: 'Virgin Active', logo: '🏋️', color: '#ED1A3B', keywords: ['virgin active'] },
  
  // Online Services
  { name: 'Google', logo: '🔍', color: '#4285F4', keywords: ['google'] },
  { name: 'Apple', logo: '🍎', color: '#000000', keywords: ['apple', 'app store', 'itunes'] },
  { name: 'Microsoft', logo: '💻', color: '#0078D4', keywords: ['microsoft'] },
  
  // Default categories
  { name: 'Restaurant', logo: '🍽️', color: '#FF6B6B', keywords: ['restaurant', 'dining', 'food'] },
  { name: 'Groceries', logo: '🛒', color: '#4ECDC4', keywords: ['grocery', 'supermarket'] },
  { name: 'Transport', logo: '🚌', color: '#45B7D1', keywords: ['transport', 'travel', 'bus', 'train'] },
  { name: 'Shopping', logo: '🛍️', color: '#96CEB4', keywords: ['shop', 'retail', 'store'] },
  { name: 'Bills', logo: '📋', color: '#DDA0DD', keywords: ['bill', 'utility', 'payment'] },
  { name: 'Entertainment', logo: '🎭', color: '#FF6B9D', keywords: ['cinema', 'theatre', 'entertainment'] },
  { name: 'Health', logo: '🏥', color: '#66D9EF', keywords: ['pharmacy', 'doctor', 'health', 'medical'] },
];

export class MerchantLogoService {
  private merchantMap: Map<string, MerchantLogo> = new Map();

  constructor() {
    // Build a map for faster lookups
    merchantDatabase.forEach(merchant => {
      merchant.keywords.forEach(keyword => {
        this.merchantMap.set(keyword.toLowerCase(), merchant);
      });
    });
  }

  /**
   * Get merchant info including logo and color from transaction description
   */
  getMerchantInfo(description: string): MerchantLogo | null {
    const cleanDescription = description.toLowerCase()
      .replace(/^(card purchase|direct debit|standing order|bank transfer|pos|contactless|online)[\s-]*/i, '')
      .replace(/[*#\d]/g, '') // Remove numbers and special chars
      .trim();

    // First, try exact matches
    for (const [keyword, merchant] of this.merchantMap.entries()) {
      if (cleanDescription.includes(keyword)) {
        return merchant;
      }
    }

    // Then try partial matches for common patterns
    const words = cleanDescription.split(/[\s-,]/);
    for (const word of words) {
      if (word.length > 2) {
        const merchant = this.merchantMap.get(word);
        if (merchant) {
          return merchant;
        }
      }
    }

    // Try to guess based on common patterns
    if (cleanDescription.includes('fuel') || cleanDescription.includes('petrol')) {
      return { name: 'Fuel', logo: '⛽', color: '#FF6347', keywords: [] };
    }
    if (cleanDescription.includes('taxi') || cleanDescription.includes('cab')) {
      return { name: 'Taxi', logo: '🚕', color: '#FFD700', keywords: [] };
    }
    if (cleanDescription.includes('parking')) {
      return { name: 'Parking', logo: '🅿️', color: '#4169E1', keywords: [] };
    }
    if (cleanDescription.includes('coffee')) {
      return { name: 'Coffee', logo: '☕', color: '#6F4E37', keywords: [] };
    }
    if (cleanDescription.includes('pub') || cleanDescription.includes('bar')) {
      return { name: 'Pub', logo: '🍺', color: '#8B4513', keywords: [] };
    }

    return null;
  }

  /**
   * Get all available merchant logos for display
   */
  getAllMerchants(): MerchantLogo[] {
    // Return unique merchants (deduplicated)
    const uniqueMerchants = new Map<string, MerchantLogo>();
    merchantDatabase.forEach(merchant => {
      if (!uniqueMerchants.has(merchant.name)) {
        uniqueMerchants.set(merchant.name, merchant);
      }
    });
    return Array.from(uniqueMerchants.values());
  }
}

export const merchantLogoService = new MerchantLogoService();