#!/usr/bin/env node

// Script to generate a comprehensive brand logo database
// This creates a local database of brand information that works without external API calls

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Comprehensive list of popular brands with their details
const brands = [
  // === RETAIL - INTERNATIONAL ===
  { name: 'Amazon', domain: 'amazon.com', color: '#FF9800', category: 'retail', keywords: ['amazon', 'amzn'] },
  { name: 'Amazon UK', domain: 'amazon.co.uk', color: '#FF9800', category: 'retail', keywords: ['amazon uk'] },
  { name: 'eBay', domain: 'ebay.com', color: '#E53238', category: 'retail', keywords: ['ebay'] },
  { name: 'Walmart', domain: 'walmart.com', color: '#0071CE', category: 'retail', keywords: ['walmart'] },
  { name: 'Target', domain: 'target.com', color: '#CC0000', category: 'retail', keywords: ['target'] },
  { name: 'Best Buy', domain: 'bestbuy.com', color: '#0046BE', category: 'retail', keywords: ['best buy', 'bestbuy'] },
  { name: 'Home Depot', domain: 'homedepot.com', color: '#F96302', category: 'retail', keywords: ['home depot'] },
  { name: "Lowe's", domain: 'lowes.com', color: '#004990', category: 'retail', keywords: ['lowes', "lowe's"] },
  { name: 'Costco', domain: 'costco.com', color: '#005DAA', category: 'retail', keywords: ['costco'] },
  { name: 'IKEA', domain: 'ikea.com', color: '#0058A3', category: 'retail', keywords: ['ikea'] },
  
  // === RETAIL - UK SPECIFIC ===
  { name: 'Tesco', domain: 'tesco.com', color: '#005EB8', category: 'retail', keywords: ['tesco', 'tesco express', 'tesco metro', 'tesco extra'] },
  { name: "Sainsbury's", domain: 'sainsburys.co.uk', color: '#FF7200', category: 'retail', keywords: ['sainsbury', 'sainsburys', "sainsbury's"] },
  { name: 'ASDA', domain: 'asda.com', color: '#7DC242', category: 'retail', keywords: ['asda'] },
  { name: 'Morrisons', domain: 'morrisons.com', color: '#FFD700', category: 'retail', keywords: ['morrison', 'morrisons'] },
  { name: 'Waitrose', domain: 'waitrose.com', color: '#81B93F', category: 'retail', keywords: ['waitrose'] },
  { name: 'Aldi', domain: 'aldi.co.uk', color: '#00559F', category: 'retail', keywords: ['aldi'] },
  { name: 'Lidl', domain: 'lidl.co.uk', color: '#0050AA', category: 'retail', keywords: ['lidl'] },
  { name: 'Co-op', domain: 'coop.co.uk', color: '#00B1E7', category: 'retail', keywords: ['co-op', 'coop', 'cooperative'] },
  { name: 'M&S', domain: 'marksandspencer.com', color: '#000000', category: 'retail', keywords: ['m&s', 'marks spencer', 'marks and spencer', 'marks & spencer'] },
  { name: 'Argos', domain: 'argos.co.uk', color: '#ED1B24', category: 'retail', keywords: ['argos'] },
  { name: 'John Lewis', domain: 'johnlewis.com', color: '#000000', category: 'retail', keywords: ['john lewis', 'johnlewis'] },
  { name: 'Currys', domain: 'currys.co.uk', color: '#742D82', category: 'retail', keywords: ['currys', 'currys pc world'] },
  { name: 'Next', domain: 'next.co.uk', color: '#000000', category: 'retail', keywords: ['next', 'next retail'] },
  { name: 'Primark', domain: 'primark.com', color: '#0066B3', category: 'retail', keywords: ['primark'] },
  { name: 'Boots', domain: 'boots.com', color: '#005EB8', category: 'retail', keywords: ['boots'] },
  { name: 'Superdrug', domain: 'superdrug.com', color: '#E6007E', category: 'retail', keywords: ['superdrug'] },
  { name: 'Halfords', domain: 'halfords.com', color: '#EE3124', category: 'retail', keywords: ['halfords'] },
  { name: 'B&Q', domain: 'diy.com', color: '#FF6600', category: 'retail', keywords: ['b&q', 'b and q', 'bandq'] },
  { name: 'Wickes', domain: 'wickes.co.uk', color: '#004B87', category: 'retail', keywords: ['wickes'] },
  { name: 'Screwfix', domain: 'screwfix.com', color: '#003D78', category: 'retail', keywords: ['screwfix'] },
  
  // === FASHION ===
  { name: 'H&M', domain: 'hm.com', color: '#E50010', category: 'retail', keywords: ['h&m', 'h & m', 'hennes'] },
  { name: 'Zara', domain: 'zara.com', color: '#000000', category: 'retail', keywords: ['zara'] },
  { name: 'Uniqlo', domain: 'uniqlo.com', color: '#FF0000', category: 'retail', keywords: ['uniqlo'] },
  { name: 'Gap', domain: 'gap.com', color: '#002868', category: 'retail', keywords: ['gap'] },
  { name: 'Nike', domain: 'nike.com', color: '#000000', category: 'retail', keywords: ['nike'] },
  { name: 'Adidas', domain: 'adidas.com', color: '#000000', category: 'retail', keywords: ['adidas'] },
  { name: 'ASOS', domain: 'asos.com', color: '#000000', category: 'retail', keywords: ['asos'] },
  { name: 'Boohoo', domain: 'boohoo.com', color: '#000000', category: 'retail', keywords: ['boohoo'] },
  
  // === FOOD & RESTAURANTS ===
  { name: "McDonald's", domain: 'mcdonalds.com', color: '#FFC72C', category: 'food', keywords: ['mcdonald', 'mcdonalds', 'mcd'] },
  { name: 'KFC', domain: 'kfc.com', color: '#F40027', category: 'food', keywords: ['kfc', 'kentucky fried chicken'] },
  { name: 'Burger King', domain: 'burgerking.com', color: '#D62300', category: 'food', keywords: ['burger king'] },
  { name: 'Subway', domain: 'subway.com', color: '#008C15', category: 'food', keywords: ['subway'] },
  { name: 'Starbucks', domain: 'starbucks.com', color: '#00704A', category: 'food', keywords: ['starbucks'] },
  { name: 'Costa Coffee', domain: 'costa.co.uk', color: '#6C1F45', category: 'food', keywords: ['costa', 'costa coffee'] },
  { name: 'Pret A Manger', domain: 'pret.com', color: '#862633', category: 'food', keywords: ['pret', 'pret a manger'] },
  { name: 'Greggs', domain: 'greggs.co.uk', color: '#00539F', category: 'food', keywords: ['greggs'] },
  { name: "Nando's", domain: 'nandos.com', color: '#DC241F', category: 'food', keywords: ['nando', 'nandos'] },
  { name: 'Pizza Hut', domain: 'pizzahut.com', color: '#ED1C24', category: 'food', keywords: ['pizza hut'] },
  { name: "Domino's", domain: 'dominos.com', color: '#006491', category: 'food', keywords: ['domino', 'dominos'] },
  { name: 'Wagamama', domain: 'wagamama.com', color: '#ED1C24', category: 'food', keywords: ['wagamama'] },
  { name: 'Five Guys', domain: 'fiveguys.com', color: '#ED174F', category: 'food', keywords: ['five guys'] },
  { name: 'Chipotle', domain: 'chipotle.com', color: '#A81612', category: 'food', keywords: ['chipotle'] },
  { name: 'Deliveroo', domain: 'deliveroo.com', color: '#00CCBC', category: 'food', keywords: ['deliveroo'] },
  { name: 'Uber Eats', domain: 'ubereats.com', color: '#06C167', category: 'food', keywords: ['uber eats', 'ubereats'] },
  { name: 'Just Eat', domain: 'just-eat.com', color: '#FF8000', category: 'food', keywords: ['just eat', 'justeat'] },
  
  // === TRANSPORT ===
  { name: 'Uber', domain: 'uber.com', color: '#000000', category: 'transport', keywords: ['uber'] },
  { name: 'Lyft', domain: 'lyft.com', color: '#FF00BF', category: 'transport', keywords: ['lyft'] },
  { name: 'Addison Lee', domain: 'addisonlee.com', color: '#E30613', category: 'transport', keywords: ['addison lee'] },
  { name: 'National Rail', domain: 'nationalrail.co.uk', color: '#C00000', category: 'transport', keywords: ['national rail', 'trainline', 'rail', 'railway'] },
  { name: 'TfL', domain: 'tfl.gov.uk', color: '#DC241F', category: 'transport', keywords: ['tfl', 'transport for london', 'london underground', 'oyster'] },
  { name: 'British Airways', domain: 'britishairways.com', color: '#2E5C99', category: 'transport', keywords: ['british airways', 'ba.com'] },
  { name: 'EasyJet', domain: 'easyjet.com', color: '#FF6600', category: 'transport', keywords: ['easyjet'] },
  { name: 'Ryanair', domain: 'ryanair.com', color: '#073590', category: 'transport', keywords: ['ryanair'] },
  { name: 'Virgin Atlantic', domain: 'virginatlantic.com', color: '#E10A0A', category: 'transport', keywords: ['virgin atlantic'] },
  
  // === FUEL ===
  { name: 'Shell', domain: 'shell.com', color: '#DD1D21', category: 'transport', keywords: ['shell'] },
  { name: 'BP', domain: 'bp.com', color: '#006F51', category: 'transport', keywords: ['bp', 'british petroleum'] },
  { name: 'Esso', domain: 'esso.com', color: '#CE1126', category: 'transport', keywords: ['esso'] },
  { name: 'Texaco', domain: 'texaco.com', color: '#FF0000', category: 'transport', keywords: ['texaco'] },
  { name: 'Tesco Fuel', domain: 'tesco.com', color: '#005EB8', category: 'transport', keywords: ['tesco petrol', 'tesco fuel'] },
  { name: 'ASDA Fuel', domain: 'asda.com', color: '#7DC242', category: 'transport', keywords: ['asda petrol', 'asda fuel'] },
  
  // === ENTERTAINMENT ===
  { name: 'Netflix', domain: 'netflix.com', color: '#E50914', category: 'entertainment', keywords: ['netflix'] },
  { name: 'Spotify', domain: 'spotify.com', color: '#1DB954', category: 'entertainment', keywords: ['spotify'] },
  { name: 'Disney+', domain: 'disneyplus.com', color: '#113CCF', category: 'entertainment', keywords: ['disney', 'disney+', 'disney plus'] },
  { name: 'Amazon Prime', domain: 'primevideo.com', color: '#00A8E1', category: 'entertainment', keywords: ['amazon prime', 'prime video'] },
  { name: 'Apple TV+', domain: 'apple.com', color: '#000000', category: 'entertainment', keywords: ['apple tv', 'apple tv+'] },
  { name: 'YouTube', domain: 'youtube.com', color: '#FF0000', category: 'entertainment', keywords: ['youtube'] },
  { name: 'Hulu', domain: 'hulu.com', color: '#1CE783', category: 'entertainment', keywords: ['hulu'] },
  { name: 'HBO Max', domain: 'hbomax.com', color: '#B535F6', category: 'entertainment', keywords: ['hbo', 'hbo max'] },
  { name: 'Sky', domain: 'sky.com', color: '#0072C9', category: 'entertainment', keywords: ['sky'] },
  { name: 'NOW TV', domain: 'nowtv.com', color: '#00D7BE', category: 'entertainment', keywords: ['now tv', 'nowtv'] },
  { name: 'BBC iPlayer', domain: 'bbc.co.uk', color: '#000000', category: 'entertainment', keywords: ['bbc', 'iplayer', 'bbc iplayer'] },
  { name: 'ITV Hub', domain: 'itv.com', color: '#F8C300', category: 'entertainment', keywords: ['itv', 'itv hub'] },
  { name: 'Channel 4', domain: 'channel4.com', color: '#1B1B1B', category: 'entertainment', keywords: ['channel 4', 'all 4'] },
  { name: 'Audible', domain: 'audible.com', color: '#F8991C', category: 'entertainment', keywords: ['audible'] },
  { name: 'Steam', domain: 'steampowered.com', color: '#00ADEE', category: 'entertainment', keywords: ['steam'] },
  { name: 'PlayStation', domain: 'playstation.com', color: '#003791', category: 'entertainment', keywords: ['playstation', 'psn'] },
  { name: 'Xbox', domain: 'xbox.com', color: '#107C10', category: 'entertainment', keywords: ['xbox', 'xbox live'] },
  { name: 'Nintendo', domain: 'nintendo.com', color: '#E60012', category: 'entertainment', keywords: ['nintendo'] },
  
  // === FINANCE ===
  { name: 'PayPal', domain: 'paypal.com', color: '#003087', category: 'finance', keywords: ['paypal'] },
  { name: 'Stripe', domain: 'stripe.com', color: '#008CDD', category: 'finance', keywords: ['stripe'] },
  { name: 'Square', domain: 'squareup.com', color: '#3E4348', category: 'finance', keywords: ['square', 'squareup'] },
  { name: 'Venmo', domain: 'venmo.com', color: '#3D95CE', category: 'finance', keywords: ['venmo'] },
  { name: 'Cash App', domain: 'cash.app', color: '#00D632', category: 'finance', keywords: ['cash app', 'cashapp'] },
  { name: 'Revolut', domain: 'revolut.com', color: '#0075EB', category: 'finance', keywords: ['revolut'] },
  { name: 'Monzo', domain: 'monzo.com', color: '#FF3464', category: 'finance', keywords: ['monzo'] },
  { name: 'Starling Bank', domain: 'starlingbank.com', color: '#6935FF', category: 'finance', keywords: ['starling'] },
  
  // === UK BANKS ===
  { name: 'Barclays', domain: 'barclays.com', color: '#00AEEF', category: 'finance', keywords: ['barclays'] },
  { name: 'HSBC', domain: 'hsbc.com', color: '#DB0011', category: 'finance', keywords: ['hsbc'] },
  { name: 'Lloyds', domain: 'lloyds.com', color: '#024731', category: 'finance', keywords: ['lloyds'] },
  { name: 'NatWest', domain: 'natwest.com', color: '#5A287F', category: 'finance', keywords: ['natwest'] },
  { name: 'Santander', domain: 'santander.com', color: '#EC0000', category: 'finance', keywords: ['santander'] },
  { name: 'Halifax', domain: 'halifax.co.uk', color: '#005EB8', category: 'finance', keywords: ['halifax'] },
  { name: 'Nationwide', domain: 'nationwide.co.uk', color: '#1B3A6B', category: 'finance', keywords: ['nationwide'] },
  { name: 'TSB', domain: 'tsb.co.uk', color: '#005EB8', category: 'finance', keywords: ['tsb'] },
  { name: 'Metro Bank', domain: 'metrobankonline.co.uk', color: '#DC2928', category: 'finance', keywords: ['metro bank'] },
  
  // === TECH ===
  { name: 'Apple', domain: 'apple.com', color: '#000000', category: 'tech', keywords: ['apple', 'app store', 'itunes'] },
  { name: 'Google', domain: 'google.com', color: '#4285F4', category: 'tech', keywords: ['google'] },
  { name: 'Microsoft', domain: 'microsoft.com', color: '#0078D4', category: 'tech', keywords: ['microsoft'] },
  { name: 'Adobe', domain: 'adobe.com', color: '#FF0000', category: 'tech', keywords: ['adobe'] },
  { name: 'Dropbox', domain: 'dropbox.com', color: '#0061FF', category: 'tech', keywords: ['dropbox'] },
  { name: 'Slack', domain: 'slack.com', color: '#4A154B', category: 'tech', keywords: ['slack'] },
  { name: 'Zoom', domain: 'zoom.us', color: '#2D8CFF', category: 'tech', keywords: ['zoom'] },
  { name: 'LinkedIn', domain: 'linkedin.com', color: '#0A66C2', category: 'tech', keywords: ['linkedin'] },
  { name: 'GitHub', domain: 'github.com', color: '#181717', category: 'tech', keywords: ['github'] },
  
  // === UTILITIES ===
  { name: 'British Gas', domain: 'britishgas.co.uk', color: '#0396D6', category: 'utilities', keywords: ['british gas'] },
  { name: 'E.ON', domain: 'eonenergy.com', color: '#E2001A', category: 'utilities', keywords: ['eon', 'e.on'] },
  { name: 'EDF Energy', domain: 'edfenergy.com', color: '#0066CC', category: 'utilities', keywords: ['edf', 'edf energy'] },
  { name: 'Thames Water', domain: 'thameswater.co.uk', color: '#0082CA', category: 'utilities', keywords: ['thames water'] },
  { name: 'BT', domain: 'bt.com', color: '#5514B4', category: 'utilities', keywords: ['bt', 'british telecom'] },
  { name: 'Virgin Media', domain: 'virginmedia.com', color: '#ED1A3B', category: 'utilities', keywords: ['virgin media', 'virgin'] },
  { name: 'Sky Broadband', domain: 'sky.com', color: '#0072C9', category: 'utilities', keywords: ['sky broadband', 'sky internet'] },
  { name: 'TalkTalk', domain: 'talktalk.co.uk', color: '#7C2E8C', category: 'utilities', keywords: ['talktalk', 'talk talk'] },
  
  // === MOBILE NETWORKS ===
  { name: 'EE', domain: 'ee.co.uk', color: '#00B5B0', category: 'utilities', keywords: ['ee', 'everything everywhere'] },
  { name: 'O2', domain: 'o2.co.uk', color: '#0019A5', category: 'utilities', keywords: ['o2'] },
  { name: 'Three', domain: 'three.co.uk', color: '#EE2E7B', category: 'utilities', keywords: ['three', '3 mobile'] },
  { name: 'Vodafone', domain: 'vodafone.com', color: '#E60000', category: 'utilities', keywords: ['vodafone'] },
  { name: 'Giffgaff', domain: 'giffgaff.com', color: '#000000', category: 'utilities', keywords: ['giffgaff'] },
  
  // === FITNESS ===
  { name: 'PureGym', domain: 'puregym.com', color: '#E4002B', category: 'other', keywords: ['puregym', 'pure gym'] },
  { name: 'David Lloyd', domain: 'davidlloyd.co.uk', color: '#003DA5', category: 'other', keywords: ['david lloyd'] },
  { name: 'Virgin Active', domain: 'virginactive.co.uk', color: '#ED1A3B', category: 'other', keywords: ['virgin active'] },
  { name: 'The Gym Group', domain: 'thegymgroup.com', color: '#ED1C24', category: 'other', keywords: ['the gym', 'gym group'] },
  { name: 'Anytime Fitness', domain: 'anytimefitness.com', color: '#752F8A', category: 'other', keywords: ['anytime fitness'] },
];

// Generate the TypeScript file
const generateTypeScriptFile = () => {
  const output = `// Auto-generated brand logo database
// Generated on: ${new Date().toISOString()}
// Total brands: ${brands.length}

export interface BrandLogo {
  name: string;
  domain: string;
  icon?: string;
  color: string;
  category: 'retail' | 'food' | 'transport' | 'entertainment' | 'finance' | 'utilities' | 'tech' | 'other';
  keywords: string[];
}

export const brandLogos: BrandLogo[] = ${JSON.stringify(brands, null, 2)};

// Create maps for faster lookups
export const brandLogoByDomain = new Map<string, BrandLogo>(
  brandLogos.map(brand => [brand.domain, brand])
);

export const brandLogoByKeyword = new Map<string, BrandLogo>();
brandLogos.forEach(brand => {
  brand.keywords.forEach(keyword => {
    brandLogoByKeyword.set(keyword.toLowerCase(), brand);
  });
});

// Helper functions
export function getBrandByDomain(domain: string): BrandLogo | undefined {
  return brandLogoByDomain.get(domain);
}

export function getBrandByKeyword(keyword: string): BrandLogo | undefined {
  return brandLogoByKeyword.get(keyword.toLowerCase());
}

export function searchBrands(query: string): BrandLogo[] {
  const lowerQuery = query.toLowerCase();
  return brandLogos.filter(brand => 
    brand.name.toLowerCase().includes(lowerQuery) ||
    brand.domain.includes(lowerQuery) ||
    brand.keywords.some(k => k.includes(lowerQuery))
  );
}

// Get brands by category
export function getBrandsByCategory(category: string): BrandLogo[] {
  return brandLogos.filter(brand => brand.category === category);
}
`;

  const outputPath = path.join(__dirname, '..', 'src', 'data', 'brandDatabase.ts');
  fs.writeFileSync(outputPath, output);
  
  console.log(`✅ Generated brand database with ${brands.length} brands`);
  console.log(`📁 Output: ${outputPath}`);
  
  // Generate stats
  const stats = brands.reduce((acc, brand) => {
    acc[brand.category] = (acc[brand.category] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📊 Brand statistics:');
  Object.entries(stats).forEach(([category, count]) => {
    console.log(`   ${category}: ${count}`);
  });
};

generateTypeScriptFile();