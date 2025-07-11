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
  const dataView = new DataView(arrayBuffer);
  const transactions: ParsedTransaction[] = [];
  const accountsMap = new Map<string, ParsedAccount>();
  
  console.log('Parsing Microsoft Money .mny file, size:', arrayBuffer.byteLength);
  
  // Limit processing for very large files
  const MAX_SIZE = 100 * 1024 * 1024; // 100MB limit
  const processLength = Math.min(arrayBuffer.byteLength, MAX_SIZE);
  
  try {
    // Check for Jet database signature
    const signature = Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log('File signature:', signature);
    
    // Helper to read strings at various encodings
    const readString = (offset: number, maxLength: number = 255): string => {
      let str = '';
      for (let i = 0; i < maxLength && offset + i < uint8Array.length; i++) {
        const byte = uint8Array[offset + i];
        if (byte === 0) break;
        if (byte >= 32 && byte <= 126) {
          str += String.fromCharCode(byte);
        }
      }
      return str.trim();
    };

    // Helper to read UTF-16 LE strings
    const readUTF16String = (offset: number, maxLength: number = 255): string => {
      let str = '';
      for (let i = 0; i < maxLength && offset + i * 2 + 1 < uint8Array.length; i++) {
        const charCode = uint8Array[offset + i * 2] | (uint8Array[offset + i * 2 + 1] << 8);
        if (charCode === 0) break;
        if (charCode >= 32 && charCode < 65536) {
          str += String.fromCharCode(charCode);
        }
      }
      return str.trim();
    };

    // Strategy 1: Look for account names in common patterns
    console.log('Searching for accounts...');
    const accountKeywords = [
      'checking', 'savings', 'credit', 'visa', 'mastercard', 'amex',
      'current', 'deposit', 'loan', 'mortgage', 'investment', 'brokerage',
      'hsbc', 'barclays', 'lloyds', 'natwest', 'santander', 'halifax'
    ];
    
    const foundAccounts = new Set<string>();
    
    // Scan for potential account names
    for (let i = 0; i < processLength - 100; i += 100) {
      // Try both ASCII and UTF-16
      const asciiStr = readString(i, 100).toLowerCase();
      const utf16Str = readUTF16String(i, 50).toLowerCase();
      
      // Check for account keywords
      for (const keyword of accountKeywords) {
        if (asciiStr.includes(keyword) || utf16Str.includes(keyword)) {
          // Found keyword, try to extract account name
          const contextAscii = readString(i - 50, 150);
          const contextUTF16 = readUTF16String(i - 25, 75);
          
          // Look for account-like strings
          const patterns = [
            /([A-Z][A-Za-z\s]+(?:Account|Bank|Card|Visa|MasterCard|Amex)[\s\w]*)/g,
            /([A-Z][A-Za-z\s]+\s+\d{4})/g, // Like "HSBC 1234"
            /((?:Checking|Savings|Credit|Current)\s+[A-Za-z0-9\s]+)/gi
          ];
          
          for (const pattern of patterns) {
            const asciiMatches = contextAscii.match(pattern);
            const utf16Matches = contextUTF16.match(pattern);
            
            if (asciiMatches) {
              asciiMatches.forEach(match => {
                if (match.length > 3 && match.length < 50) {
                  foundAccounts.add(match);
                }
              });
            }
            
            if (utf16Matches) {
              utf16Matches.forEach(match => {
                if (match.length > 3 && match.length < 50) {
                  foundAccounts.add(match);
                }
              });
            }
          }
        }
      }
      
      // Progress indicator
      if (i % 1000000 === 0 && i > 0) {
        console.log(`Scanned ${(i / 1000000).toFixed(1)}MB...`);
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield to prevent hanging
      }
    }
    
    // Add found accounts
    foundAccounts.forEach(accountName => {
      const cleanName = accountName.trim();
      if (!accountsMap.has(cleanName)) {
        // Determine account type
        const lowerName = cleanName.toLowerCase();
        let type: ParsedAccount['type'] = 'checking';
        
        if (lowerName.includes('credit') || lowerName.includes('visa') || lowerName.includes('mastercard')) {
          type = 'credit';
        } else if (lowerName.includes('saving') || lowerName.includes('deposit')) {
          type = 'savings';
        } else if (lowerName.includes('loan') || lowerName.includes('mortgage')) {
          type = 'loan';
        } else if (lowerName.includes('invest') || lowerName.includes('broker')) {
          type = 'investment';
        }
        
        accountsMap.set(cleanName, {
          name: cleanName,
          type: type,
          balance: 0
        });
        console.log('Found account:', cleanName);
      }
    });

    // Strategy 2: Look for transaction patterns
    console.log('Searching for transactions...');
    const transactionPatterns = [
      // OLE date followed by amount pattern
      { dateOffset: 0, amountOffset: 8, descOffset: 16 },
      { dateOffset: 0, amountOffset: 12, descOffset: 20 },
      { dateOffset: 0, amountOffset: 4, descOffset: 12 },
    ];
    
    let transactionCount = 0;
    const maxTransactions = 10000; // Limit to prevent excessive processing
    
    // Look for date patterns
    for (let i = 0; i < processLength - 100 && transactionCount < maxTransactions; i++) {
      // Check for potential date values
      // OLE Automation date (days since 1899-12-30)
      const oleDate = dataView.getFloat64(i, true);
      
      // Check if it's a reasonable date (between 1990 and 2030)
      if (oleDate > 32874 && oleDate < 51000) {
        const jsDate = new Date((oleDate - 25569) * 86400 * 1000);
        
        if (jsDate.getFullYear() >= 1990 && jsDate.getFullYear() <= 2030) {
          // Found potential date, look for amount nearby
          for (const pattern of transactionPatterns) {
            if (i + pattern.amountOffset + 8 > processLength) continue;
            
            // Try reading amount as double
            const amount = dataView.getFloat64(i + pattern.amountOffset, true);
            
            // Check if it's a reasonable amount
            if (Math.abs(amount) > 0.01 && Math.abs(amount) < 1000000) {
              // Look for description
              let description = '';
              
              // Try ASCII first
              description = readString(i + pattern.descOffset, 100);
              if (!description || description.length < 3) {
                // Try UTF-16
                description = readUTF16String(i + pattern.descOffset, 50);
              }
              
              if (description && description.length >= 3) {
                transactions.push({
                  date: jsDate,
                  amount: Math.abs(amount),
                  description: description.substring(0, 100),
                  type: amount < 0 ? 'expense' : 'income',
                  category: 'Imported'
                });
                transactionCount++;
                
                if (transactionCount % 100 === 0) {
                  console.log(`Found ${transactionCount} transactions...`);
                }
                
                i += 50; // Skip ahead to avoid duplicates
                break;
              }
            }
          }
        }
      }
    }

    // Strategy 3: Look for specific Money data structures
    // Money uses specific record types for accounts and transactions
    const recordMarkers = [
      { marker: [0x41, 0x43, 0x43, 0x54], type: 'account' }, // ACCT
      { marker: [0x54, 0x52, 0x4E, 0x53], type: 'transaction' }, // TRNS
      { marker: [0x50, 0x41, 0x59, 0x45], type: 'payee' }, // PAYE
    ];
    
    for (const { marker, type } of recordMarkers) {
      let offset = 0;
      while (offset < processLength - 1000) {
        // Find marker
        let found = -1;
        for (let i = offset; i < processLength - marker.length; i++) {
          let match = true;
          for (let j = 0; j < marker.length; j++) {
            if (uint8Array[i + j] !== marker[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            found = i;
            break;
          }
        }
        
        if (found === -1) break;
        offset = found + marker.length;
        
        if (type === 'account') {
          // Try to extract account info
          const name = readString(offset + 4, 50) || readUTF16String(offset + 4, 25);
          if (name && name.length > 2 && name.length < 50) {
            if (!accountsMap.has(name)) {
              accountsMap.set(name, {
                name: name,
                type: 'checking',
                balance: 0
              });
              console.log('Found account from ACCT marker:', name);
            }
          }
        }
        
        offset += 100;
      }
    }

    // If we found very few accounts, add some generic ones
    if (accountsMap.size === 0) {
      console.log('No accounts found, creating default account');
      accountsMap.set('Primary Account', {
        name: 'Primary Account',
        type: 'checking',
        balance: 0
      });
    }
    
    // Calculate approximate balances
    if (transactions.length > 0) {
      const primaryAccount = Array.from(accountsMap.values())[0];
      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      primaryAccount.balance = totalIncome - totalExpenses;
    }

    // Remove duplicate transactions
    const uniqueTransactions = transactions.filter((trans, index, self) =>
      index === self.findIndex((t) => (
        Math.abs(t.date.getTime() - trans.date.getTime()) < 86400000 && // Same day
        Math.abs(t.amount - trans.amount) < 0.01 &&
        t.description === trans.description
      ))
    );

    // Sort by date
    uniqueTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    console.log(`Parsed ${accountsMap.size} accounts and ${uniqueTransactions.length} unique transactions`);
    
    const result: ParseResult = {
      accounts: Array.from(accountsMap.values()),
      transactions: uniqueTransactions
    };
    
    // Only add warning if we found very little data
    if (accountsMap.size <= 1 && uniqueTransactions.length < 10) {
      result.warning = 'Limited data found. Money .mny files are complex database files. For best results, please use File → Export → QIF format from within Microsoft Money.';
    }
    
    return result;
    
  } catch (error) {
    console.error('Error parsing .mny file:', error);
    throw new Error('Failed to parse Microsoft Money file. The file may be encrypted or in an unsupported version.');
  }
}
