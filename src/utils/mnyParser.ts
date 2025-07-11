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

export async function parseMNY(arrayBuffer: ArrayBuffer): Promise<{
  accounts: ParsedAccount[];
  transactions: ParsedTransaction[];
}> {
  const dataView = new DataView(arrayBuffer);
  const uint8Array = new Uint8Array(arrayBuffer);
  const transactions: ParsedTransaction[] = [];
  const accountsMap = new Map<string, ParsedAccount>();
  
  console.log('Parsing Microsoft Money .mny file, size:', arrayBuffer.byteLength);
  
  try {
    // .mny files are actually Microsoft Jet database files (Access format)
    // They typically start with specific headers
    
    // Check for Jet database signature
    const signature = Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log('File signature:', signature);
    
    // Helper to read null-terminated strings
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

    // Helper to read Unicode strings (UTF-16 LE)
    const readUnicodeString = (offset: number, maxLength: number = 255): string => {
      let str = '';
      for (let i = 0; i < maxLength && offset + i * 2 + 1 < uint8Array.length; i++) {
        const charCode = uint8Array[offset + i * 2] | (uint8Array[offset + i * 2 + 1] << 8);
        if (charCode === 0) break;
        str += String.fromCharCode(charCode);
      }
      return str;
    };

    // Look for table definitions in Jet database
    // Money stores data in tables like ACCT (accounts), TRNS (transactions), etc.
    
    // Search for ACCT table pattern
    const acctPatterns = [
      'ACCT',
      'Account',
      'tblAccount',
      'AccountTable'
    ];
    
    for (const pattern of acctPatterns) {
      const patternBytes = Array.from(pattern).map(c => c.charCodeAt(0));
      
      for (let i = 0; i < uint8Array.length - pattern.length - 200; i++) {
        let found = true;
        for (let j = 0; j < patternBytes.length; j++) {
          if (uint8Array[i + j] !== patternBytes[j]) {
            found = false;
            break;
          }
        }
        
        if (found) {
          console.log(`Found ${pattern} at offset ${i}`);
          
          // Look for account data near this pattern
          for (let offset = i + pattern.length; offset < i + 1000 && offset < uint8Array.length - 100; offset++) {
            // Try to read account name
            const accountName = readString(offset) || readUnicodeString(offset);
            
            if (accountName && accountName.length > 2 && accountName.length < 50 && 
                !accountName.includes('ACCT') && !accountName.includes('\\')) {
              
              // Look for account type indicators
              let accountType: ParsedAccount['type'] = 'checking';
              const nearbyText = readString(offset - 50, 200).toLowerCase() + 
                               readString(offset + 50, 200).toLowerCase();
              
              if (nearbyText.includes('credit') || nearbyText.includes('card')) {
                accountType = 'credit';
              } else if (nearbyText.includes('saving')) {
                accountType = 'savings';
              } else if (nearbyText.includes('loan') || nearbyText.includes('mortgage')) {
                accountType = 'loan';
              } else if (nearbyText.includes('invest') || nearbyText.includes('brokerage')) {
                accountType = 'investment';
              }
              
              if (!accountsMap.has(accountName)) {
                accountsMap.set(accountName, {
                  name: accountName,
                  type: accountType,
                  balance: 0
                });
                console.log('Found account:', accountName, 'Type:', accountType);
              }
            }
          }
        }
      }
    }

    // Search for transaction patterns
    
    // Also look for common transaction fields
    
    // Money uses various date formats
    const parseMoneyDate = (arrayBuffer: ArrayBuffer, offset: number): Date | null => {
      // Try different date formats
      
      // Format 1: Days since 1900 (4 bytes)
      const days1900 = dataView.getInt32(offset, true);
      if (days1900 > 20000 && days1900 < 60000) {
        const date = new Date(1900, 0, 1);
        date.setDate(date.getDate() + days1900);
        if (date.getFullYear() >= 1990 && date.getFullYear() <= 2030) {
          return date;
        }
      }
      
      // Format 2: OLE Automation date (8 bytes double)
      const oleDate = dataView.getFloat64(offset, true);
      if (oleDate > 30000 && oleDate < 50000) {
        const date = new Date((oleDate - 25569) * 86400 * 1000);
        if (date.getFullYear() >= 1990 && date.getFullYear() <= 2030) {
          return date;
        }
      }
      
      // Format 3: Unix timestamp (4 bytes)
      const unixTime = dataView.getUint32(offset, true);
      if (unixTime > 946684800 && unixTime < 2147483647) { // Between 2000 and 2038
        return new Date(unixTime * 1000);
      }
      
      return null;
    };
    
    // Scan for transaction-like data structures
    for (let i = 0; i < uint8Array.length - 200; i++) {
      // Look for potential date values
      const date = parseMoneyDate(arrayBuffer, i);
      
      if (date) {
        // Found a valid date, look for amount nearby
        for (let j = 4; j <= 50; j += 4) {
          if (i + j + 8 > uint8Array.length) break;
          
          // Try reading as currency (could be int cents or float dollars)
          const amountCents = dataView.getInt32(i + j, true);
          const amountFloat = dataView.getFloat64(i + j, true);
          
          let amount = 0;
          if (Math.abs(amountCents) > 0 && Math.abs(amountCents) < 10000000) {
            amount = amountCents / 100;
          } else if (Math.abs(amountFloat) > 0.01 && Math.abs(amountFloat) < 1000000) {
            amount = amountFloat;
          }
          
          if (amount !== 0) {
            // Look for description/payee
            let description = '';
            let payee = '';
            
            // Search forward for text
            for (let k = j + 8; k < j + 200 && i + k < uint8Array.length; k++) {
              const str = readString(i + k) || readUnicodeString(i + k);
              if (str && str.length > 2 && str.length < 100) {
                if (!description) {
                  description = str;
                } else if (!payee) {
                  payee = str;
                  break;
                }
              }
            }
            
            if (description) {
              transactions.push({
                date: date,
                amount: Math.abs(amount),
                description: description,
                type: amount < 0 ? 'expense' : 'income',
                category: 'Imported',
                payee: payee || undefined
              });
              
              i += j + 100; // Skip past this transaction
              break;
            }
          }
        }
      }
    }

    // Additional pattern: Look for transaction blocks with specific markers
    for (let i = 0; i < uint8Array.length - 500; i++) {
      // Money sometimes uses record markers like 0x00 0x00 followed by record length
      if (uint8Array[i] === 0x00 && uint8Array[i + 1] === 0x00) {
        const recordLength = dataView.getUint16(i + 2, true);
        
        if (recordLength > 20 && recordLength < 500) {
          // Potential transaction record
          let foundDate = false;
          let foundAmount = false;
          let transDate: Date | null = null;
          let transAmount = 0;
          let transDesc = '';
          
          // Scan the record for date and amount
          for (let j = 4; j < recordLength - 8 && i + j + 8 < uint8Array.length; j += 4) {
            if (!foundDate) {
              transDate = parseMoneyDate(arrayBuffer, i + j);
              if (transDate) foundDate = true;
            }
            
            if (!foundAmount && foundDate) {
              const possibleAmount = dataView.getInt32(i + j, true);
              if (Math.abs(possibleAmount) > 100 && Math.abs(possibleAmount) < 10000000) {
                transAmount = possibleAmount / 100;
                foundAmount = true;
                
                // Look for description after amount
                for (let k = j + 4; k < recordLength && i + k < uint8Array.length; k++) {
                  const str = readString(i + k) || readUnicodeString(i + k);
                  if (str && str.length > 2) {
                    transDesc = str;
                    break;
                  }
                }
              }
            }
            
            if (foundDate && foundAmount && transDesc) break;
          }
          
          if (foundDate && foundAmount && transDesc && transDate) {
            transactions.push({
              date: transDate,
              amount: Math.abs(transAmount),
              description: transDesc,
              type: transAmount < 0 ? 'expense' : 'income',
              category: 'Imported'
            });
          }
        }
      }
    }

    // If no accounts found, create a default
    if (accountsMap.size === 0) {
      console.log('No accounts found, creating default');
      accountsMap.set('Money Import', {
        name: 'Money Import',
        type: 'checking',
        balance: 0
      });
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

    console.log(`Parsed ${accountsMap.size} accounts and ${uniqueTransactions.length} transactions`);
    
    return {
      accounts: Array.from(accountsMap.values()),
      transactions: uniqueTransactions
    };
    
  } catch (error) {
    console.error('Error parsing .mny file:', error);
    throw new Error('Failed to parse Microsoft Money file. The file may be encrypted, corrupted, or in an unsupported version.');
  }
}
