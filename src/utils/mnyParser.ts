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
  const accountsFromTransactions = new Map<string, Set<string>>();
  
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

    // Helper to clean account names
    const cleanAccountName = (name: string): string => {
      // Remove common prefixes/suffixes
      return name
        .replace(/^(Account|Acct)\s+/i, '')
        .replace(/\s+(Account|Acct)$/i, '')
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
        .trim();
    };

    // Strategy 1: Look for account patterns in the file
    console.log('Strategy 1: Searching for account patterns...');
    
    // Common account name patterns in Money files
    const accountPatterns = [
      // Look for account-like structures
      /([A-Z][A-Za-z\s&]+(?:Bank|Building Society|Credit Union|Account|Checking|Savings|Current|Deposit|Visa|MasterCard|Amex|Card)[\s\w]*)/g,
      // UK bank patterns
      /((?:HSBC|Barclays|Lloyds|NatWest|Santander|Halifax|Nationwide|TSB|RBS|Co-op|Metro Bank|First Direct|Monzo|Starling|Revolut)[\s\w]*(?:Account|Card)?[\s\w]*)/gi,
      // Account number patterns
      /([A-Z][A-Za-z\s]+\s+(?:\*{4}|\d{4}|\w{4}))/g,
      // Generic account patterns
      /((?:Personal|Joint|Business|Main|Secondary|Primary)\s+(?:Account|Checking|Savings|Current)[\s\w]*)/gi,
      // Investment accounts
      /((?:Investment|Brokerage|Trading|ISA|SIPP|Pension|401k|IRA|Stock|Share)[\s\w]*(?:Account)?)/gi,
      // Loan accounts
      /((?:Mortgage|Loan|Credit|Line of Credit|Overdraft)[\s\w]*(?:Account)?)/gi
    ];
    
    // Scan through the file looking for account names
    const foundAccountNames = new Set<string>();
    const chunkSize = 1024 * 1024; // 1MB chunks
    
    for (let offset = 0; offset < processLength; offset += chunkSize) {
      const endOffset = Math.min(offset + chunkSize + 1000, processLength); // Overlap to catch split names
      
      // Read chunk as both ASCII and UTF-16
      let asciiChunk = '';
      let utf16Chunk = '';
      
      for (let i = offset; i < endOffset && i < processLength - 1; i++) {
        // ASCII
        const byte = uint8Array[i];
        if (byte >= 32 && byte <= 126) {
          asciiChunk += String.fromCharCode(byte);
        } else {
          asciiChunk += ' ';
        }
        
        // UTF-16 (every other byte)
        if (i % 2 === 0 && i + 1 < processLength) {
          const charCode = uint8Array[i] | (uint8Array[i + 1] << 8);
          if (charCode >= 32 && charCode < 65536) {
            utf16Chunk += String.fromCharCode(charCode);
          } else {
            utf16Chunk += ' ';
          }
        }
      }
      
      // Search for patterns in both encodings
      for (const pattern of accountPatterns) {
        const asciiMatches = asciiChunk.match(pattern) || [];
        const utf16Matches = utf16Chunk.match(pattern) || [];
        
        [...asciiMatches, ...utf16Matches].forEach(match => {
          const cleaned = cleanAccountName(match);
          if (cleaned.length > 3 && cleaned.length < 60 && !cleaned.match(/^\d+$/)) {
            foundAccountNames.add(cleaned);
          }
        });
      }
      
      // Progress
      if (offset % (10 * 1024 * 1024) === 0 && offset > 0) {
        console.log(`Scanned ${(offset / (1024 * 1024)).toFixed(1)}MB for accounts...`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    console.log(`Found ${foundAccountNames.size} potential account names`);
    
    // Add found accounts
    foundAccountNames.forEach(accountName => {
      if (!accountsMap.has(accountName)) {
        // Determine account type
        const lowerName = accountName.toLowerCase();
        let type: ParsedAccount['type'] = 'checking';
        
        if (lowerName.match(/credit|visa|mastercard|amex/)) {
          type = 'credit';
        } else if (lowerName.match(/saving|deposit|isa/)) {
          type = 'savings';
        } else if (lowerName.match(/loan|mortgage|overdraft/)) {
          type = 'loan';
        } else if (lowerName.match(/invest|broker|trading|stock|share|pension|401k|ira|sipp/)) {
          type = 'investment';
        } else if (lowerName.match(/current|checking/)) {
          type = 'checking';
        }
        
        accountsMap.set(accountName, {
          name: accountName,
          type: type,
          balance: 0
        });
      }
    });

    // Strategy 2: Look for transactions and extract account info from them
    console.log('Strategy 2: Searching for transactions...');
    
    let transactionCount = 0;
    const maxTransactions = 50000; // Increased limit
    const transactionsByAccount = new Map<string, number>();
    
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
          for (let amountOffset = 4; amountOffset <= 24; amountOffset += 4) {
            if (i + amountOffset + 8 > processLength) continue;
            
            // Try reading amount as double
            const amount = dataView.getFloat64(i + amountOffset, true);
            
            // Check if it's a reasonable amount
            if (Math.abs(amount) > 0.01 && Math.abs(amount) < 1000000) {
              // Look for description and account info
              let description = '';
              let accountRef = '';
              
              // Try multiple offsets for description
              for (let descOffset = amountOffset + 8; descOffset < amountOffset + 200; descOffset += 4) {
                if (i + descOffset >= processLength) break;
                
                const str = readString(i + descOffset, 100);
                const utf16Str = readUTF16String(i + descOffset, 50);
                
                if (str && str.length >= 3) {
                  description = str;
                  // Look for account reference after description
                  accountRef = readString(i + descOffset + str.length + 1, 50) ||
                              readUTF16String(i + descOffset + str.length + 1, 25);
                  break;
                } else if (utf16Str && utf16Str.length >= 3) {
                  description = utf16Str;
                  accountRef = readUTF16String(i + descOffset + utf16Str.length * 2 + 2, 25);
                  break;
                }
              }
              
              if (description) {
                // Try to extract account from description or account reference
                let accountName = 'Primary Account';
                
                // Check if account reference looks like an account name
                if (accountRef && accountRef.length > 2 && accountRef.length < 50) {
                  const cleaned = cleanAccountName(accountRef);
                  if (cleaned.length > 2) {
                    accountName = cleaned;
                  }
                }
                
                // Track accounts found in transactions
                if (!transactionsByAccount.has(accountName)) {
                  transactionsByAccount.set(accountName, 0);
                }
                transactionsByAccount.set(accountName, transactionsByAccount.get(accountName)! + 1);
                
                transactions.push({
                  date: jsDate,
                  amount: Math.abs(amount),
                  description: description.substring(0, 100),
                  type: amount < 0 ? 'expense' : 'income',
                  category: 'Imported',
                  accountName: accountName
                });
                transactionCount++;
                
                if (transactionCount % 1000 === 0) {
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

    // Strategy 3: If we found transactions with account names, add those accounts
    console.log('Strategy 3: Extracting accounts from transactions...');
    
    transactionsByAccount.forEach((count, accountName) => {
      if (!accountsMap.has(accountName) && count > 5) { // Only add if more than 5 transactions
        console.log(`Found account from transactions: ${accountName} (${count} transactions)`);
        accountsMap.set(accountName, {
          name: accountName,
          type: 'checking', // Default type
          balance: 0
        });
      }
    });

    // Strategy 4: Look for specific Money database table markers
    console.log('Strategy 4: Looking for Money database structures...');
    
    // Money stores data in tables with specific markers
    const tableMarkers = [
      { pattern: 'KONTO', encoding: 'utf16' }, // Account in some languages
      { pattern: 'ACCOUNT', encoding: 'both' },
      { pattern: 'AccountName', encoding: 'both' },
      { pattern: 'AcctName', encoding: 'both' },
      { pattern: 'BankName', encoding: 'both' },
    ];
    
    for (const marker of tableMarkers) {
      const markerBytes = Array.from(marker.pattern).map(c => c.charCodeAt(0));
      
      for (let i = 0; i < processLength - 500; i++) {
        let found = false;
        
        // Check ASCII
        if (marker.encoding === 'both' || marker.encoding === 'ascii') {
          found = markerBytes.every((byte, idx) => uint8Array[i + idx] === byte);
        }
        
        // Check UTF-16
        if (!found && (marker.encoding === 'both' || marker.encoding === 'utf16')) {
          found = markerBytes.every((byte, idx) => 
            uint8Array[i + idx * 2] === byte && uint8Array[i + idx * 2 + 1] === 0
          );
        }
        
        if (found) {
          // Found marker, look for account names nearby
          for (let offset = markerBytes.length; offset < 200; offset += 2) {
            const name = readString(i + offset, 50) || readUTF16String(i + offset, 25);
            if (name && name.length > 2 && name.length < 50) {
              const cleaned = cleanAccountName(name);
              if (cleaned.length > 2 && !accountsMap.has(cleaned)) {
                accountsMap.set(cleaned, {
                  name: cleaned,
                  type: 'checking',
                  balance: 0
                });
                console.log(`Found account from marker ${marker.pattern}: ${cleaned}`);
              }
            }
          }
        }
      }
    }

    // If we still have only one account but many transactions, something's wrong
    if (accountsMap.size <= 1 && transactions.length > 100) {
      console.log('Warning: Found many transactions but few accounts. The accounts might be encoded differently.');
      
      // Try to infer accounts from transaction patterns
      const payeeAccounts = new Map<string, number>();
      
      transactions.forEach(t => {
        // Look for "Transfer to/from" patterns
        const transferMatch = t.description.match(/Transfer (?:to|from) ([^,;]+)/i);
        if (transferMatch) {
          const accountName = cleanAccountName(transferMatch[1]);
          if (accountName.length > 2 && accountName.length < 50) {
            payeeAccounts.set(accountName, (payeeAccounts.get(accountName) || 0) + 1);
          }
        }
      });
      
      // Add accounts that appear in multiple transfers
      payeeAccounts.forEach((count, name) => {
        if (count > 3 && !accountsMap.has(name)) {
          accountsMap.set(name, {
            name: name,
            type: 'checking',
            balance: 0
          });
          console.log(`Inferred account from transfers: ${name}`);
        }
      });
    }

    // Calculate balances for each account
    const accountBalances = new Map<string, { income: number; expenses: number }>();
    
    transactions.forEach(t => {
      const accountName = t.accountName || Array.from(accountsMap.keys())[0] || 'Primary Account';
      
      if (!accountBalances.has(accountName)) {
        accountBalances.set(accountName, { income: 0, expenses: 0 });
      }
      
      const balance = accountBalances.get(accountName)!;
      if (t.type === 'income') {
        balance.income += t.amount;
      } else {
        balance.expenses += t.amount;
      }
    });
    
    // Update account balances
    accountBalances.forEach((balance, accountName) => {
      const account = accountsMap.get(accountName);
      if (account) {
        account.balance = balance.income - balance.expenses;
      }
    });

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

    console.log(`Final result: ${accountsMap.size} accounts and ${uniqueTransactions.length} unique transactions`);
    
    // Log account details
    accountsMap.forEach((account, name) => {
      const txCount = uniqueTransactions.filter(t => t.accountName === name).length;
      console.log(`Account: ${name} (${account.type}) - ${txCount} transactions`);
    });
    
    const result: ParseResult = {
      accounts: Array.from(accountsMap.values()),
      transactions: uniqueTransactions
    };
    
    // Only add warning if we found very few accounts relative to transactions
    if (accountsMap.size <= 2 && uniqueTransactions.length > 1000) {
      result.warning = 'Found many transactions but few accounts. Some accounts might not have been detected. For best results, please use File → Export → QIF format from within Microsoft Money.';
    }
    
    return result;
    
  } catch (error) {
    console.error('Error parsing .mny file:', error);
    throw new Error('Failed to parse Microsoft Money file. The file may be encrypted or in an unsupported version.');
  }
}
