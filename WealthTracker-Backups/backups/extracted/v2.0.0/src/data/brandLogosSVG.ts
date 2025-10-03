// Comprehensive brand logo database with actual SVG logos
// These are simplified, recognizable versions of brand logos
// Letter-based fallback is used when no SVG is available

export interface BrandLogoSVG {
  name: string;
  svg: string;
  color: string;
}

export const brandLogosSVG: Record<string, BrandLogoSVG> = {
  // === UK SUPERMARKETS ===
  'tesco': {
    name: 'Tesco',
    color: '#005EB8',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#005EB8"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">TESCO</text>
    </svg>`
  },
  'sainsburys': {
    name: "Sainsbury's",
    color: '#FF7200',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF7200"/>
      <text x="24" y="32" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold">S</text>
    </svg>`
  },
  'asda': {
    name: 'ASDA',
    color: '#7DC242',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#7DC242"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">ASDA</text>
    </svg>`
  },
  'waitrose': {
    name: 'Waitrose',
    color: '#81B93F',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#81B93F"/>
      <path d="M12 20h24v2h-24z M16 26h16v2h-16z" fill="white"/>
      <text x="24" y="35" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="bold">WAITROSE</text>
    </svg>`
  },
  'morrisons': {
    name: 'Morrisons',
    color: '#FFD700',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FFD700"/>
      <text x="24" y="32" text-anchor="middle" fill="#004B00" font-family="Arial, sans-serif" font-size="20" font-weight="bold">M</text>
    </svg>`
  },
  'aldi': {
    name: 'Aldi',
    color: '#00559F',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00559F"/>
      <rect x="8" y="20" width="32" height="8" fill="#FF8800"/>
      <text x="24" y="32" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">ALDI</text>
    </svg>`
  },
  'lidl': {
    name: 'Lidl',
    color: '#0050AA',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" fill="#0050AA"/>
      <circle cx="24" cy="24" r="16" fill="#FFE500"/>
      <circle cx="24" cy="24" r="12" fill="#E3000B"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">LIDL</text>
    </svg>`
  },
  'coop': {
    name: 'Co-op',
    color: '#00B1E7',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00B1E7"/>
      <path d="M24 14 L34 24 L24 34 L14 24 Z" fill="white"/>
    </svg>`
  },
  'ms': {
    name: 'M&S',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">M&amp;S</text>
    </svg>`
  },
  
  // === UK RETAIL ===
  'johnlewis': {
    name: 'John Lewis',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <rect x="8" y="20" width="32" height="2" fill="white"/>
      <rect x="8" y="26" width="32" height="2" fill="white"/>
      <text x="24" y="38" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="normal">JOHN LEWIS</text>
    </svg>`
  },
  'argos': {
    name: 'Argos',
    color: '#ED1B24',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#ED1B24"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">ARGOS</text>
    </svg>`
  },
  'boots': {
    name: 'Boots',
    color: '#005EB8',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#005EB8"/>
      <path d="M24 12 C30 12 35 17 35 24 C35 31 30 36 24 36 C18 36 13 31 13 24 C13 17 18 12 24 12" fill="white"/>
      <text x="24" y="29" text-anchor="middle" fill="#005EB8" font-family="Arial, sans-serif" font-size="12" font-weight="bold">B</text>
    </svg>`
  },
  'next': {
    name: 'Next',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="300">NEXT</text>
    </svg>`
  },
  'primark': {
    name: 'Primark',
    color: '#0066B3',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0066B3"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">PRIMARK</text>
    </svg>`
  },
  
  // === INTERNATIONAL RETAIL ===
  'amazon': {
    name: 'Amazon',
    color: '#FF9900',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#232F3E"/>
      <path d="M35 32c-5 3-12 4-17 4c-5 0-9-1-12-3c0 0 0-1 1 0c3 2 7 3 11 3c3 0 7-1 10-2C32 32 35 31 35 32z" fill="#FF9900"/>
      <path d="M37 29c0-1-2 0-3 0c0 0-1 1 0 1c1 2 2 1 3 1C37 31 37 30 37 29z" fill="#FF9900"/>
    </svg>`
  },
  'apple': {
    name: 'Apple',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <path d="M31 16c-1 1-2 2-3 2c-1-2 0-4 1-5c1-1 3-2 4-2C33 13 32 15 31 16z M28 18c-3 0-4 2-6 2c-2 0-4-2-6-2c-3 0-6 3-6 8c0 5 4 10 7 10c2 0 3-1 5-1c2 0 3 1 5 1c3 0 7-5 7-10C34 21 30 18 28 18z" fill="white"/>
    </svg>`
  },
  
  // === FOOD & RESTAURANTS ===
  'mcdonalds': {
    name: "McDonald's",
    color: '#FFC72C',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#DA291C"/>
      <path d="M16 16c0-2 2-4 4-4s4 2 4 4v16h-8z M24 16c0-2 2-4 4-4s4 2 4 4v16h-8z" fill="#FFC72C"/>
    </svg>`
  },
  'starbucks': {
    name: 'Starbucks',
    color: '#00704A',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" fill="#00704A"/>
      <circle cx="24" cy="24" r="18" fill="white"/>
      <circle cx="24" cy="24" r="16" fill="#00704A"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">★</text>
    </svg>`
  },
  'costa': {
    name: 'Costa',
    color: '#6C1F45',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#6C1F45"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">COSTA</text>
    </svg>`
  },
  'greggs': {
    name: 'Greggs',
    color: '#00539F',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00539F"/>
      <rect x="8" y="20" width="32" height="8" fill="#FFD700"/>
      <text x="24" y="32" text-anchor="middle" fill="#00539F" font-family="Arial, sans-serif" font-size="12" font-weight="bold">GREGGS</text>
    </svg>`
  },
  'subway': {
    name: 'Subway',
    color: '#008C15',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#008C15"/>
      <path d="M8 20 L16 28 L24 20 L32 28 L40 20" stroke="#FFC600" stroke-width="4" fill="none"/>
      <path d="M8 28 L16 20 L24 28 L32 20 L40 28" stroke="#FFC600" stroke-width="4" fill="none"/>
    </svg>`
  },
  'kfc': {
    name: 'KFC',
    color: '#F40027',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#F40027"/>
      <rect x="4" y="4" width="40" height="40" rx="6" fill="white"/>
      <rect x="8" y="8" width="32" height="32" rx="4" fill="#F40027"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">KFC</text>
    </svg>`
  },
  
  // === TRANSPORT ===
  'uber': {
    name: 'Uber',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="normal">Uber</text>
    </svg>`
  },
  'shell': {
    name: 'Shell',
    color: '#DD1D21',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FFF200"/>
      <path d="M24 8 L32 16 L32 24 L24 32 L16 24 L16 16 Z" fill="#DD1D21"/>
    </svg>`
  },
  'bp': {
    name: 'BP',
    color: '#006F51',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#006F51"/>
      <circle cx="24" cy="24" r="12" fill="#FFF200"/>
      <circle cx="24" cy="24" r="8" fill="#006F51"/>
    </svg>`
  },
  
  // === ENTERTAINMENT ===
  'netflix': {
    name: 'Netflix',
    color: '#E50914',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" fill="#000000"/>
      <rect x="14" y="8" width="6" height="32" fill="#B1060F"/>
      <rect x="28" y="8" width="6" height="32" fill="#E50914"/>
      <path d="M14 8 L28 16 L28 40 L14 32 Z" fill="#E50914"/>
    </svg>`
  },
  'spotify': {
    name: 'Spotify',
    color: '#1DB954',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" fill="#1DB954"/>
      <path d="M32 20c-4-2-9-2-14 0c-1 0-1-1 0-1c5-2 11-2 16 0C35 19 33 20 32 20z" fill="white"/>
      <path d="M30 26c-3-2-8-2-12 0c-1 0-1-1 0-1c4-2 10-2 13 0C32 25 31 26 30 26z" fill="white"/>
      <path d="M28 32c-3-1-6-1-9 0c-1 0-1-1 0-1c3-1 7-1 10 0C30 31 29 32 28 32z" fill="white"/>
    </svg>`
  },
  'sky': {
    name: 'Sky',
    color: '#0072C9',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0072C9"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">sky</text>
    </svg>`
  },
  
  // === FINANCE ===
  'paypal': {
    name: 'PayPal',
    color: '#003087',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#003087"/>
      <path d="M20 12h8c4 0 7 3 7 7c0 4-3 7-7 7h-4l-1 10h-6l3-24z" fill="#009CDE"/>
      <path d="M16 16h8c3 0 5 2 5 5s-2 5-5 5h-4l-1 10h-6l3-20z" fill="white"/>
    </svg>`
  },
  'barclays': {
    name: 'Barclays',
    color: '#00AEEF',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00AEEF"/>
      <path d="M16 20 L24 12 L32 20 M16 28 L24 36 L32 28" stroke="white" stroke-width="3" fill="none"/>
    </svg>`
  },
  'hsbc': {
    name: 'HSBC',
    color: '#DB0011',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="white"/>
      <path d="M24 8 L40 24 L24 40 L8 24 Z" fill="#DB0011"/>
      <path d="M24 16 L32 24 L24 32 L16 24 Z" fill="white"/>
    </svg>`
  },
  'lloyds': {
    name: 'Lloyds',
    color: '#024731',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#024731"/>
      <path d="M12 24 L24 12 L36 24 L24 36 Z" fill="white"/>
      <circle cx="24" cy="24" r="8" fill="#024731"/>
    </svg>`
  },
  'natwest': {
    name: 'NatWest',
    color: '#5A287F',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#5A287F"/>
      <rect x="12" y="12" width="8" height="8" fill="white"/>
      <rect x="20" y="20" width="8" height="8" fill="white"/>
      <rect x="28" y="28" width="8" height="8" fill="white"/>
    </svg>`
  },
  
  // === UTILITIES ===
  'bt': {
    name: 'BT',
    color: '#5514B4',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" fill="#5514B4"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">BT</text>
    </svg>`
  },
  'ee': {
    name: 'EE',
    color: '#00B5B0',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00B5B0"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">EE</text>
    </svg>`
  },
  'o2': {
    name: 'O2',
    color: '#0019A5',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0019A5"/>
      <circle cx="20" cy="24" r="8" fill="none" stroke="white" stroke-width="2"/>
      <text x="30" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">2</text>
    </svg>`
  },
  'three': {
    name: 'Three',
    color: '#EE2E7B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#EE2E7B"/>
      <text x="24" y="32" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold">3</text>
    </svg>`
  },
  'vodafone': {
    name: 'Vodafone',
    color: '#E60000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" fill="#E60000"/>
      <circle cx="28" cy="16" r="6" fill="white"/>
      <path d="M22 20 Q16 24 16 32 Q16 36 20 36 Q24 36 28 32" stroke="white" stroke-width="3" fill="none"/>
    </svg>`
  },
  
  // === MORE UK SUPERMARKETS & FOOD STORES ===
  'iceland': {
    name: 'Iceland',
    color: '#EE1C2E',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#EE1C2E"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">ICELAND</text>
    </svg>`
  },
  'farmfoods': {
    name: 'Farm Foods',
    color: '#00A651',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00A651"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">FARM</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">FOODS</text>
    </svg>`
  },
  'wholefoods': {
    name: 'Whole Foods',
    color: '#00674B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" fill="#00674B"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="bold">WHOLE</text>
      <text x="24" y="34" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="bold">FOODS</text>
    </svg>`
  },
  
  // === UK HIGH STREET STORES ===
  'whsmith': {
    name: 'WHSmith',
    color: '#003DA5',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#003DA5"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">WH</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">SMITH</text>
    </svg>`
  },
  'waterstones': {
    name: 'Waterstones',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="32" text-anchor="middle" fill="white" font-family="Georgia, serif" font-size="20" font-weight="normal">W</text>
    </svg>`
  },
  'hmv': {
    name: 'HMV',
    color: '#E4007C',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E4007C"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">HMV</text>
    </svg>`
  },
  'game': {
    name: 'GAME',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <rect x="8" y="20" width="32" height="8" fill="#E60012"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">GAME</text>
    </svg>`
  },
  'curryspcworld': {
    name: 'Currys',
    color: '#742D82',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#742D82"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">CURRYS</text>
    </svg>`
  },
  'poundland': {
    name: 'Poundland',
    color: '#29A643',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#29A643"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">POUNDLAND</text>
    </svg>`
  },
  'wilko': {
    name: 'Wilko',
    color: '#E4002B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E4002B"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">wilko</text>
    </svg>`
  },
  
  // === MORE RESTAURANTS & CAFES ===
  'nandos': {
    name: "Nando's",
    color: '#DC241F',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#DC241F"/>
      <circle cx="24" cy="24" r="16" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="#DC241F" font-family="Arial, sans-serif" font-size="12" font-weight="bold">NANDO'S</text>
    </svg>`
  },
  'pizzahut': {
    name: 'Pizza Hut',
    color: '#ED1C24',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#ED1C24"/>
      <path d="M12 28 L24 16 L36 28 Z" fill="white"/>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="bold">PIZZA HUT</text>
    </svg>`
  },
  'dominos': {
    name: "Domino's",
    color: '#006491',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#006491"/>
      <rect x="16" y="12" width="16" height="24" rx="2" fill="white"/>
      <circle cx="20" cy="20" r="3" fill="#006491"/>
      <circle cx="28" cy="20" r="3" fill="#006491"/>
      <circle cx="24" cy="28" r="3" fill="#006491"/>
    </svg>`
  },
  'wagamama': {
    name: 'Wagamama',
    color: '#ED1C24',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#ED1C24"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">wagamama</text>
    </svg>`
  },
  'pret': {
    name: 'Pret',
    color: '#862633',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#862633"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Pret</text>
    </svg>`
  },
  'caffenero': {
    name: 'Caffè Nero',
    color: '#1A1919',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#1A1919"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">CAFFÈ</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">NERO</text>
    </svg>`
  },
  'deliveroo': {
    name: 'Deliveroo',
    color: '#00CCBC',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00CCBC"/>
      <path d="M16 20 L24 12 L32 20 L32 32 L24 36 L16 32 Z" fill="white"/>
    </svg>`
  },
  'ubereats': {
    name: 'Uber Eats',
    color: '#06C167',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#06C167"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="normal">Uber</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">Eats</text>
    </svg>`
  },
  'justeat': {
    name: 'Just Eat',
    color: '#FF8000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF8000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">JUST EAT</text>
    </svg>`
  },
  'frankie': {
    name: 'Frankie & Benny\'s',
    color: '#B91C1C',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#B91C1C"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="bold">FRANKIE</text>
      <text x="24" y="34" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="bold">&amp; BENNY'S</text>
    </svg>`
  },
  'pizzaexpress': {
    name: 'Pizza Express',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="normal">PIZZA</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="normal">EXPRESS</text>
    </svg>`
  },
  'byron': {
    name: 'Byron',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">BYRON</text>
    </svg>`
  },
  'giraffe': {
    name: 'Giraffe',
    color: '#F39C12',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#F39C12"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">giraffe</text>
    </svg>`
  },
  
  // === TRANSPORT & PARKING ===
  'trainline': {
    name: 'Trainline',
    color: '#00D5AB',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00D5AB"/>
      <rect x="16" y="14" width="16" height="20" rx="2" fill="white"/>
      <circle cx="20" cy="30" r="2" fill="#00D5AB"/>
      <circle cx="28" cy="30" r="2" fill="#00D5AB"/>
      <rect x="20" y="18" width="8" height="6" fill="#00D5AB"/>
    </svg>`
  },
  'nationalrail': {
    name: 'National Rail',
    color: '#C00000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#C00000"/>
      <path d="M12 20 L20 20 L28 28 L36 28" stroke="white" stroke-width="3" fill="none"/>
      <path d="M12 28 L20 28 L28 20 L36 20" stroke="white" stroke-width="3" fill="none"/>
    </svg>`
  },
  'tfl': {
    name: 'TfL',
    color: '#DC241F',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" fill="#DC241F"/>
      <rect x="8" y="22" width="32" height="4" fill="white"/>
      <circle cx="24" cy="24" r="18" fill="none" stroke="white" stroke-width="2"/>
    </svg>`
  },
  'ringgo': {
    name: 'RingGo',
    color: '#00A859',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00A859"/>
      <circle cx="24" cy="24" r="12" fill="none" stroke="white" stroke-width="3"/>
      <circle cx="24" cy="24" r="6" fill="white"/>
    </svg>`
  },
  'justpark': {
    name: 'JustPark',
    color: '#00D4AA',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00D4AA"/>
      <text x="24" y="32" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">P</text>
    </svg>`
  },
  'zipcar': {
    name: 'Zipcar',
    color: '#4EA94B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#4EA94B"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">zipcar</text>
    </svg>`
  },
  'enterprise': {
    name: 'Enterprise',
    color: '#00843D',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00843D"/>
      <text x="24" y="32" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">E</text>
    </svg>`
  },
  'hertz': {
    name: 'Hertz',
    color: '#FFD60A',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FFD60A"/>
      <text x="24" y="30" text-anchor="middle" fill="#000000" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Hertz</text>
    </svg>`
  },
  'avis': {
    name: 'Avis',
    color: '#ED1C24',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#ED1C24"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Avis</text>
    </svg>`
  },
  
  // === HOME & DIY ===
  'bq': {
    name: 'B&Q',
    color: '#FF6600',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF6600"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">B&amp;Q</text>
    </svg>`
  },
  'wickes': {
    name: 'Wickes',
    color: '#004B87',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#004B87"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">WICKES</text>
    </svg>`
  },
  'screwfix': {
    name: 'Screwfix',
    color: '#003D78',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#003D78"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">SCREWFIX</text>
    </svg>`
  },
  'homebase': {
    name: 'Homebase',
    color: '#00A14B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00A14B"/>
      <path d="M24 14 L34 24 L34 34 L14 34 L14 24 Z" fill="white"/>
    </svg>`
  },
  'toolstation': {
    name: 'Toolstation',
    color: '#0079C1',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0079C1"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="9" font-weight="bold">TOOL</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="9" font-weight="bold">STATION</text>
    </svg>`
  },
  'dunelm': {
    name: 'Dunelm',
    color: '#00A6A0',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00A6A0"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">dunelm</text>
    </svg>`
  },
  'therange': {
    name: 'The Range',
    color: '#ED1C24',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#ED1C24"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">THE</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">RANGE</text>
    </svg>`
  },
  
  // === ONLINE SERVICES ===
  'ebay': {
    name: 'eBay',
    color: '#E53238',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="white"/>
      <text x="12" y="30" text-anchor="start" fill="#E53238" font-family="Arial, sans-serif" font-size="16" font-weight="bold">e</text>
      <text x="18" y="30" text-anchor="start" fill="#0064D2" font-family="Arial, sans-serif" font-size="16" font-weight="bold">b</text>
      <text x="25" y="30" text-anchor="start" fill="#F5AF02" font-family="Arial, sans-serif" font-size="16" font-weight="bold">a</text>
      <text x="32" y="30" text-anchor="start" fill="#86B817" font-family="Arial, sans-serif" font-size="16" font-weight="bold">y</text>
    </svg>`
  },
  'etsy': {
    name: 'Etsy',
    color: '#F1641E',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#F1641E"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">Etsy</text>
    </svg>`
  },
  'airbnb': {
    name: 'Airbnb',
    color: '#FF5A5F',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF5A5F"/>
      <path d="M24 18c2 0 3 2 3 4s-1 4-3 4s-3-2-3-4s1-4 3-4zm0 14c4 0 8-4 8-8c0-2-2-4-4-6s-4-4-4-4s-2 2-4 4s-4 4-4 6c0 4 4 8 8 8z" fill="white"/>
    </svg>`
  },
  'booking': {
    name: 'Booking.com',
    color: '#003580',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#003580"/>
      <circle cx="24" cy="20" r="4" fill="white"/>
      <circle cx="24" cy="28" r="4" fill="white"/>
      <rect x="20" y="20" width="8" height="8" fill="#003580"/>
    </svg>`
  },
  'expedia': {
    name: 'Expedia',
    color: '#00355F',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00355F"/>
      <circle cx="24" cy="24" r="12" fill="#FFC72C"/>
      <path d="M24 16v16m-8-8h16" stroke="#00355F" stroke-width="2"/>
    </svg>`
  },
  
  // === MORE UK BANKS ===
  'halifax': {
    name: 'Halifax',
    color: '#005EB8',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#005EB8"/>
      <path d="M16 16 L24 24 L16 32 M32 16 L24 24 L32 32" stroke="white" stroke-width="3" fill="none"/>
    </svg>`
  },
  'nationwide': {
    name: 'Nationwide',
    color: '#1B3A6B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#1B3A6B"/>
      <path d="M12 32 L24 20 L36 32" stroke="white" stroke-width="3" fill="none"/>
      <rect x="16" y="26" width="16" height="10" fill="white"/>
    </svg>`
  },
  'santander': {
    name: 'Santander',
    color: '#EC0000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#EC0000"/>
      <path d="M24 16 C20 24 28 24 24 32 C28 24 20 24 24 16" fill="white"/>
    </svg>`
  },
  'tsb': {
    name: 'TSB',
    color: '#005EB8',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#005EB8"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">TSB</text>
    </svg>`
  },
  'metrobank': {
    name: 'Metro Bank',
    color: '#DC2928',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#DC2928"/>
      <text x="24" y="32" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">M</text>
    </svg>`
  },
  'revolut': {
    name: 'Revolut',
    color: '#0075EB',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0075EB"/>
      <path d="M16 16 L24 16 C28 16 32 20 32 24 L24 24 L32 32" stroke="white" stroke-width="3" fill="none"/>
    </svg>`
  },
  'monzo': {
    name: 'Monzo',
    color: '#FF3464',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF3464"/>
      <text x="24" y="32" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">M</text>
    </svg>`
  },
  'starling': {
    name: 'Starling',
    color: '#6935FF',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#6935FF"/>
      <circle cx="24" cy="24" r="12" fill="white"/>
      <circle cx="24" cy="24" r="8" fill="#6935FF"/>
    </svg>`
  },
  
  // === STREAMING & ENTERTAINMENT ===
  'disneyplus': {
    name: 'Disney+',
    color: '#113CCF',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#113CCF"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">D+</text>
    </svg>`
  },
  'amazonprime': {
    name: 'Amazon Prime',
    color: '#00A8E1',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00A8E1"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">prime</text>
      <path d="M16 30 C20 34 28 34 32 30" stroke="white" stroke-width="2" fill="none"/>
    </svg>`
  },
  'nowtv': {
    name: 'NOW TV',
    color: '#00D7BE',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00D7BE"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">NOW</text>
    </svg>`
  },
  'britbox': {
    name: 'BritBox',
    color: '#0E1B42',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0E1B42"/>
      <rect x="10" y="16" width="28" height="16" rx="2" fill="#E4003B"/>
      <rect x="10" y="16" width="14" height="8" fill="#012169"/>
      <path d="M10 16 L24 24 M10 24 L24 16" stroke="white" stroke-width="2"/>
    </svg>`
  },
  'paramount': {
    name: 'Paramount+',
    color: '#0064FF',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0064FF"/>
      <path d="M24 12 L30 24 L24 36 L18 24 Z" fill="white"/>
    </svg>`
  },
  'discovery': {
    name: 'Discovery+',
    color: '#2175FF',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#2175FF"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">d+</text>
    </svg>`
  },
  'hayu': {
    name: 'Hayu',
    color: '#FF00BF',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF00BF"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">hayu</text>
    </svg>`
  },
  
  // === UK BANKS & BUILDING SOCIETIES ===
  'royalbankofscotland': {
    name: 'Royal Bank of Scotland',
    color: '#002F5F',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#002F5F"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">RBS</text>
    </svg>`
  },
  'bankofscotland': {
    name: 'Bank of Scotland',
    color: '#00447C',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00447C"/>
      <path d="M24 12 L30 18 L30 30 L18 30 L18 18 Z" fill="white"/>
    </svg>`
  },
  'clydesdale': {
    name: 'Clydesdale Bank',
    color: '#D40E8C',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#D40E8C"/>
      <text x="24" y="32" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">C</text>
    </svg>`
  },
  'yorkshirebank': {
    name: 'Yorkshire Bank',
    color: '#00A6A0',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00A6A0"/>
      <text x="24" y="32" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">Y</text>
    </svg>`
  },
  'virginmoney': {
    name: 'Virgin Money',
    color: '#C41E3A',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#C41E3A"/>
      <text x="24" y="32" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">V</text>
    </svg>`
  },
  'skipton': {
    name: 'Skipton Building Society',
    color: '#00A79D',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00A79D"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">SKIPTON</text>
    </svg>`
  },
  'yorkshire': {
    name: 'Yorkshire Building Society',
    color: '#4B286D',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#4B286D"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">YBS</text>
    </svg>`
  },
  'coventry': {
    name: 'Coventry Building Society',
    color: '#0066CC',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0066CC"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">CBS</text>
    </svg>`
  },
  'leeds': {
    name: 'Leeds Building Society',
    color: '#006BB6',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#006BB6"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">LBS</text>
    </svg>`
  },
  'nottingham': {
    name: 'Nottingham Building Society',
    color: '#E30613',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E30613"/>
      <path d="M24 12 L36 30 L12 30 Z" fill="white"/>
    </svg>`
  },
  
  // === CREDIT CARD COMPANIES ===
  'visa': {
    name: 'Visa',
    color: '#1A1F71',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="white"/>
      <text x="24" y="30" text-anchor="middle" fill="#1A1F71" font-family="Arial, sans-serif" font-size="16" font-weight="bold">VISA</text>
    </svg>`
  },
  'mastercard': {
    name: 'Mastercard',
    color: '#EB001B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="white"/>
      <circle cx="18" cy="24" r="10" fill="#EB001B"/>
      <circle cx="30" cy="24" r="10" fill="#F79E1B"/>
      <rect x="18" y="14" width="12" height="20" fill="#FF5F00"/>
    </svg>`
  },
  'americanexpress': {
    name: 'American Express',
    color: '#006FCF',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#006FCF"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">AMEX</text>
    </svg>`
  },
  'discover': {
    name: 'Discover',
    color: '#FF6000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="white"/>
      <text x="24" y="26" text-anchor="middle" fill="#231F20" font-family="Arial, sans-serif" font-size="10" font-weight="bold">DISCOVER</text>
      <circle cx="36" cy="30" r="6" fill="#FF6000"/>
    </svg>`
  },
  'dinersclub': {
    name: 'Diners Club',
    color: '#0079BE',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="white"/>
      <circle cx="24" cy="24" r="12" fill="#0079BE"/>
      <circle cx="24" cy="24" r="8" fill="white"/>
      <rect x="20" y="16" width="8" height="16" fill="#0079BE"/>
    </svg>`
  },
  
  // === MORE UK RETAIL ===
  'matalan': {
    name: 'Matalan',
    color: '#00A6A0',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00A6A0"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">matalan</text>
    </svg>`
  },
  'newlook': {
    name: 'New Look',
    color: '#E4002B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E4002B"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">NEW</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">LOOK</text>
    </svg>`
  },
  'riverisland': {
    name: 'River Island',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">RI</text>
    </svg>`
  },
  'topshop': {
    name: 'Topshop',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">TOP</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">SHOP</text>
    </svg>`
  },
  'debenhams': {
    name: 'Debenhams',
    color: '#FF6600',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF6600"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">DEBENHAMS</text>
    </svg>`
  },
  'selfridges': {
    name: 'Selfridges',
    color: '#FFD700',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FFD700"/>
      <text x="24" y="30" text-anchor="middle" fill="#000000" font-family="Arial, sans-serif" font-size="12" font-weight="bold">S&amp;Co</text>
    </svg>`
  },
  'harrods': {
    name: 'Harrods',
    color: '#84754E',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#84754E"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">HARRODS</text>
    </svg>`
  },
  'liberty': {
    name: 'Liberty',
    color: '#3E2C56',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#3E2C56"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="normal">LIBERTY</text>
    </svg>`
  },
  'fenwicks': {
    name: 'Fenwicks',
    color: '#000080',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000080"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">FENWICKS</text>
    </svg>`
  },
  'tkmaxx': {
    name: 'TK Maxx',
    color: '#E20E18',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E20E18"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">TK MAXX</text>
    </svg>`
  },
  'homesense': {
    name: 'HomeSense',
    color: '#00A0AF',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00A0AF"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">HOME</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">SENSE</text>
    </svg>`
  },
  
  // === UK DEPARTMENT STORES ===
  'houseoffraser': {
    name: 'House of Fraser',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="bold">HOUSE OF</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="bold">FRASER</text>
    </svg>`
  },
  'harveynichols': {
    name: 'Harvey Nichols',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">HN</text>
    </svg>`
  },
  
  // === MORE UK RESTAURANTS ===
  'harvester': {
    name: 'Harvester',
    color: '#006633',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#006633"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">HARVESTER</text>
    </svg>`
  },
  'beefeater': {
    name: 'Beefeater',
    color: '#C8102E',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#C8102E"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">BEEFEATER</text>
    </svg>`
  },
  'brewersfarye': {
    name: 'Brewers Fayre',
    color: '#FF6900',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF6900"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">BREWERS</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">FAYRE</text>
    </svg>`
  },
  'wetherspoon': {
    name: 'Wetherspoon',
    color: '#004B87',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#004B87"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="9" font-weight="bold">WETHERSPOON</text>
    </svg>`
  },
  'yosushi': {
    name: 'YO! Sushi',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <circle cx="24" cy="24" r="16" fill="#00FF00"/>
      <text x="24" y="30" text-anchor="middle" fill="#000000" font-family="Arial, sans-serif" font-size="12" font-weight="bold">YO!</text>
    </svg>`
  },
  'itsu': {
    name: 'itsu',
    color: '#E30613',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E30613"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">itsu</text>
    </svg>`
  },
  'wasabi': {
    name: 'Wasabi',
    color: '#7CB342',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#7CB342"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">wasabi</text>
    </svg>`
  },
  'leon': {
    name: 'LEON',
    color: '#D32F2F',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#D32F2F"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">LEON</text>
    </svg>`
  },
  'eat': {
    name: 'EAT',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">EAT.</text>
    </svg>`
  },
  'zizzi': {
    name: 'Zizzi',
    color: '#E4002B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E4002B"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Zizzi</text>
    </svg>`
  },
  'askitalian': {
    name: 'ASK Italian',
    color: '#009639',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#009639"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">ASK</text>
    </svg>`
  },
  'prezzo': {
    name: 'Prezzo',
    color: '#C8102E',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#C8102E"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">PREZZO</text>
    </svg>`
  },
  'carluccios': {
    name: "Carluccio's",
    color: '#0066CC',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0066CC"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">Carluccio's</text>
    </svg>`
  },
  'gbk': {
    name: 'Gourmet Burger Kitchen',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">GBK</text>
    </svg>`
  },
  'honestburgers': {
    name: 'Honest Burgers',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">HONEST</text>
    </svg>`
  },
  'bills': {
    name: "Bill's",
    color: '#FF6B35',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF6B35"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">BILL'S</text>
    </svg>`
  },
  'cote': {
    name: 'Côte',
    color: '#000080',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000080"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">CÔTE</text>
    </svg>`
  },
  
  // === US RETAIL ===
  'macys': {
    name: "Macy's",
    color: '#E21A2C',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E21A2C"/>
      <path d="M24 12 L27 22 L37 22 L29 28 L32 38 L24 32 L16 38 L19 28 L11 22 L21 22 Z" fill="white"/>
    </svg>`
  },
  'nordstrom': {
    name: 'Nordstrom',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="normal">NORDSTROM</text>
    </svg>`
  },
  'saks': {
    name: 'Saks Fifth Avenue',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">SAKS</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="normal">FIFTH AVENUE</text>
    </svg>`
  },
  'bloomingdales': {
    name: "Bloomingdale's",
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">b</text>
    </svg>`
  },
  'jcpenney': {
    name: 'JCPenney',
    color: '#CC0000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#CC0000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">JCPenney</text>
    </svg>`
  },
  'kohls': {
    name: "Kohl's",
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">KOHL'S</text>
    </svg>`
  },
  'sears': {
    name: 'Sears',
    color: '#004B8D',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#004B8D"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">SEARS</text>
    </svg>`
  },
  'tjmaxx': {
    name: 'TJ Maxx',
    color: '#E21836',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E21836"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">T.J.maxx</text>
    </svg>`
  },
  'marshalls': {
    name: 'Marshalls',
    color: '#0054A6',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0054A6"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">Marshalls</text>
    </svg>`
  },
  'ross': {
    name: 'Ross',
    color: '#0066CC',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0066CC"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">ROSS</text>
    </svg>`
  },
  
  // === US RESTAURANTS ===
  'olivegarden': {
    name: 'Olive Garden',
    color: '#89A54E',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#89A54E"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">OLIVE</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">GARDEN</text>
    </svg>`
  },
  'applebees': {
    name: "Applebee's",
    color: '#C8102E',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#C8102E"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">Applebee's</text>
    </svg>`
  },
  'chilis': {
    name: "Chili's",
    color: '#EE2A35',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#EE2A35"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Chili's</text>
    </svg>`
  },
  'tgifridays': {
    name: "TGI Friday's",
    color: '#C8102E',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#C8102E"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">TGI</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">FRIDAY'S</text>
    </svg>`
  },
  'outback': {
    name: 'Outback Steakhouse',
    color: '#8B0000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#8B0000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">OUTBACK</text>
    </svg>`
  },
  'redlobster': {
    name: 'Red Lobster',
    color: '#E31837',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E31837"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">RED</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">LOBSTER</text>
    </svg>`
  },
  'cheesecakefactory': {
    name: 'The Cheesecake Factory',
    color: '#8B4513',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#8B4513"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">CF</text>
    </svg>`
  },
  'pandaexpress': {
    name: 'Panda Express',
    color: '#C8102E',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#C8102E"/>
      <circle cx="24" cy="24" r="12" fill="white"/>
      <circle cx="20" cy="20" r="3" fill="#000000"/>
      <circle cx="28" cy="20" r="3" fill="#000000"/>
    </svg>`
  },
  'chickfila': {
    name: 'Chick-fil-A',
    color: '#DD0031',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#DD0031"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">C</text>
    </svg>`
  },
  'wendys': {
    name: "Wendy's",
    color: '#E2203D',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E2203D"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">Wendy's</text>
    </svg>`
  },
  'tacobell': {
    name: 'Taco Bell',
    color: '#702082',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#702082"/>
      <circle cx="24" cy="24" r="12" fill="white"/>
      <path d="M24 16 Q16 24 24 32 Q32 24 24 16" fill="#702082"/>
    </svg>`
  },
  'popeyes': {
    name: 'Popeyes',
    color: '#F68221',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#F68221"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">Popeyes</text>
    </svg>`
  },
  'arbys': {
    name: "Arby's",
    color: '#C8102E',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#C8102E"/>
      <path d="M12 28 Q24 16 36 28" stroke="white" stroke-width="4" fill="none"/>
    </svg>`
  },
  'sonicdrivein': {
    name: 'Sonic Drive-In',
    color: '#FFC600',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FFC600"/>
      <text x="24" y="30" text-anchor="middle" fill="#1B75BB" font-family="Arial, sans-serif" font-size="14" font-weight="bold">SONIC</text>
    </svg>`
  },
  'dairyqueen': {
    name: 'Dairy Queen',
    color: '#E4002B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E4002B"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">DQ</text>
    </svg>`
  },
  'dunkindonuts': {
    name: 'Dunkin',
    color: '#FF6E1B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF6E1B"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">DUNKIN'</text>
    </svg>`
  },
  'baskinrobbins': {
    name: 'Baskin-Robbins',
    color: '#006DB7',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#006DB7"/>
      <circle cx="18" cy="24" r="8" fill="#DA2866"/>
      <circle cx="30" cy="24" r="8" fill="#DA2866"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">BR</text>
    </svg>`
  },
  
  // === US BANKS ===
  'chase': {
    name: 'Chase',
    color: '#0F4C81',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0F4C81"/>
      <rect x="14" y="14" width="8" height="8" fill="white"/>
      <rect x="26" y="14" width="8" height="8" fill="white"/>
      <rect x="14" y="26" width="8" height="8" fill="white"/>
      <rect x="26" y="26" width="8" height="8" fill="white"/>
    </svg>`
  },
  'bankofamerica': {
    name: 'Bank of America',
    color: '#E31837',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E31837"/>
      <rect x="16" y="16" width="16" height="16" fill="#0066B2"/>
      <rect x="20" y="20" width="8" height="8" fill="white"/>
    </svg>`
  },
  'wellsfargo': {
    name: 'Wells Fargo',
    color: '#D71E2B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#D71E2B"/>
      <rect x="12" y="20" width="24" height="8" fill="#FFCD41"/>
    </svg>`
  },
  'citibank': {
    name: 'Citibank',
    color: '#0088CC',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0088CC"/>
      <path d="M16 24 Q24 18 32 24" stroke="white" stroke-width="3" fill="none"/>
      <circle cx="24" cy="24" r="2" fill="#ED1C24"/>
    </svg>`
  },
  'usbank': {
    name: 'U.S. Bank',
    color: '#0060A9',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#0060A9"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">US BANK</text>
    </svg>`
  },
  'pnc': {
    name: 'PNC Bank',
    color: '#FF7900',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF7900"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">PNC</text>
    </svg>`
  },
  'capitalone': {
    name: 'Capital One',
    color: '#D03027',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#D03027"/>
      <path d="M12 24 Q24 14 36 24 Q24 34 12 24" fill="white"/>
    </svg>`
  },
  'tdbank': {
    name: 'TD Bank',
    color: '#00A950',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00A950"/>
      <rect x="12" y="18" width="24" height="12" fill="white"/>
      <text x="24" y="28" text-anchor="middle" fill="#00A950" font-family="Arial, sans-serif" font-size="14" font-weight="bold">TD</text>
    </svg>`
  },
  'fifththird': {
    name: 'Fifth Third Bank',
    color: '#1565C0',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#1565C0"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">5/3</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="normal">BANK</text>
    </svg>`
  },
  'keybank': {
    name: 'KeyBank',
    color: '#007F3B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#007F3B"/>
      <circle cx="24" cy="20" r="6" fill="white"/>
      <rect x="22" y="24" width="4" height="10" fill="white"/>
    </svg>`
  },
  
  // === UK COFFEE SHOPS ===
  'coffeenumber1': {
    name: 'Coffee#1',
    color: '#8B4513',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#8B4513"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">COFFEE</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">#1</text>
    </svg>`
  },
  'bostonteaparty': {
    name: 'Boston Tea Party',
    color: '#2E7D32',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#2E7D32"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">BTP</text>
    </svg>`
  },
  'patisserie': {
    name: 'Patisserie Valerie',
    color: '#E91E63',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#E91E63"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">PV</text>
    </svg>`
  },
  'coffeeco': {
    name: 'The Coffee Co',
    color: '#3E2723',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#3E2723"/>
      <circle cx="24" cy="24" r="16" fill="none" stroke="white" stroke-width="2"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">CC</text>
    </svg>`
  },
  'amt': {
    name: 'AMT Coffee',
    color: '#C41E3A',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#C41E3A"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">AMT</text>
    </svg>`
  },
  'harristeeter': {
    name: 'Harris + Hoole',
    color: '#4A148C',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#4A148C"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">HARRIS</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">+</text>
    </svg>`
  },
  'coffeerepublic': {
    name: 'Coffee Republic',
    color: '#B71C1C',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#B71C1C"/>
      <circle cx="24" cy="24" r="16" fill="none" stroke="white" stroke-width="2"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">CR</text>
    </svg>`
  },
  'beany': {
    name: 'Beany Green',
    color: '#4CAF50',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#4CAF50"/>
      <circle cx="20" cy="24" r="6" fill="white"/>
      <circle cx="28" cy="24" r="6" fill="white"/>
    </svg>`
  },
  'taylor': {
    name: 'Taylor St Baristas',
    color: '#212121',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#212121"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">TSB</text>
    </svg>`
  },
  'blacksheep': {
    name: 'Black Sheep Coffee',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <circle cx="24" cy="20" r="8" fill="white"/>
      <path d="M16 28 Q24 36 32 28" fill="white"/>
    </svg>`
  },
  'grindcoffee': {
    name: 'Grind',
    color: '#FF1744',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF1744"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">GRIND</text>
    </svg>`
  },
  'joe': {
    name: 'Joe & The Juice',
    color: '#FF6B6B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF6B6B"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">JOE &amp;</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="bold">THE JUICE</text>
    </svg>`
  },
  
  // === UK BAKERIES ===
  'paulbakery': {
    name: 'PAUL',
    color: '#000000',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">PAUL</text>
    </svg>`
  },
  'gailsbakery': {
    name: "GAIL's",
    color: '#B8860B',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#B8860B"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">GAIL's</text>
    </svg>`
  },
  'oleandsteen': {
    name: 'Ole & Steen',
    color: '#D2691E',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#D2691E"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">OLE &amp;</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">STEEN</text>
    </svg>`
  },
  'poundsbakery': {
    name: 'Poundbakery',
    color: '#FFA500',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FFA500"/>
      <text x="24" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">POUND</text>
      <text x="24" y="36" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">BAKERY</text>
    </svg>`
  },
  'birdsbakery': {
    name: 'Birds Bakery',
    color: '#FF6347',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF6347"/>
      <circle cx="24" cy="20" r="8" fill="white"/>
      <path d="M16 28 L24 32 L32 28" stroke="white" stroke-width="2" fill="none"/>
    </svg>`
  },
  'coopinstore': {
    name: 'Co-op In-Store Bakery',
    color: '#00B1E7',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#00B1E7"/>
      <path d="M12 24 L24 12 L36 24 L36 36 L12 36 Z" fill="white"/>
      <text x="24" y="30" text-anchor="middle" fill="#00B1E7" font-family="Arial, sans-serif" font-size="10" font-weight="bold">BAKERY</text>
    </svg>`
  },
  'euphorium': {
    name: 'Euphorium Bakery',
    color: '#8B4513',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#8B4513"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">E</text>
    </svg>`
  },
  'konditor': {
    name: 'Konditor',
    color: '#FF69B4',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF69B4"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="bold">K</text>
    </svg>`
  },
  'breadahead': {
    name: 'Bread Ahead',
    color: '#8B7355',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#8B7355"/>
      <circle cx="24" cy="24" r="12" fill="white"/>
      <text x="24" y="30" text-anchor="middle" fill="#8B7355" font-family="Arial, sans-serif" font-size="12" font-weight="bold">BA</text>
    </svg>`
  },
  'flourpot': {
    name: 'Flour Pot Bakery',
    color: '#CD853F',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#CD853F"/>
      <circle cx="24" cy="24" r="16" fill="none" stroke="white" stroke-width="2"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">FP</text>
    </svg>`
  },
  'doughnut': {
    name: 'Doughnut Time',
    color: '#FF1493',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#FF1493"/>
      <circle cx="24" cy="24" r="12" fill="none" stroke="white" stroke-width="4"/>
      <circle cx="24" cy="24" r="6" fill="white"/>
    </svg>`
  },
  'oddsbakery': {
    name: 'ODDS Bakery',
    color: '#4169E1',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#4169E1"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">ODDS</text>
    </svg>`
  },
  'millie': {
    name: "Millie's Cookies",
    color: '#DC143C',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#DC143C"/>
      <circle cx="24" cy="24" r="12" fill="white"/>
      <circle cx="20" cy="20" r="2" fill="#DC143C"/>
      <circle cx="28" cy="20" r="2" fill="#DC143C"/>
      <circle cx="24" cy="28" r="2" fill="#DC143C"/>
    </svg>`
  },
  'cinnamon': {
    name: 'Cinnabon',
    color: '#8B4513',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#8B4513"/>
      <path d="M24 12 Q36 24 24 36 Q12 24 24 12" fill="none" stroke="white" stroke-width="3"/>
    </svg>`
  },
  'krispy': {
    name: 'Krispy Kreme',
    color: '#006847',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#006847"/>
      <circle cx="24" cy="24" r="14" fill="white"/>
      <circle cx="24" cy="24" r="10" fill="#DA291C"/>
      <circle cx="24" cy="24" r="6" fill="white"/>
    </svg>`
  },
  'pretzel': {
    name: 'Auntie Anne\'s',
    color: '#003087',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#003087"/>
      <path d="M16 24 Q24 16 32 24 Q24 32 16 24" fill="none" stroke="white" stroke-width="3"/>
      <circle cx="20" cy="24" r="3" fill="white"/>
      <circle cx="28" cy="24" r="3" fill="white"/>
    </svg>`
  },
  'lepaindequotidien': {
    name: 'Le Pain Quotidien',
    color: '#8B6914',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#8B6914"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">LPQ</text>
    </svg>`
  },
  'maisonbertaux': {
    name: 'Maison Bertaux',
    color: '#4B0082',
    svg: `<svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#4B0082"/>
      <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">MB</text>
    </svg>`
  }
};

// Helper function to get logo SVG or generate letter-based fallback
export function getBrandLogoSVG(brandKey: string, brandName: string, brandColor: string): string {
  const logo = brandLogosSVG[brandKey];
  
  if (logo) {
    return logo.svg;
  }
  
  // Generate letter-based fallback
  const initials = brandName
    .split(' ')
    .map(word => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
    
  return `<svg viewBox="0 0 48 48" fill="none">
    <rect width="48" height="48" rx="8" fill="${brandColor}"/>
    <text x="24" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="bold">${initials}</text>
  </svg>`;
}