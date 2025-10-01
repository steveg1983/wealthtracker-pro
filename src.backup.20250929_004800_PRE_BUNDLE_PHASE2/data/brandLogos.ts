// Brand logo database with base64 encoded images or icon references
// This provides a reliable, ad-blocker-proof solution for merchant logos

export interface BrandLogo {
  name: string;
  domain: string;
  icon: string; // Can be: base64 data URI, SVG string, or icon class
  color: string;
  category: 'retail' | 'food' | 'transport' | 'entertainment' | 'finance' | 'utilities' | 'tech' | 'other';
}

// Popular brand logos database
export const brandLogos: BrandLogo[] = [
  // Retail - International
  { 
    name: 'Amazon',
    domain: 'amazon.com',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iI0ZGOTgwMCIgZD0iTTM3LDM1LjVjLTYuNiw0LjItMTUuNCw2LjUtMjMuNCw2LjVDOC40LDQyLDMuOSw0MC4xLDAuOSwzNy4yYy0wLjItMC4yLDAtMC40LDAuMi0wLjNDNC4yLDM5LDguOCw0MCwxMy41LDQwYzMuMSwwLDYuNi0wLjUsOS45LTEuNkMzMS4yLDM1LjksMzcuNywzNC40LDM3LDM1LjV6IE00MS4zLDMxLjNjLTAuMy0wLjQtMi4xLTAuMi0yLjksMC4xYy0wLjIsMC4xLTAuMywwLjQtMC4xLDAuNWMwLjksMi43LDIuOCwyLDMuNCwxLjVDNDIuMywzMyw0Mi4yLDMxLjcsNDEuMywzMS4zeiBNMjAuNywxNy45YzAsMi41LDAsNC43LTEuMiw2LjljLTAuOCwxLjUtMi4xLDIuNC0zLjUsMi40Yy0xLjksMC0zLjEtMS41LTMuMS0zLjZjMC0xNi43LDguMy0xOS43LDguMy0xOS43VjE3Ljl6IE0yNy40LDMxLjNjLTAuNC0wLjQtMS0wLjQtMS41LTAuMWMtMi4xLDEuNy0yLjUsMi42LTMuNiwzLjNjLTEuNCwxLjQtMywxLjgtNC42LDEuOGMtMi4zLDAtNC4xLTEuNS00LjEtNC40YzAtMy43LDIuMy01LjIsNi00LjJ2LTFjMC0xLjUtMC4xLTMuMi0xLTQuNGMtMC42LTAuOS0xLjktMS40LTMuMS0xLjRjLTIuMSwwLTQsMS4xLTQuNCwzLjNjLTAuMSwwLjUtMC40LDEtMC45LDFsLTUuMS0wLjZDNS4xLDIwLjIsNS42LDE5LjksNiwxOS41YzEuOC0zLjMsNS00LjMsOC42LTQuM2MxLjksMCw0LjMsMC41LDUuOCwyYzEuOCwxLjgsMS42LDQuMiwxLjYsNi44djYuMmMwLDEuOSwwLjgsMi43LDEuNSwzLjdjMC4zLDAuMywwLjMsMC44LDAsMUMyMy4xLDI4LjMsMjQuNCwyOS45LDI3LjQsMzEuM3oiLz48L3N2Zz4=',
    color: '#FF9800',
    category: 'retail'
  },
  {
    name: 'eBay',
    domain: 'ebay.com',
    icon: 'simple-icons:ebay', // Using icon library reference
    color: '#E53238',
    category: 'retail'
  },
  
  // UK Retail
  {
    name: 'Tesco',
    domain: 'tesco.com',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iIzAwNUVCOCIvPjx0ZXh0IHg9IjI0IiB5PSIzMiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlRFU0NPPC90ZXh0Pjwvc3ZnPg==',
    color: '#005EB8',
    category: 'retail'
  },
  {
    name: "Sainsbury's",
    domain: 'sainsburys.co.uk',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iI0ZGNzIwMCIvPjx0ZXh0IHg9IjI0IiB5PSIzMiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlM8L3RleHQ+PC9zdmc+',
    color: '#FF7200',
    category: 'retail'
  },
  {
    name: 'ASDA',
    domain: 'asda.com',
    icon: 'custom:asda', // Custom icon reference
    color: '#7DC242',
    category: 'retail'
  },
  {
    name: 'Argos',
    domain: 'argos.co.uk',
    icon: 'custom:argos',
    color: '#ED1B24',
    category: 'retail'
  },
  {
    name: 'John Lewis',
    domain: 'johnlewis.com',
    icon: 'custom:johnlewis',
    color: '#000000',
    category: 'retail'
  },
  
  // Entertainment
  {
    name: 'Netflix',
    domain: 'netflix.com',
    icon: 'simple-icons:netflix',
    color: '#E50914',
    category: 'entertainment'
  },
  {
    name: 'Spotify',
    domain: 'spotify.com',
    icon: 'simple-icons:spotify',
    color: '#1DB954',
    category: 'entertainment'
  },
  {
    name: 'Disney+',
    domain: 'disneyplus.com',
    icon: 'simple-icons:disney',
    color: '#113CCF',
    category: 'entertainment'
  },
  {
    name: 'YouTube',
    domain: 'youtube.com',
    icon: 'simple-icons:youtube',
    color: '#FF0000',
    category: 'entertainment'
  },
  
  // Food & Restaurants
  {
    name: "McDonald's",
    domain: 'mcdonalds.com',
    icon: 'simple-icons:mcdonalds',
    color: '#FFC72C',
    category: 'food'
  },
  {
    name: 'Starbucks',
    domain: 'starbucks.com',
    icon: 'simple-icons:starbucks',
    color: '#00704A',
    category: 'food'
  },
  {
    name: 'Subway',
    domain: 'subway.com',
    icon: 'simple-icons:subway',
    color: '#008C15',
    category: 'food'
  },
  {
    name: 'KFC',
    domain: 'kfc.com',
    icon: 'custom:kfc',
    color: '#F40027',
    category: 'food'
  },
  
  // Transport
  {
    name: 'Uber',
    domain: 'uber.com',
    icon: 'simple-icons:uber',
    color: '#000000',
    category: 'transport'
  },
  {
    name: 'Lyft',
    domain: 'lyft.com',
    icon: 'simple-icons:lyft',
    color: '#FF00BF',
    category: 'transport'
  },
  
  // Finance
  {
    name: 'PayPal',
    domain: 'paypal.com',
    icon: 'simple-icons:paypal',
    color: '#003087',
    category: 'finance'
  },
  {
    name: 'Visa',
    domain: 'visa.com',
    icon: 'simple-icons:visa',
    color: '#1A1F71',
    category: 'finance'
  },
  {
    name: 'Mastercard',
    domain: 'mastercard.com',
    icon: 'simple-icons:mastercard',
    color: '#EB001B',
    category: 'finance'
  },
  
  // Tech
  {
    name: 'Apple',
    domain: 'apple.com',
    icon: 'simple-icons:apple',
    color: '#000000',
    category: 'tech'
  },
  {
    name: 'Google',
    domain: 'google.com',
    icon: 'simple-icons:google',
    color: '#4285F4',
    category: 'tech'
  },
  {
    name: 'Microsoft',
    domain: 'microsoft.com',
    icon: 'simple-icons:microsoft',
    color: '#0078D4',
    category: 'tech'
  },
  
  // Add more brands as needed...
];

// Create a map for faster lookups
export const brandLogoMap = new Map(
  brandLogos.map(brand => [brand.domain, brand])
);

// Helper function to get logo by domain
export function getBrandLogo(domain: string): BrandLogo | undefined {
  return brandLogoMap.get(domain);
}

// Helper function to search brands by name
export function searchBrands(query: string): BrandLogo[] {
  const lowerQuery = query.toLowerCase();
  return brandLogos.filter(brand => 
    brand.name.toLowerCase().includes(lowerQuery) ||
    brand.domain.includes(lowerQuery)
  );
}