// Microsoft Money Sunset Edition MBF file parser
// This parser is specifically designed for Money Sunset (2008) backup files

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
  
  console.log('Parsing Microsoft Money Sunset file, size:', arrayBuffer.byteLength);
  
  try {
    // Money Sunset uses OLE structured storage format
    // The actual data is often compressed with GZIP inside the OLE container
    
    // Look for GZIP headers (0x1f, 0x8b) within the file
    const gzipHeaders: number[] = [];
    for (let i = 0; i < uint8Array.length - 1; i++) {
      if (uint8Array[i] === 0x1f && uint8Array[i + 1] === 0x8b) {
        gzipHeaders.push(i);
      }
    }
    
    console.log(`Found ${gzipHeaders.length} potential GZIP sections`);
    
    // Helper to read UTF-16 LE strings (Money Sunset uses Unicode)
    const readUTF16String = (offset: number, maxLength: number = 255): string => {
      let str = '';
      for (let i = 0; i < maxLength && offset + i * 2 + 1 < uint8Array.length; i++) {
        const charCode = uint8Array[offset + i * 2] | (uint8Array[offset + i * 2 + 1] << 8);
        if (charCode === 0) break;
        if (charCode >= 32 && charCode <= 126) {
          str += String.fromCharCode(charCode);
        }
      }
      return str;
    };

    // Helper to read ASCII strings
    const readASCIIString = (offset: number, maxLength: number = 255): string => {
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

    // Money Sunset specific patterns
    // Account data is stored in specific record structures
    
    // Look for account records
    // In Money Sunset, accounts are often preceded by specific byte patterns
    const accountPatterns = [
      // Pattern for account records in Money Sunset
      [0x00, 0x00, 0x00, 0x0C], // Common account record marker
      [0x41, 0x00, 0x63, 0x00, 0x63, 0x00], // "Acc" in UTF-16
    ];
    
    for (const pattern of accountPatterns) {
      let offset = 0;
      while (offset < uint8Array.length - 200) {
        // Find pattern
        let found = false;
        for (let i = offset; i < uint8Array.length - pattern.length; i++) {
          let match = true;
          for (let j = 0; j < pattern.length; j++) {
            if (uint8Array[i + j] !== pattern[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            offset = i + pattern.length;
            found = true;
            break;
          }
        }
        
        if (!found) break;
        
        // Try to read account data
        // Skip ahead to find account name (usually within 100 bytes)
        for (let skip = 0; skip < 100; skip += 2) {
          const accountName = readUTF16String(offset + skip);
          if (accountName && accountName.length > 2 && accountName.length < 50) {
            // Found potential account name
            const cleanName = accountName.trim();
            const type = cleanName.toLowerCase().includes('credit') ? 'credit' :
                        cleanName.toLowerCase().includes('saving') ? 'savings' :
                        cleanName.toLowerCase().includes('loan') ? 'loan' :
                        cleanName.toLowerCase().includes('invest') ? 'investment' :
                        'checking';
            
            if (!accountsMap.has(cleanName)) {
              accountsMap.set(cleanName, {
                name: cleanName,
                type: type,
                balance: 0
              });
              console.log('Found account:', cleanName);
            }
            break;
          }
        }
        
        offset += 100;
      }
    }

    // Look for transaction data
    // Money Sunset stores transactions in a specific format
    
    // Transaction patterns for Money Sunset
    const transPatterns = [
      [0x00, 0x00, 0x00, 0x1C], // Transaction record marker
      [0x54, 0x00, 0x72, 0x00, 0x61, 0x00, 0x6E, 0x00], // "Tran" in UTF-16
    ];
    
    // Money Sunset uses Windows FILETIME for dates (100-nanosecond intervals since 1/1/1601)
    const FILETIME_EPOCH = new Date(1601, 0, 1).getTime();
    
    for (const pattern of transPatterns) {
      let offset = 0;
      while (offset < uint8Array.length - 500) {
        // Find pattern
        let found = false;
        for (let i = offset; i < uint8Array.length - pattern.length; i++) {
          let match = true;
          for (let j = 0; j < pattern.length; j++) {
            if (uint8Array[i + j] !== pattern[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            offset = i + pattern.length;
            found = true;
            break;
          }
        }
        
        if (!found) break;
        
        // Try to parse transaction
        // Structure typically includes: date (8 bytes), amount (8 bytes), description (variable)
        
        // Look for valid date values
        for (let dateOffset = 0; dateOffset < 50; dateOffset += 4) {
          if (offset + dateOffset + 8 > uint8Array.length) break;
          
          // Read as FILETIME (8 bytes, little endian)
          const lowDateTime = dataView.getUint32(offset + dateOffset, true);
          const highDateTime = dataView.getUint32(offset + dateOffset + 4, true);
          
          // Convert FILETIME to JavaScript Date
          const fileTime = highDateTime * 0x100000000 + lowDateTime;
          const jsTime = fileTime / 10000 + FILETIME_EPOCH;
          const date = new Date(jsTime);
          
          // Check if it's a valid date (between 1990 and 2030)
          if (date.getFullYear() >= 1990 && date.getFullYear() <= 2030) {
            // Look for amount (usually within next 20 bytes)
            for (let amountOffset = 8; amountOffset < 30; amountOffset += 4) {
              if (offset + dateOffset + amountOffset + 8 > uint8Array.length) break;
              
              // Amount might be stored as double or as integer (cents)
              const amountDouble = dataView.getFloat64(offset + dateOffset + amountOffset, true);
              const amountInt = dataView.getInt32(offset + dateOffset + amountOffset, true);
              
              let amount = 0;
              if (Math.abs(amountDouble) > 0.01 && Math.abs(amountDouble) < 1000000) {
                amount = amountDouble;
              } else if (Math.abs(amountInt) > 0 && Math.abs(amountInt) < 100000000) {
                amount = amountInt / 100; // Convert cents to dollars
              }
              
              if (amount !== 0) {
                // Look for description (UTF-16 string)
                let description = '';
                let payee = '';
                
                // Description usually follows amount
                for (let descOffset = amountOffset + 8; descOffset < 200; descOffset += 2) {
                  const str = readUTF16String(offset + dateOffset + descOffset);
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
                    payee: payee
                  });
                  
                  console.log(`Found transaction: ${date.toLocaleDateString()} - ${description} - $${amount}`);
                  offset += 200; // Skip past this transaction
                  break;
                }
              }
            }
            break;
          }
        }
        
        offset += 50;
      }
    }

    // If we found very few transactions, try an alternative approach
    if (transactions.length < 10) {
      console.log('Few transactions found, trying alternative parsing...');
      
      // Look for date patterns in the file
      for (let i = 0; i < uint8Array.length - 100; i++) {
        // Look for year bytes (e.g., 2010-2024 in various formats)
        if (uint8Array[i] === 0x07 && uint8Array[i + 1] >= 0xDA && uint8Array[i + 1] <= 0xE8) {
          // Potential year 2010-2024
          const year = 2000 + (uint8Array[i + 1] - 0xD0);
          
          // Check for month and day nearby
          if (i >= 2 && uint8Array[i - 2] >= 1 && uint8Array[i - 2] <= 31 && 
              uint8Array[i - 1] >= 1 && uint8Array[i - 1] <= 12) {
            
            const day = uint8Array[i - 2];
            const month = uint8Array[i - 1];
            const date = new Date(year, month - 1, day);
            
            // Look for amount and description
            for (let j = 4; j < 50; j += 4) {
              const possibleAmount = dataView.getInt32(i + j, true);
              if (Math.abs(possibleAmount) > 100 && Math.abs(possibleAmount) < 10000000) {
                // Found possible amount in cents
                const amount = possibleAmount / 100;
                
                // Look for description
                const description = readUTF16String(i + j + 4) || readASCIIString(i + j + 4);
                
                if (description && description.length > 2) {
                  transactions.push({
                    date: date,
                    amount: Math.abs(amount),
                    description: description,
                    type: amount < 0 ? 'expense' : 'income',
                    category: 'Imported'
                  });
                  break;
                }
              }
            }
          }
        }
      }
    }

    // If no accounts found, create defaults based on transaction data
    if (accountsMap.size === 0) {
      console.log('No accounts found, creating default account');
      accountsMap.set('Money Sunset Import', {
        name: 'Money Sunset Import',
        type: 'checking',
        balance: 0
      });
    }

    // Sort transactions by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Remove duplicates
    const uniqueTransactions = transactions.filter((trans, index, self) =>
      index === self.findIndex((t) => (
        t.date.getTime() === trans.date.getTime() && 
        t.amount === trans.amount &&
        t.description === trans.description
      ))
    );

    console.log(`Final result: ${accountsMap.size} accounts and ${uniqueTransactions.length} unique transactions`);
    
    return {
      accounts: Array.from(accountsMap.values()),
      transactions: uniqueTransactions
    };
    
  } catch (error) {
    console.error('Error parsing Money Sunset MBF file:', error);
    throw new Error('Failed to parse Microsoft Money Sunset file. Please ensure this is a valid Money Sunset backup file (.mbf).');
  }
}
