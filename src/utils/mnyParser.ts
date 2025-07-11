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
  rawData?: any[];
  needsMapping?: boolean;
}

export async function parseMNY(arrayBuffer: ArrayBuffer): Promise<ParseResult> {
  const uint8Array = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);
  
  console.log('Parsing Microsoft Money .mny file, size:', arrayBuffer.byteLength);
  
  // Try to extract structured data that could be transactions
  const potentialRecords: any[] = [];
  const recordSize = 256; // Guess at record size
  const maxRecords = 10000;
  
  // Strategy: Look for patterns that might be structured records
  // We'll extract data and let the user tell us what it means
  
  for (let offset = 0; offset < arrayBuffer.byteLength - recordSize && potentialRecords.length < maxRecords; offset += recordSize) {
    const record: any = {};
    
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
      console.log(`Scanned ${(offset / (1024 * 1024)).toFixed(1)}MB...`);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  console.log(`Extracted ${potentialRecords.length} potential records`);
  
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
    if (byte === 0) break;
    if (byte >= 32 && byte <= 126) {
      str += String.fromCharCode(byte);
    }
  }
  return str.trim();
}

function readUTF16String(uint8Array: Uint8Array, offset: number, maxLength: number): string {
  let str = '';
  for (let i = 0; i < maxLength && offset + i * 2 + 1 < uint8Array.length; i++) {
    const charCode = uint8Array[offset + i * 2] | (uint8Array[offset + i * 2 + 1] << 8);
    if (charCode === 0) break;
    if (charCode >= 32 && charCode < 65536) {
      str += String.fromCharCode(charCode);
    }
  }
  return str.trim();
}

export function applyMappingToData(rawData: any[], mapping: any): { accounts: ParsedAccount[], transactions: ParsedTransaction[] } {
  const accounts = new Map<string, ParsedAccount>();
  const transactions: ParsedTransaction[] = [];
  
  // Process each record using the mapping
  rawData.forEach(record => {
    try {
      // Get mapped values
      const dateField = record[Object.keys(record)[mapping.date]];
      const amountField = record[Object.keys(record)[mapping.amount]];
      const descField = record[Object.keys(record)[mapping.description]];
      
      // Convert date
      let date: Date;
      if (typeof dateField === 'number' && dateField > 30000 && dateField < 60000) {
        // OLE date
        date = new Date((dateField - 25569) * 86400 * 1000);
      } else if (dateField instanceof Date) {
        date = dateField;
      } else {
        date = new Date(dateField);
      }
      
      if (isNaN(date.getTime())) return;
      
      // Get amount
      const amount = parseFloat(String(amountField));
      if (isNaN(amount)) return;
      
      // Get optional fields
      const payee = mapping.payee !== undefined ? record[Object.keys(record)[mapping.payee]] : undefined;
      const category = mapping.category !== undefined ? record[Object.keys(record)[mapping.category]] : 'Imported';
      const accountName = mapping.accountName !== undefined ? record[Object.keys(record)[mapping.accountName]] : 'Primary Account';
      
      // Add account if new
      if (accountName && !accounts.has(accountName)) {
        accounts.set(accountName, {
          name: accountName,
          type: 'checking',
          balance: 0
        });
      }
      
      // Create transaction
      transactions.push({
        date,
        amount: Math.abs(amount),
        description: String(descField),
        type: amount < 0 ? 'expense' : 'income',
        category: String(category),
        payee: payee ? String(payee) : undefined,
        accountName
      });
      
    } catch (error) {
      console.error('Error processing record:', error);
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
