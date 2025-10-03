import type { Transaction, Account } from '../../types';
import type { ExportableData } from '../../types/export';
import Decimal from 'decimal.js';
import { lazyLogger as logger } from '../serviceFactory';

/**
 * Enterprise-grade service for handling export format conversions
 * Follows Single Responsibility Principle - only handles format conversions
 */
export class ExportFormatService {
  private readonly CURRENCY_SYMBOL = '£';
  private readonly DATE_FORMAT = 'en-GB';

  /**
   * Convert data to CSV format
   */
  arrayToCSV(data: ExportableData[]): string {
    if (!data || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const rows = data.map(row => {
      return headers.map(header => {
        const value = (row as unknown as Record<string, unknown>)[header];
        const stringValue = String(value ?? '');
        // Escape special characters
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });

    return [csvHeaders, ...rows].join('\n');
  }

  /**
   * Export to QIF format (Quicken Interchange Format)
   */
  exportToQIF(data: { transactions: Transaction[]; accounts: Account[] }): string {
    logger.info('Generating QIF export');
    
    let qifContent = '!Type:Bank\n';
    
    for (const account of data.accounts) {
      qifContent += `!Account\nN${account.name}\nT${this.mapAccountType(account.type)}\n^\n`;
      
      const accountTransactions = data.transactions.filter(t => t.accountId === account.id);
      
      for (const transaction of accountTransactions) {
        const amount = new Decimal(transaction.amount);
        const date = new Date(transaction.date);
        
        qifContent += `D${this.formatQIFDate(date)}\n`;
        qifContent += `T${amount.toFixed(2)}\n`;
        qifContent += `P${transaction.description}\n`;
        
        if (transaction.category) {
          qifContent += `L${transaction.category}\n`;
        }
        
        qifContent += '^\n';
      }
    }
    
    return qifContent;
  }

  /**
   * Export to OFX format (Open Financial Exchange)
   */
  exportToOFX(data: { transactions: Transaction[]; accounts: Account[] }): string {
    logger.info('Generating OFX export');
    
    const now = new Date();
    const dtserver = this.formatOFXDate(now);
    
    let ofxContent = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="211" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <DTSERVER>${dtserver}</DTSERVER>
      <LANGUAGE>ENG</LANGUAGE>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>`;

    for (const account of data.accounts) {
      const accountTransactions = data.transactions.filter(t => t.accountId === account.id);
      
      if (accountTransactions.length === 0) continue;
      
      const sortedTransactions = accountTransactions.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      const startDate = this.formatOFXDate(new Date(sortedTransactions[0].date));
      const endDate = this.formatOFXDate(new Date(sortedTransactions[sortedTransactions.length - 1].date));
      
      let balance = new Decimal(0);
      
      ofxContent += `
    <STMTTRNRS>
      <TRNUID>1</TRNUID>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <STMTRS>
        <CURDEF>GBP</CURDEF>
        <BANKACCTFROM>
          <BANKID>000000</BANKID>
          <ACCTID>${account.id}</ACCTID>
          <ACCTTYPE>${this.mapOFXAccountType(account.type)}</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>${startDate}</DTSTART>
          <DTEND>${endDate}</DTEND>`;
      
      for (const transaction of sortedTransactions) {
        const amount = new Decimal(transaction.amount);
        balance = balance.plus(amount);
        const trntype = amount.greaterThan(0) ? 'CREDIT' : 'DEBIT';
        
        ofxContent += `
          <STMTTRN>
            <TRNTYPE>${trntype}</TRNTYPE>
            <DTPOSTED>${this.formatOFXDate(new Date(transaction.date))}</DTPOSTED>
            <TRNAMT>${amount.toFixed(2)}</TRNAMT>
            <FITID>${transaction.id}</FITID>
            <NAME>${this.escapeXML(transaction.description.substring(0, 32))}</NAME>
            <MEMO>${this.escapeXML(transaction.description)}</MEMO>
          </STMTTRN>`;
      }
      
      ofxContent += `
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>${balance.toFixed(2)}</BALAMT>
          <DTASOF>${endDate}</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>`;
    }
    
    ofxContent += `
  </BANKMSGSRSV1>
</OFX>`;
    
    return ofxContent;
  }

  /**
   * Format currency with proper symbol and formatting
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat(this.DATE_FORMAT, {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Format date for display
   */
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat(this.DATE_FORMAT, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  /**
   * Format date for QIF format
   */
  private formatQIFDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }

  /**
   * Format date for OFX format
   */
  private formatOFXDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}[0:GMT]`;
  }

  /**
   * Map account type for QIF
   */
  private mapAccountType(type: string): string {
    const typeMap: Record<string, string> = {
      'checking': 'Bank',
      'savings': 'Bank',
      'credit_card': 'CCard',
      'investment': 'Invst',
      'loan': 'Oth L',
      'asset': 'Oth A'
    };
    return typeMap[type] || 'Bank';
  }

  /**
   * Map account type for OFX
   */
  private mapOFXAccountType(type: string): string {
    const typeMap: Record<string, string> = {
      'checking': 'CHECKING',
      'savings': 'SAVINGS',
      'credit_card': 'CREDITCARD',
      'investment': 'INVESTMENT',
      'loan': 'LOAN',
      'asset': 'CHECKING'
    };
    return typeMap[type] || 'CHECKING';
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const exportFormatService = new ExportFormatService();