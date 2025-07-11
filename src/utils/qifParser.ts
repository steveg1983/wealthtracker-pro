// QIF file parser optimized for Microsoft Money exports

export interface ParsedAccount {
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment';
  balance: number;
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

export interface ParsedData {
  accounts: ParsedAccount[];
  transactions: ParsedTransaction[];
}

export function parseQIF(content: string): ParsedData {
  const lines = content.split(/\r?\n/);
  const transactions: ParsedTransaction[] = [];
  const accountsMap = new Map<string, ParsedAccount>();
  
  let currentTransaction: any = {};
  let currentAccountName = '';
  let currentAccountType = 'checking';
  
  console.log('Enhanced QIF parsing - looking for multiple accounts');
  
  // First pass - look for explicit account definitions
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line === '!Account') {
      // Found account section
      let accountName = '';
      let accountType: ParsedAccount['type'] = 'checking';
      let balance = 0;
      
      i++;
      while (i < lines.length && !lines[i].startsWith('!')) {
        const accountLine = lines[i].trim();
        
        if (accountLine.startsWith('N')) {
          accountName = accountLine.substring(1).trim();
        } else if (accountLine.startsWith('T')) {
          const typeStr = accountLine.substring(1).toLowerCase();
          if (typeStr.includes('credit') || typeStr === 'ccard') {
            accountType = 'credit';
          } else if (typeStr.includes('savings') || typeStr.includes('oth a')) {
            accountType = 'savings';
          } else if (typeStr.includes('invest')) {
            accountType = 'investment';
          } else if (typeStr.includes('loan') || typeStr.includes('mort')) {
            accountType = 'loan';
          }
        } else if (accountLine.startsWith('B')) {
          // Balance
          const balanceStr = accountLine.substring(1).replace(/[,£$]/g, '');
          balance = parseFloat(balanceStr) || 0;
        } else if (accountLine.startsWith('^')) {
          // End of account record
          break;
        }
        i++;
      }
      
      if (accountName) {
        accountsMap.set(accountName, {
          name: accountName,
          type: accountType,
          balance: balance
        });
        console.log('Found account:', accountName, 'Type:', accountType);
      }
    } else if (line.startsWith('!Type:')) {
      // This might indicate the account type for following transactions
      currentAccountName = currentAccountName || 'Default Account';
      
      const typeStr = line.substring(6).toLowerCase();
      if (typeStr.includes('bank')) {
        currentAccountType = 'checking';
      } else if (typeStr.includes('cash')) {
        currentAccountType = 'checking';
      } else if (typeStr.includes('ccard') || typeStr.includes('credit')) {
        currentAccountType = 'credit';
      } else if (typeStr.includes('invst')) {
        currentAccountType = 'investment';
      } else if (typeStr.includes('oth l')) {
        currentAccountType = 'loan';
      } else if (typeStr.includes('oth a')) {
        currentAccountType = 'savings';
      }
    }
    
    i++;
  }
  
  // Second pass - parse transactions and detect accounts from category patterns
  i = 0;
  let transactionCount = 0;
  const accountBalances = new Map<string, { income: number; expenses: number }>();
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.startsWith('^')) {
      // End of transaction
      if (currentTransaction.date && currentTransaction.amount !== undefined) {
        // Try to detect account from category
        let accountName = currentAccountName || 'General Account';
        
        // Look for account indicators in category
        if (currentTransaction.category) {
          // Check for [AccountName] pattern
          const bracketMatch = currentTransaction.category.match(/\[([^\]]+)\]/);
          if (bracketMatch) {
            accountName = bracketMatch[1];
            currentTransaction.category = currentTransaction.category.replace(/\[([^\]]+)\]/, '').trim();
          }
          
          // Check for "AccountName:" pattern
          const colonMatch = currentTransaction.category.match(/^([^:]+):/);
          if (colonMatch && colonMatch[1].length < 50) {
            accountName = colonMatch[1];
            currentTransaction.category = currentTransaction.category.substring(colonMatch[0].length).trim();
          }
        }
        
        // Check for account transfers (common pattern: "Transfer from/to AccountName")
        if (currentTransaction.payee) {
          const transferMatch = currentTransaction.payee.match(/Transfer (?:from|to) (.+)/i);
          if (transferMatch) {
            const otherAccount = transferMatch[1];
            if (!accountsMap.has(otherAccount)) {
              accountsMap.set(otherAccount, {
                name: otherAccount,
                type: 'checking',
                balance: 0
              });
            }
          }
        }
        
        // Add the primary account if not exists
        if (!accountsMap.has(accountName)) {
          accountsMap.set(accountName, {
            name: accountName,
            type: currentAccountType as ParsedAccount['type'],
            balance: 0
          });
        }
        
        // Track balances
        if (!accountBalances.has(accountName)) {
          accountBalances.set(accountName, { income: 0, expenses: 0 });
        }
        
        const balances = accountBalances.get(accountName)!;
        if (currentTransaction.amount > 0) {
          balances.income += Math.abs(currentTransaction.amount);
        } else {
          balances.expenses += Math.abs(currentTransaction.amount);
        }
        
        const transaction: ParsedTransaction = {
          date: currentTransaction.date,
          amount: Math.abs(currentTransaction.amount),
          description: currentTransaction.payee || currentTransaction.memo || 'No description',
          type: currentTransaction.amount < 0 ? 'expense' : 'income',
          category: currentTransaction.category || 'Uncategorized',
          payee: currentTransaction.payee,
          accountName: accountName
        };
        
        transactions.push(transaction);
        transactionCount++;
        
        if (transactionCount % 100 === 0) {
          console.log(`Processed ${transactionCount} transactions...`);
        }
      }
      currentTransaction = {};
    } else if (line.startsWith('D')) {
      // Date
      const dateStr = line.substring(1).trim();
      currentTransaction.date = parseQIFDate(dateStr);
    } else if (line.startsWith('T')) {
      // Amount
      const amountStr = line.substring(1).replace(/[,£$]/g, '').trim();
      currentTransaction.amount = parseFloat(amountStr);
    } else if (line.startsWith('P')) {
      // Payee
      currentTransaction.payee = line.substring(1).trim();
    } else if (line.startsWith('M')) {
      // Memo
      currentTransaction.memo = line.substring(1).trim();
    } else if (line.startsWith('L')) {
      // Category
      currentTransaction.category = line.substring(1).trim();
    } else if (line.startsWith('N')) {
      // Number/Check number
      if (!line.startsWith('N0') && line.length > 2) {
        currentTransaction.checkNum = line.substring(1).trim();
      }
    }
    
    i++;
  }
  
  // Calculate final balances
  accountBalances.forEach((balances, accountName) => {
    const account = accountsMap.get(accountName);
    if (account) {
      account.balance = balances.income - balances.expenses;
    }
  });
  
  // If we only found one generic account but have many transactions, 
  // try to extract more accounts from transaction patterns
  if (accountsMap.size <= 1 && transactions.length > 10) {
    console.log('Only one account found, analyzing transactions for more accounts...');
    
    // Look for patterns in payees that might indicate accounts
    transactions.forEach(t => {
      // Credit card patterns
      if (t.payee && t.payee.match(/VISA|MASTERCARD|AMEX|DISCOVER/i)) {
        const cardMatch = t.payee.match(/(VISA|MASTERCARD|AMEX|DISCOVER).*?(\d{4})/i);
        if (cardMatch) {
          const cardName = `${cardMatch[1]} ...${cardMatch[2]}`;
          if (!accountsMap.has(cardName)) {
            accountsMap.set(cardName, {
              name: cardName,
              type: 'credit',
              balance: 0
            });
          }
        }
      }
      
      // Bank account patterns (like "HSBC 1234")
      if (t.payee && t.payee.match(/HSBC|BARCLAYS|LLOYDS|NATWEST|SANTANDER/i)) {
        const bankMatch = t.payee.match(/(HSBC|BARCLAYS|LLOYDS|NATWEST|SANTANDER).*?(\d{4})/i);
        if (bankMatch) {
          const accountName = `${bankMatch[1]} ...${bankMatch[2]}`;
          if (!accountsMap.has(accountName)) {
            accountsMap.set(accountName, {
              name: accountName,
              type: 'checking',
              balance: 0
            });
          }
        }
      }
    });
  }
  
  // Ensure we have at least one account
  if (accountsMap.size === 0) {
    accountsMap.set('Imported Account', {
      name: 'Imported Account',
      type: 'checking',
      balance: 0
    });
  }
  
  console.log(`Final result: ${accountsMap.size} accounts and ${transactions.length} transactions`);
  
  return {
    accounts: Array.from(accountsMap.values()),
    transactions: transactions
  };
}

function parseQIFDate(dateStr: string): Date {
  // Try different date formats
  let date: Date | null = null;
  
  // Format: MM/DD/YY or MM/DD/YYYY
  const slashParts = dateStr.split('/');
  if (slashParts.length === 3) {
    const month = parseInt(slashParts[0]);
    const day = parseInt(slashParts[1]);
    let year = parseInt(slashParts[2]);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    date = new Date(year, month - 1, day);
  }
  
  // Format: MM-DD-YY or MM-DD-YYYY
  if (!date || isNaN(date.getTime())) {
    const dashParts = dateStr.split('-');
    if (dashParts.length === 3) {
      const month = parseInt(dashParts[0]);
      const day = parseInt(dashParts[1]);
      let year = parseInt(dashParts[2]);
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }
      date = new Date(year, month - 1, day);
    }
  }
  
  // Format: DD/MM/YYYY (UK format)
  if (!date || isNaN(date.getTime())) {
    const ukParts = dateStr.split('/');
    if (ukParts.length === 3) {
      const day = parseInt(ukParts[0]);
      const month = parseInt(ukParts[1]);
      const year = parseInt(ukParts[2]);
      if (day <= 31 && month <= 12) {
        date = new Date(year, month - 1, day);
      }
    }
  }
  
  // Format: YYYY-MM-DD (ISO format)
  if (!date || isNaN(date.getTime())) {
    const isoParts = dateStr.split('-');
    if (isoParts.length === 3 && isoParts[0].length === 4) {
      const year = parseInt(isoParts[0]);
      const month = parseInt(isoParts[1]);
      const day = parseInt(isoParts[2]);
      date = new Date(year, month - 1, day);
    }
  }
  
  return date || new Date();
}
