import { logger } from '../services/loggingService';
// Microsoft Money .mny file parser with manual mapping support

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
  rawData?: Array<Record<string, unknown>>;
  needsMapping?: boolean;
}

export interface FieldMapping {
  date: number;
  amount: number;
  description: number;
  payee?: number;
  category?: number;
  accountName?: number;
  type?: number;
}

export async function parseMNY(arrayBuffer: ArrayBuffer): Promise<ParseResult> {
  const uint8Array = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);
  
  logger.info('Parsing Microsoft Money .mny file', { size: arrayBuffer.byteLength });
  
  // Try to extract structured data that could be transactions
  const potentialRecords: Array<Record<string, unknown>> = [];
  const recordSize = 256; // Guess at record size
  const maxRecords = 10000;
  
  // Strategy: Look for patterns that might be structured records
  // We'll extract data and let the user tell us what it means
  
  for (let offset = 0; offset < arrayBuffer.byteLength - recordSize && potentialRecords.length < maxRecords; offset += recordSize) {
    const record: Record<string, unknown> = {};
    
    // Try to read various data types at different offsets
    for (let i = 0; i < Math.min(10, recordSize / 8); i++) {
      const pos = offset + i * 8;
      
      if (pos + 8 <= arrayBuffer.byteLength) {
        // Try reading as double (8 bytes)
        const doubleValue = dataView.getFloat64(pos, true);
        
        // Check if it might be an OLE date
        if (doubleValue > 30000 && doubleValue < 60000) {
          record[`field_${i}_date`] = doubleValue;
        }
        // Check if it might be a currency amount
        else if (Math.abs(doubleValue) > 0.01 && Math.abs(doubleValue) < 1000000) {
          record[`field_${i}_amount`] = doubleValue;
        }
        
        // Try reading as 32-bit integer
        const intValue = dataView.getInt32(pos, true);
        if (intValue > 0 && intValue < 1000000) {
          record[`field_${i}_int`] = intValue;
        }
      }
      
      // Try reading as string (both ASCII and UTF-16)
      const asciiStr = readString(uint8Array, offset + i * 20, 50);
      if (asciiStr && asciiStr.length > 2) {
        record[`field_${i}_text`] = asciiStr;
      }
      
      const utf16Str = readUTF16String(uint8Array, offset + i * 20, 25);
      if (utf16Str && utf16Str.length > 2 && utf16Str !== asciiStr) {
        record[`field_${i}_text_utf16`] = utf16Str;
      }
    }
    
    // Only add records that have at least some meaningful data
    if (Object.keys(record).length >= 3) {
      potentialRecords.push(record);
    }
    
    // Progress
    if (offset % (1024 * 1024) === 0 && offset > 0) {
      logger.debug('Scan progress', { mb: Number((offset / (1024 * 1024)).toFixed(1)) });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  logger.info('Extracted potential records', { count: potentialRecords.length });
  
  if (potentialRecords.length > 10) {
    // We found structured data - let user map it
    return {
      accounts: [],
      transactions: [],
      rawData: potentialRecords,
      needsMapping: true,
      warning: 'We found structured data in your Money file. Please help us understand what each field represents.'
    };
  }
  
  // Fallback if we can't find structured data
  return {
    accounts: [{
      name: 'Money Import',
      type: 'checking',
      balance: 0
    }],
    transactions: [],
    warning: 'Unable to automatically parse this Money file. Please export from Money as QIF format instead.'
  };
}

function readString(uint8Array: Uint8Array, offset: number, maxLength: number): string {
  let str = '';
  for (let i = 0; i < maxLength && offset + i < uint8Array.length; i++) {
    const byte = uint8Array[offset + i];
    if (byte === undefined || byte === 0) break;
    if (byte >= 32 && byte <= 126) {
      str += String.fromCharCode(byte);
    }
  }
  return str.trim();
}

function readUTF16String(uint8Array: Uint8Array, offset: number, maxLength: number): string {
  let str = '';
  for (let i = 0; i < maxLength && offset + i * 2 + 1 < uint8Array.length; i++) {
    const lowByte = uint8Array[offset + i * 2];
    const highByte = uint8Array[offset + i * 2 + 1];
    if (lowByte === undefined || highByte === undefined) {
      break;
    }
    const charCode = lowByte | (highByte << 8);
    if (charCode === 0) break;
    if (charCode >= 32 && charCode < 65536) {
      str += String.fromCharCode(charCode);
    }
  }
  return str.trim();
}

export function applyMappingToData(rawData: Array<Record<string, unknown>>, mapping: FieldMapping): { accounts: ParsedAccount[], transactions: ParsedTransaction[] } {
  const accounts = new Map<string, ParsedAccount>();
  const transactions: ParsedTransaction[] = [];
  
  // Process each record using the mapping
  rawData.forEach(record => {
    try {
      const recordKeys = Object.keys(record);
      const getFieldValue = (index: number | undefined) => {
        if (index === undefined) {
          return undefined;
        }
        const key = recordKeys[index];
        return key !== undefined ? record[key] : undefined;
      };

      // Get mapped values
      const dateField = getFieldValue(mapping.date);
      const amountField = getFieldValue(mapping.amount);
      const descField = getFieldValue(mapping.description);
      if (dateField === undefined || amountField === undefined || descField === undefined) {
        return;
      }
      
      // Convert date
      let date: Date;
      if (typeof dateField === 'number' && dateField > 30000 && dateField < 60000) {
        // OLE date
        date = new Date((dateField - 25569) * 86400 * 1000);
      } else if (dateField instanceof Date) {
        date = dateField;
      } else {
        date = new Date(String(dateField));
      }
      
      if (isNaN(date.getTime())) return;
      
      // Get amount
      const rawAmount = parseFloat(String(amountField));
      if (isNaN(rawAmount)) return;
      const amount = Math.round(rawAmount * 100) / 100;
      
      // Get optional fields
      const payeeValue = getFieldValue(mapping.payee);
      const categoryValue = getFieldValue(mapping.category);
      const accountNameValue = getFieldValue(mapping.accountName);
      const category = typeof categoryValue === 'string' && categoryValue.trim().length > 0
        ? categoryValue
        : 'Imported';
      const accountName = typeof accountNameValue === 'string' && accountNameValue.trim().length > 0
        ? accountNameValue
        : 'Primary Account';
      
      // Add account if new
      if (accountName && !accounts.has(accountName)) {
        accounts.set(accountName, {
          name: accountName,
          type: 'checking',
          balance: 0
        });
      }
      
      // Create transaction
      const transaction: ParsedTransaction = {
        date,
        amount: Math.abs(amount),
        description: String(descField),
        type: amount < 0 ? 'expense' : 'income',
        category: String(category),
        accountName
      };

      if (typeof payeeValue === 'string' && payeeValue.trim().length > 0) {
        transaction.payee = payeeValue;
      }

      transactions.push(transaction);
      
    } catch (error) {
      logger.error('Error processing record:', error);
    }
  });
  
  // Calculate balances
  accounts.forEach(account => {
    const accountTrans = transactions.filter(t => t.accountName === account.name);
    const income = accountTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = accountTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    account.balance = income - expenses;
  });
  
  return {
    accounts: Array.from(accounts.values()),
    transactions
  };
}

export async function parseMBF(arrayBuffer: ArrayBuffer): Promise<ParseResult> {
  const uint8Array = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);
  
  logger.info('Parsing Microsoft Money .mbf backup file', { size: arrayBuffer.byteLength });
  
  // Check file header to understand format
  const header = Array.from(uint8Array.slice(0, 64))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  logger.debug('MBF file header', header);
  
  // Check if file appears to be compressed or encrypted
  let textFound = 0;
  for (let i = 0; i < Math.min(10000, arrayBuffer.byteLength); i++) {
    const byte = uint8Array[i];
    if (byte !== undefined && byte >= 32 && byte <= 126) {
      textFound++;
    }
  }
  
  const textPercentage = (textFound / Math.min(10000, arrayBuffer.byteLength)) * 100;
  logger.debug('Readable text percentage', { percent: Number(textPercentage.toFixed(1)) });
  
  // Try to extract structured data
  const potentialRecords: Array<Record<string, unknown>> = [];
  
  // MBF files might have different structure than MNY
  // Let's try multiple approaches
  
  // Approach 1: Look for record boundaries
  const recordSizes = [128, 256, 512, 1024]; // Common record sizes
  
  for (const recordSize of recordSizes) {
    logger.debug('Trying record size', { bytes: recordSize });
    const testRecords: Array<Record<string, unknown>> = [];
    
    for (let offset = 0; offset < Math.min(50000, arrayBuffer.byteLength) && testRecords.length < 100; offset += recordSize) {
      const record: Record<string, unknown> = {};
      let hasData = false;
      
      // Try to extract different data types
      for (let i = 0; i < Math.min(20, recordSize / 8); i++) {
        const pos = offset + i * 8;
        
        if (pos + 8 <= arrayBuffer.byteLength) {
          // Try as double
          const doubleValue = dataView.getFloat64(pos, true);
          
          // OLE date check
          if (doubleValue > 30000 && doubleValue < 60000) {
            record[`field_${i}_date`] = doubleValue;
            hasData = true;
          }
          // Currency amount check
          else if (Math.abs(doubleValue) > 0.01 && Math.abs(doubleValue) < 1000000) {
            record[`field_${i}_amount`] = doubleValue;
            hasData = true;
          }
          
          // Try as 32-bit values
          if (pos + 4 <= arrayBuffer.byteLength) {
            const int32 = dataView.getInt32(pos, true);
            const float32 = dataView.getFloat32(pos, true);
            
            // Check for reasonable values
            if (int32 > 0 && int32 < 1000000) {
              record[`field_${i}_int32`] = int32;
            }
            if (Math.abs(float32) > 0.01 && Math.abs(float32) < 10000) {
              record[`field_${i}_float32`] = float32;
            }
          }
        }
        
        // Try to read strings at various positions
        const strPos = offset + i * 16;
        if (strPos < arrayBuffer.byteLength - 50) {
          const ascii = readString(uint8Array, strPos, 50);
          const utf16 = readUTF16String(uint8Array, strPos, 25);
          
          if (ascii && ascii.length > 2 && ascii.length < 50) {
            record[`field_${i}_text`] = ascii;
            hasData = true;
          }
          if (utf16 && utf16.length > 2 && utf16.length < 50 && utf16 !== ascii) {
            record[`field_${i}_text_utf16`] = utf16;
            hasData = true;
          }
        }
      }
      
      if (hasData && Object.keys(record).length >= 2) {
        testRecords.push(record);
      }
    }
    
    // If this record size found good data, use it
    if (testRecords.length > 10) {
      logger.debug('Found records of size', { size: recordSize, count: testRecords.length });
      potentialRecords.push(...testRecords);
      break;
    }
  }
  
  // Approach 2: Look for specific MBF patterns
  if (potentialRecords.length < 10) {
    logger.debug('Trying pattern-based extraction...');
    
    // MBF might use different date encoding
    for (let i = 0; i < Math.min(arrayBuffer.byteLength - 100, 100000); i++) {
      const record: Record<string, unknown> = {};
      let foundDate = false;
      let foundAmount = false;
      
      // Check for various date formats
      // Format 1: Days since 1900 (32-bit)
      if (i + 4 <= arrayBuffer.byteLength) {
        const days = dataView.getInt32(i, true);
        if (days > 25000 && days < 50000) {
          const date = new Date(1900, 0, 1);
          date.setDate(date.getDate() + days);
          if (date.getFullYear() >= 1990 && date.getFullYear() <= 2030) {
            record.date_value = days;
            record.date_formatted = date.toLocaleDateString();
            foundDate = true;
          }
        }
      }
      
      if (foundDate) {
        // Look for amount nearby
        for (let j = 4; j < 50; j += 4) {
          if (i + j + 8 > arrayBuffer.byteLength) break;
          
          const amount64 = dataView.getFloat64(i + j, true);
          const amount32 = dataView.getFloat32(i + j, true);
          const amountInt = dataView.getInt32(i + j, true);
          
          if (Math.abs(amount64) > 0.01 && Math.abs(amount64) < 100000) {
            record.amount = amount64;
            foundAmount = true;
            break;
          } else if (Math.abs(amount32) > 0.01 && Math.abs(amount32) < 100000) {
            record.amount = amount32;
            foundAmount = true;
            break;
          } else if (Math.abs(amountInt / 100) > 0.01 && Math.abs(amountInt / 100) < 100000) {
            record.amount = amountInt / 100; // Cents to dollars
            foundAmount = true;
            break;
          }
        }
      }
      
      if (foundDate && foundAmount) {
        // Look for description
        for (let k = 0; k < 200; k += 10) {
          const desc = readString(uint8Array, i + k, 100) || readUTF16String(uint8Array, i + k, 50);
          if (desc && desc.length > 2 && desc.length < 100) {
            record.description = desc;
            break;
          }
        }
        
        if (Object.keys(record).length >= 3) {
          potentialRecords.push(record);
          i += 50; // Skip ahead
        }
      }
    }
  }
  
  logger.info('Extracted potential records from MBF', { count: potentialRecords.length });
  
  if (potentialRecords.length > 10) {
    return {
      accounts: [],
      transactions: [],
      rawData: potentialRecords,
      needsMapping: true,
      warning: 'Found data in your Money backup file. Please help us map the fields correctly.'
    };
  }
  
  // If we couldn't extract meaningful data
  return {
    accounts: [{
      name: 'Money Backup File',
      type: 'checking',
      balance: 0
    }],
    transactions: [],
    warning: 'Unable to extract data from this Money backup file. The file may be encrypted or in a format we don\'t support. Please try exporting as QIF from Microsoft Money instead.'
  };
}
