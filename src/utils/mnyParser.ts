// Microsoft Money .mny file parser
// .mny files are the active database files used by Microsoft Money

export interface ParsedAccount {
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment';
  balance: number;
  accountNumber?: string;
}

export interface ParsedTransaction {
  date: Date;
  amount: number;
  description: string;
  type: 'income' | 'expense';
  category: string;
  payee?: string;
  accountName?: string;
}

export interface ParseResult {
  accounts: ParsedAccount[];
  transactions: ParsedTransaction[];
  warning?: string;
}

export async function parseMNY(arrayBuffer: ArrayBuffer): Promise<ParseResult> {
  const uint8Array = new Uint8Array(arrayBuffer);
  const transactions: ParsedTransaction[] = [];
  const accountsMap = new Map<string, ParsedAccount>();
  
  console.log('Parsing Microsoft Money .mny file, size:', arrayBuffer.byteLength);
  
  // Limit processing for very large files
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB limit
  if (arrayBuffer.byteLength > MAX_SIZE) {
    console.warn('File too large, processing first 50MB only');
  }
  
  const processLength = Math.min(arrayBuffer.byteLength, MAX_SIZE);
  
  try {
    // Check for Jet database signature
    const signature = Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log('File signature:', signature);
    
    // Check if this might be an encrypted file
    const isLikelyEncrypted = uint8Array.slice(0, 100).every(b => b < 32 || b > 126);
    if (isLikelyEncrypted) {
      throw new Error('This Money file appears to be password protected. Please remove the password in Microsoft Money before importing.');
    }
    
    // For now, return a simple result to prevent hanging
    // Money .mny files are complex Jet databases that would require a full parser
    console.log('Money .mny files are complex database files.');
    console.log('For best results, please export your data as QIF from within Microsoft Money.');
    
    // Create a default account
    accountsMap.set('Money Import', {
      name: 'Money Import (Please use QIF export instead)',
      type: 'checking',
      balance: 0
    });
    
    // Try to extract any visible text that might be account names or transactions
    const textChunks: string[] = [];
    let currentChunk = '';
    
    // Scan first 10MB max for text
    const scanLength = Math.min(processLength, 10 * 1024 * 1024);
    
    for (let i = 0; i < scanLength; i++) {
      const byte = uint8Array[i];
      if (byte >= 32 && byte <= 126) {
        currentChunk += String.fromCharCode(byte);
      } else {
        if (currentChunk.length > 5) {
          textChunks.push(currentChunk);
        }
        currentChunk = '';
      }
      
      // Process in chunks to prevent hanging
      if (i % 100000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    console.log(`Found ${textChunks.length} text chunks`);
    
    // Look for potential account names
    const accountPatterns = [
      /checking/i,
      /savings/i,
      /credit\s*card/i,
      /visa/i,
      /mastercard/i,
      /amex/i
    ];
    
    for (const chunk of textChunks.slice(0, 100)) { // Limit to first 100 chunks
      for (const pattern of accountPatterns) {
        if (pattern.test(chunk)) {
          const cleanName = chunk.substring(0, 50).trim();
          if (cleanName.length > 3 && !accountsMap.has(cleanName)) {
            accountsMap.set(cleanName, {
              name: cleanName,
              type: 'checking',
              balance: 0
            });
            console.log('Possible account found:', cleanName);
          }
          break;
        }
      }
    }
    
    // If we found some accounts, remove the default one
    if (accountsMap.size > 1) {
      accountsMap.delete('Money Import (Please use QIF export instead)');
    }
    
    console.log(`Parsed ${accountsMap.size} accounts`);
    
    return {
      accounts: Array.from(accountsMap.values()),
      transactions: transactions,
      warning: 'Money .mny files are complex database files. For best results, please use File → Export → QIF format from within Microsoft Money.'
    };
    
  } catch (error) {
    console.error('Error parsing .mny file:', error);
    throw error;
  }
}
