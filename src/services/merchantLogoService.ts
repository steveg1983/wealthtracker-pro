import { logger } from './loggingService';
interface MerchantLogo {
  name: string;
  logo: string; // URL or emoji
  color: string;
  keywords: string[];
  domain?: string; // Domain for fetching actual logo
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
  { name: 'British Gas', logo: '🔥', color: '#0396D6', keywords: ['british gas'], domain: 'britishgas.co.uk' },
  { name: 'E.ON', logo: '⚡', color: '#E2001A', keywords: ['eon', 'e.on'], domain: 'eonenergy.com' },
  { name: 'EDF', logo: '⚡', color: '#0066CC', keywords: ['edf', 'edf energy'], domain: 'edfenergy.com' },
  { name: 'Thames Water', logo: '💧', color: '#0082CA', keywords: ['thames water'], domain: 'thameswater.co.uk' },
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
  { name: 'PureGym', logo: '💪', color: '#E4002B', keywords: ['puregym', 'pure gym'], domain: 'puregym.com' },
  { name: 'David Lloyd', logo: '🏃', color: '#003DA5', keywords: ['david lloyd'], domain: 'davidlloyd.co.uk' },
  { name: 'Virgin Active', logo: '🏋️', color: '#ED1A3B', keywords: ['virgin active'], domain: 'virginactive.co.uk' },
  
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

// Embedded SVG logos for top merchants (always work, no external requests)
const embeddedLogos: Record<string, string> = {
  // International brands
  'amazon.com': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iI0ZGOTgwMCIgZD0iTTM3LDM1LjVjLTYuNiw0LjItMTUuNCw2LjUtMjMuNCw2LjVDOC40LDQyLDMuOSw0MC4xLDAuOSwzNy4yYy0wLjItMC4yLDAtMC40LDAuMi0wLjNDNC4yLDM5LDguOCw0MCwxMy41LDQwYzMuMSwwLDYuNi0wLjUsOS45LTEuNkMzMS4yLDM1LjksMzcuNywzNC40LDM3LDM1LjV6IE00MS4zLDMxLjNjLTAuMy0wLjQtMi4xLTAuMi0yLjksMC4xYy0wLjIsMC4xLTAuMywwLjQtMC4xLDAuNWMwLjksMi43LDIuOCwyLDMuNCwxLjVDNDIuMywzMyw0Mi4yLDMxLjcsNDEuMywzMS4zeiBNMjAuNywxNy45YzAsMi41LDAsNC43LTEuMiw2LjljLTAuOCwxLjUtMi4xLDIuNC0zLjUsMi40Yy0xLjksMC0zLjEtMS41LTMuMS0zLjZjMC0xNi43LDguMy0xOS43LDguMy0xOS43VjE3Ljl6IE0yNy40LDMxLjNjLTAuNC0wLjQtMS0wLjQtMS41LTAuMWMtMi4xLDEuNy0yLjUsMi42LTMuNiwzLjNjLTEuNCwxLjQtMywxLjgtNC42LDEuOGMtMi4zLDAtNC4xLTEuNS00LjEtNC40YzAtMy43LDIuMy01LjIsNi00LjJ2LTFjMC0xLjUtMC4xLTMuMi0xLTQuNGMtMC42LTAuOS0xLjktMS40LTMuMS0xLjRjLTIuMSwwLTQsMS4xLTQuNCwzLjNjLTAuMSwwLjUtMC40LDEtMC45LDFsLTUuMS0wLjZDNS4xLDIwLjIsNS42LDE5LjksNiwxOS41YzEuOC0zLjMsNS00LjMsOC42LTQuM2MxLjksMCw0LjMsMC41LDUuOCwyYzEuOCwxLjgsMS42LDQuMiwxLjYsNi44djYuMmMwLDEuOSwwLjgsMi43LDEuNSwzLjdjMC4zLDAuMywwLjMsMC44LDAsMUMyMy4xLDI4LjMsMjQuNCwyOS45LDI3LjQsMzEuM3oiLz48L3N2Zz4=',
  'netflix.com': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iI0I3MUMxQyIgZD0iTTEzIDloOHYzMGgtOHoiLz48cGF0aCBmaWxsPSIjRTUzOTM1IiBkPSJNMjcgOWg4djMwaC04eiIvPjxwYXRoIGZpbGw9IiNGRjU3MjIiIGQ9Ik0xMyA5bDE0IDE0VjloLTd6Ii8+PHBhdGggZmlsbD0iI0U1MzkzNSIgZD0iTTI3IDM5TDEzIDI1djE0aDd6Ii8+PC9zdmc+',
  'spotify.com': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjAiIGZpbGw9IiMxREI5NTQiLz48cGF0aCBmaWxsPSIjMTkxNDE0IiBkPSJNMzAuOCAxOS45Yy00LjUtMS45LTkuNS0yLTE0LjItMC41Yy0wLjYgMC4yLTEuMi0wLjEtMS40LTAuN2MtMC4yLTAuNiAwLjEtMS4yIDAuNy0xLjRjNS4zLTEuNiAxMC44LTEuNCAxNS44IDAuNmMwLjYgMC4yIDAuOSAwLjggMC43IDEuNEMzMiAxOS42IDMxLjQgMjAuMSAzMC44IDE5Ljl6TTI5LjIgMjUuNWMtMC41IDAuMy0xLjEgMC4xLTEuNC0wLjRjLTEuNi0yLjItNC4yLTMuMy02LjktMy40Yy0yLTAuMS0zLjkgMC4zLTUuNyAxLjFjLTAuNSAwLjItMS4xLTAuMS0xLjMtMC42Yy0wLjItMC41IDAuMS0xLjEgMC42LTEuM2MyLjEtMC45IDQuMy0xLjQgNi42LTEuMmMzLjIgMC4xIDYuMSAxLjMgOCwzLjlDMjkuNCAyNC40IDI5LjUgMjUuMSAyOS4yIDI1LjV6IE0yOCAzMC4zYy0wLjQgMC4yLTAuOSAwLjEtMS4xLTAuM2MtMS4yLTEuNy0zLjItMi42LTUuMi0yLjdjLTEuNS0wLjEtMi45IDAuMi00LjMgMC44Yy0wLjQgMC4yLTAuOSAwLTEtMC40Yy0wLjItMC40IDAtMC45IDAuNC0xYzEuNi0wLjcgMy4zLTEuMSA1LjEtMC45YzIuNCAwLjEgNC42IDEuMiA2LjEgMy4yQzI4LjIgMjkuNSAyOC4yIDMwLjEgMjggMzAuM3oiLz48L3N2Zz4=',
  'apple.com': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iIzQyQTVGNSIgZD0iTTM1LjMgMTAuN2MtMS44IDIuMy00LjcgMy42LTcuNSAzLjVjLTAuNC0yLjkgMS03LjYgMi44LTkuOWMxLjgtMi4zIDQuOS0zLjkgNy40LTRDMzguMSAzLjIgMzcuMSA4LjQgMzUuMyAxMC43eiIvPjxwYXRoIGZpbGw9IiM0MjQyNDIiIGQ9Ik0zOC4yIDE2LjRjLTEuNi0wLjktMy40LTEuNC01LjMtMS40Yy0yLjYgMC00LjUgMC45LTUuOCAxLjdjLTAuNyAwLjQtMS4zIDAuOC0xLjcgMC45Yy0wLjQtMC4yLTAuOS0wLjUtMS42LTAuOWMtMS41LTAuOS0zLjUtMS44LTYuNC0xLjhjLTMuNiAwLTYuNyAyLjItOC41IDUuN2MtMi41IDQuOS0yLjEgMTEuNCAxLjkgMTguMWMxLjkgMy4yIDQuNSA3LjEgNy45IDcuMmMwIDAsMCAwIDAuMSAwYzEuNSAwIDIuNS0wLjUgMy40LTAuOWMxLTAuNSAxLjktMC45IDMuNC0wLjljMS41IDAgMi40IDAuNCAzLjQgMC45YzAuOSAwLjQgMS45IDAuOSAzLjQgMC45YzAuMSAwIDAuMSAwIDAuMiAwYzMuNC0wLjEgNi00LjEgNy45LTcuM2MxLjItMiAyLTMuOCAyLjUtNS4xYyAyLjMtMiA0LjUtMi43IDUuMy0yLjd6Ii8+PC9zdmc+',
  // UK supermarkets
  'tesco.com': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iIzAwNUVCOCIvPjx0ZXh0IHg9IjI0IiB5PSIzMiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE4IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlRFU0NPPC90ZXh0Pjwvc3ZnPg==',
  'sainsburys.co.uk': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iI0ZGNzIwMCIvPjx0ZXh0IHg9IjI0IiB5PSIzMiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlM8L3RleHQ+PC9zdmc+',
  // Fast food
  'mcdonalds.com': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iI0ZGQzEwNyIgZD0iTTEyIDEwYzAtMi4yIDEuOC00IDQtNHM0IDEuOCA0IDR2MjhoLTh6bTE2IDBjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNHYyOGgtOHoiLz48L3N2Zz4=',
  'starbucks.com': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjAiIGZpbGw9IiMwMDcwNEEiLz48Y2lyY2xlIGN4PSIyNCIgY3k9IjI0IiByPSIxNiIgZmlsbD0id2hpdGUiLz48Y2lyY2xlIGN4PSIyNCIgY3k9IjI0IiByPSIxMiIgZmlsbD0iIzAwNzA0QSIvPjwvc3ZnPg==',
  // Transportation
  'uber.com': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iIzAwMDAwMCIvPjx0ZXh0IHg9IjI0IiB5PSIzMiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE4IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlViZXI8L3RleHQ+PC9zdmc+'
};

export class MerchantLogoService {
  private merchantMap: Map<string, MerchantLogo> = new Map();
  private logoCache: Map<string, string> = new Map();
  private logoFetchPromises: Map<string, Promise<string | null>> = new Map();

  constructor() {
    // Build a map for faster lookups
    merchantDatabase.forEach(merchant => {
      merchant.keywords.forEach(keyword => {
        this.merchantMap.set(keyword.toLowerCase(), merchant);
      });
    });
    
    // Load cached logos from localStorage
    this.loadCachedLogos();
  }
  
  /**
   * Load cached logos from localStorage
   */
  private loadCachedLogos() {
    try {
      const cachedLogos = localStorage.getItem('merchantLogos');
      if (cachedLogos) {
        const parsed = JSON.parse(cachedLogos);
        Object.entries(parsed).forEach(([domain, logoUrl]) => {
          this.logoCache.set(domain, logoUrl as string);
        });
      }
    } catch (error) {
      logger.error('Error loading cached logos:', error);
    }
  }
  
  /**
   * Save logos to localStorage cache
   */
  private saveCachedLogos() {
    try {
      const cacheObj = Object.fromEntries(this.logoCache);
      localStorage.setItem('merchantLogos', JSON.stringify(cacheObj));
    } catch (error) {
      logger.error('Error saving cached logos:', error);
    }
  }
  
  /**
   * Fetch actual logo from Clearbit API
   */
  async fetchLogoUrl(domain: string): Promise<string | null> {
    // Check embedded logos first (always work, no external requests)
    if (embeddedLogos[domain]) {
      return embeddedLogos[domain];
    }
    
    // Check cache
    if (this.logoCache.has(domain)) {
      const cached = this.logoCache.get(domain)!;
      // Empty string means we tried and failed before
      return cached === '' ? null : cached;
    }
    
    // Check if already fetching
    if (this.logoFetchPromises.has(domain)) {
      return this.logoFetchPromises.get(domain)!;
    }
    
    // Create fetch promise
    const fetchPromise = (async (): Promise<string | null> => {
      try {
        // Try multiple logo sources for better reliability
        // Clearbit Logo API - free, no API key required
        const logoUrl = `https://logo.clearbit.com/${domain}`;
        
        // Alternative: Use multiple favicon services as fallback
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        const duckDuckGoFavicon = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
        
        // Test if the logo exists by trying to fetch it
        // Using Image object to test if logo loads
        return new Promise<string | null>((resolve) => {
          let attemptCount = 0;
          const sources = [logoUrl, faviconUrl, duckDuckGoFavicon];
          
          const tryNextSource = (): void => {
            if (attemptCount >= sources.length) {
              // All sources failed
              this.logoCache.set(domain, '');
              this.saveCachedLogos();
              resolve(null);
              return;
            }
            
            const currentUrl = sources[attemptCount];
            const img = new Image();
            
            // Don't use crossOrigin for Google favicons as it may cause issues
            if (attemptCount === 0) {
              img.crossOrigin = 'anonymous';
            }
            
            const timeout = setTimeout(() => {
              img.src = ''; // Cancel the request
              attemptCount++;
              tryNextSource();
            }, 3000);
            
            img.onload = () => {
              clearTimeout(timeout);
              // Logo loaded successfully
              logger.info('Loaded merchant branding', { type: attemptCount === 0 ? 'logo' : 'favicon', domain });
              this.logoCache.set(domain, currentUrl);
              this.saveCachedLogos();
              resolve(currentUrl);
            };
            
            img.onerror = () => {
              clearTimeout(timeout);
              const sourceNames = ['Clearbit logo', 'Google favicon', 'DuckDuckGo favicon'];
              logger.warn(`${sourceNames[attemptCount]} failed for ${domain}${attemptCount < sources.length - 1 ? ', trying next...' : ', will use emoji'}`);
              attemptCount++;
              tryNextSource();
            };
            
            img.src = currentUrl;
          };
          
          tryNextSource();
        });
      } catch (error) {
        logger.error(`Error fetching logo for ${domain}:`, error);
      }
      
      return null;
    })();
    
    // Store promise to prevent duplicate requests
    this.logoFetchPromises.set(domain, fetchPromise);
    
    // Clean up promise after completion
    fetchPromise.finally(() => {
      this.logoFetchPromises.delete(domain);
    });
    
    return fetchPromise;
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
    for (const [keyword, merchant] of Array.from(this.merchantMap.entries())) {
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
  
  /**
   * Preload logos for common merchants
   */
  async preloadCommonLogos() {
    const commonMerchants = [
      'amazon.com', 'netflix.com', 'spotify.com', 'apple.com',
      'tesco.com', 'sainsburys.co.uk', 'asda.com',
      'mcdonalds.com', 'starbucks.com', 'uber.com'
    ];
    
    // Preload in background
    commonMerchants.forEach(domain => {
      this.fetchLogoUrl(domain).catch(() => {});
    });
  }
}

export const merchantLogoService = new MerchantLogoService();
