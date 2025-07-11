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
  
  console.log('Parsing Microsoft Money .mny file, size:', arrayBuffer.byteLength);
  
  // Check file header to understand format
  const header = Array.from(uint8Array.slice(0, 32))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  console.log('File header:', header);
  
  // Check for Jet database signature
  const jetSignature = [0x00, 0x01, 0x00, 0x00, 0x53, 0x74, 0x61, 0x6E, 0x64, 0x61, 0x72, 0x64, 0x20, 0x4A, 0x65, 0x74];
  const isJetDb = jetSignature.every((byte, i) => uint8Array[i + 4] === byte);
  console.log('Is Jet database:', isJetDb);
  
  // Check for encryption
  let possiblyEncrypted = true;
  let textFound = 0;
  
  // Sample the file to check if it contains readable text
  for (let i = 0; i < Math.min(10000, arrayBuffer.byteLength); i++) {
    const byte = uint8Array[i];
    if (byte >= 32 && byte <= 126) {
      textFound++;
    }
  }
  
  const textPercentage = (textFound / Math.min(10000, arrayBuffer.byteLength)) * 100;
  console.log(`Readable text percentage in first 10KB: ${textPercentage.toFixed(1)}%`);
  
  if (textPercentage < 20) {
    console.log('File appears to be encrypted or compressed');
    
    return {
      accounts: [{
        name: 'Money File (Encrypted)',
        type: 'checking',
        balance: 0
      }],
      transactions: [],
      warning: 'This Microsoft Money file appears to be encrypted or password protected. To import your data:\n\n' +
               '1. Open the file in Microsoft Money\n' +
               '2. Go to File → Password → Remove Password (if password protected)\n' +
               '3. Go to File → Export\n' +
               '4. Choose "Loose QIF" format\n' +
               '5. Export all accounts and date ranges\n' +
               '6. Import the QIF file here instead'
    };
  }
  
  // If we get here, try to parse what we can
  console.log('Attempting to parse unencrypted Money file...');
  
  const accounts = new Map<string, ParsedAccount>();
  const transactions: ParsedTransaction[] = [];
  
  // Since the descriptions are garbage, this is likely a structured database
  // Money files use OLE structured storage (like old Office files)
  
  // Look for OLE header
  const oleSignature = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  const isOLE = oleSignature.every((byte, i) => uint8Array[i] === byte);
  console.log('Is OLE structured storage:', isOLE);
  
  if (isOLE) {
    console.log('This is an OLE file (like old Office formats)');
    console.log('Money data is likely in compressed streams within this file');
    
    return {
      accounts: [{
        name: 'Money File (OLE Format)',
        type: 'checking',
        balance: 0
      }],
      transactions: [],
      warning: 'This Microsoft Money file uses OLE structured storage which requires specialized parsing. ' +
               'The seemingly valid transactions with nonsense descriptions confirm the data is in a compressed/encoded format. ' +
               'Please export your data from Money as QIF:\n\n' +
               '1. Open Microsoft Money\n' +
               '2. File → Export\n' +
               '3. Choose "Loose QIF"\n' +
               '4. Select all accounts\n' +
               '5. Import the QIF file here'
    };
  }
  
  // Log some sample "descriptions" to confirm they're garbage
  console.log('Sample data being interpreted as transactions:');
  
  // The fact that we're finding 8412 "transactions" with garbage descriptions
  // means we're interpreting random binary data as transaction records
  
  return {
    accounts: [{
      name: 'Money Import',
      type: 'checking',
      balance: 0
    }],
    transactions: [],
    warning: 'This Microsoft Money file format cannot be reliably parsed. The data appears to be in a proprietary format. ' +
             'The 8000+ "transactions" with unreadable descriptions indicate we\'re reading binary data incorrectly.\n\n' +
             'To import your Money data:\n' +
             '1. Open Microsoft Money\n' +
             '2. Go to File → Export\n' +
             '3. Choose "Loose QIF" format\n' +
             '4. Select all accounts and date range\n' +
             '5. Save the .qif file\n' +
             '6. Import that QIF file here instead\n\n' +
             'QIF is a text-based format that preserves all your accounts, transactions, and categories accurately.'
  };
}
