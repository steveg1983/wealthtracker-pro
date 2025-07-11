// Enhanced Microsoft Money MBF file parser
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

export async function parseMBF(arrayBuffer: ArrayBuffer): Promise<{
  accounts: ParsedAccount[];
  transactions: ParsedTransaction[];
}> {
  const dataView = new DataView(arrayBuffer);
  const uint8Array = new Uint8Array(arrayBuffer);
  const transactions: ParsedTransaction[] = [];
  const accountsMap = new Map<string, ParsedAccount>();
  
  console.log('MBF file size:', arrayBuffer.byteLength);
  
  try {
    // Helper function to read null-terminated string
    const readString = (offset: number, maxLength: number = 255): string => {
      let str = '';
      for (let i = 0; i < maxLength && offset + i < uint8Array.length; i++) {
        const byte = uint8Array[offset + i];
        if (byte === 0) break;
        if (byte >= 32 && byte <= 126) {
          str += String.fromCharCode(byte);
        }
      }
      return str;
    };

    // Helper to find patterns in binary data
    const findPattern = (pattern: number[], startOffset: number = 0): number => {
      for (let i = startOffset; i < uint8Array.length - pattern.length; i++) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
          if (uint8Array[i + j] !== pattern[j]) {
            match = false;
            break;
          }
        }
        if (match) return i;
      }
      return -1;
    };

    // Look for account sections - Money uses specific markers
    // Common patterns for account data
    const accountMarkers = [
      [0x41, 0x43, 0x43, 0x54], // ACCT
      [0x41, 0x63, 0x63, 0x6F, 0x75, 0x6E, 0x74], // Account
      [0x4E, 0x41, 0x4D, 0x45], // NAME
    ];

    // Search for accounts using multiple strategies
    for (const marker of accountMarkers) {
      let offset = 0;
      while (offset < uint8Array.length) {
        offset = findPattern(marker, offset);
        if (offset === -1) break;
        
        // Try to read account data after marker
        offset += marker.length;
        
        // Skip any null bytes or spacing
        while (offset < uint8Array.length && uint8Array[offset] < 32) offset++;
        
        const accountName = readString(offset);
        if (accountName && accountName.length > 2 && accountName.length < 100) {
          // Determine account type from name or nearby data
          const lowerName = accountName.toLowerCase();
          const type = lowerName.includes('credit') || lowerName.includes('card') ? 'credit' :
                      lowerName.includes('saving') ? 'savings' :
                      lowerName.includes('loan') || lowerName.includes('mortgage') ? 'loan' :
                      lowerName.includes('invest') || lowerName.includes('stock') ? 'investment' :
                      'checking';
          
          if (!accountsMap.has(accountName)) {
            accountsMap.set(accountName, {
              name: accountName,
              type: type,
              balance: 0
            });
            console.log('Found account:', accountName);
          }
        }
        
        offset += 100; // Move forward to find next account
      }
    }

    // Look for transaction data
    // Money stores transactions with specific patterns
    
    // Strategy 1: Look for date patterns (Money uses OLE Automation dates)
    // OLE date is days since December 30, 1899
    const oleBaseDate = new Date(1899, 11, 30);
    
    for (let i = 0; i < arrayBuffer.byteLength - 8; i += 4) {
      // Try reading as double (8 bytes) - OLE date format
      const oleDate = dataView.getFloat64(i, true);
      
      // Check if it's a valid date (between 1990 and 2030)
      if (oleDate > 32874 && oleDate < 51000) {
        const transDate = new Date(oleBaseDate.getTime() + oleDate * 24 * 60 * 60 * 1000);
        
        // Look for amount nearby (usually within 32 bytes)
        for (let j = 8; j <= 32 && i + j + 8 < arrayBuffer.byteLength; j += 4) {
          const possibleAmount = dataView.getFloat64(i + j, true);
          
          // Check if it's a reasonable amount
          if (Math.abs(possibleAmount) > 0.01 && Math.abs(possibleAmount) < 1000000) {
            // Look for description
            let description = '';
            let descOffset = i + j + 8;
            
            // Try to find text after the amount
            while (descOffset < i + 200 && descOffset < uint8Array.length) {
              const str = readString(descOffset);
              if (str && str.length > 2) {
                description = str;
                break;
              }
              descOffset++;
            }
            
            if (description) {
              transactions.push({
                date: transDate,
                amount: Math.abs(possibleAmount),
                description: description,
                type: possibleAmount < 0 ? 'expense' : 'income',
                category: 'Imported'
              });
              
              i = descOffset; // Skip past this transaction
              break;
            }
          }
        }
      }
    }

    // Strategy 2: Look for transaction markers
    const transMarkers = [
      [0x54, 0x52, 0x4E, 0x53], // TRNS
      [0x54, 0x52, 0x41, 0x4E], // TRAN
      [0x50, 0x41, 0x59, 0x45], // PAYE (payee)
    ];

    for (const marker of transMarkers) {
      let offset = 0;
      while (offset < uint8Array.length - 100) {
        offset = findPattern(marker, offset);
        if (offset === -1) break;
        
        offset += marker.length;
        
        // Try to parse transaction data
        // Look for structured data after marker
        let foundTrans = false;
        
        // Check different offset patterns Money might use
        for (let skip = 0; skip < 20; skip += 4) {
          if (offset + skip + 16 > uint8Array.length) continue;
          
          // Try reading date as 4-byte integer (days since 1900)
          const days = dataView.getInt32(offset + skip, true);
          if (days > 32874 && days < 51000) {
            const date = new Date(1900, 0, 1);
            date.setDate(date.getDate() + days);
            
            // Try reading amount (could be 4 or 8 bytes)
            const amount4 = dataView.getInt32(offset + skip + 4, true) / 100; // cents to dollars
            const amount8 = dataView.getFloat64(offset + skip + 4, true);
            
            const amount = Math.abs(amount4) < 1000000 ? amount4 : amount8;
            
            if (Math.abs(amount) > 0.01 && Math.abs(amount) < 1000000) {
              // Look for description
              const description = readString(offset + skip + 12, 100);
              
              if (description && description.length > 0) {
                transactions.push({
                  date: date,
                  amount: Math.abs(amount),
                  description: description,
                  type: amount < 0 ? 'expense' : 'income',
                  category: 'Imported'
                });
                foundTrans = true;
                console.log('Found transaction:', description, amount);
                break;
              }
            }
          }
        }
        
        offset += foundTrans ? 100 : 10;
      }
    }

    // If no accounts found, look for them differently
    if (accountsMap.size === 0) {
      console.log('No accounts found with markers, trying text search...');
      
      // Convert parts of file to text and look for account-like strings
      let textContent = '';
      for (let i = 0; i < Math.min(uint8Array.length, 50000); i++) {
        if (uint8Array[i] >= 32 && uint8Array[i] <= 126) {
          textContent += String.fromCharCode(uint8Array[i]);
        } else {
          textContent += '\n';
        }
      }
      
      // Look for common account name patterns
      const accountPatterns = [
        /(?:Checking|Current|Chequing)\s*(?:Account)?\s*([^\n]{0,30})/gi,
        /(?:Savings|Deposit)\s*(?:Account)?\s*([^\n]{0,30})/gi,
        /(?:Credit\s*Card|Visa|MasterCard|Amex)\s*([^\n]{0,30})/gi,
        /(?:Loan|Mortgage)\s*([^\n]{0,30})/gi,
        /Account\s*(?:Name|:)\s*([^\n]{2,50})/gi,
      ];
      
      for (const pattern of accountPatterns) {
        let match;
        while ((match = pattern.exec(textContent)) !== null) {
          const accountName = match[1] ? match[0] + ' ' + match[1] : match[0];
          const cleanName = accountName.trim().replace(/[^\w\s-]/g, '').substring(0, 50);
          
          if (cleanName.length > 2) {
            const type = match[0].toLowerCase().includes('credit') ? 'credit' :
                        match[0].toLowerCase().includes('sav') ? 'savings' :
                        match[0].toLowerCase().includes('loan') || match[0].toLowerCase().includes('mortgage') ? 'loan' :
                        'checking';
            
            accountsMap.set(cleanName, {
              name: cleanName,
              type: type,
              balance: 0
            });
          }
        }
      }
    }

    // If still no accounts, create a default
    if (accountsMap.size === 0) {
      accountsMap.set('Microsoft Money Import', {
        name: 'Microsoft Money Import',
        type: 'checking',
        balance: 0
      });
    }

    console.log(`Parsed ${accountsMap.size} accounts and ${transactions.length} transactions`);
    
    // Sort transactions by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Calculate approximate balances
    const accounts = Array.from(accountsMap.values());
    if (accounts.length > 0 && transactions.length > 0) {
      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Distribute balance across accounts
      const netBalance = totalIncome - totalExpenses;
      accounts[0].balance = netBalance;
    }
    
    return {
      accounts: accounts,
      transactions: transactions
    };
    
  } catch (error) {
    console.error('Error parsing MBF file:', error);
    throw new Error('Failed to parse Microsoft Money file. The file may be encrypted or in an unsupported format.');
  }
}
