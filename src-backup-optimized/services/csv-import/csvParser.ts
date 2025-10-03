import type { ParsedCsvData } from './types';
import { lazyLogger as logger } from '../serviceFactory';

/**
 * CSV parsing utilities
 * Handles different delimiters, quotes, and encodings
 */
export class CsvParser {
  /**
   * Parse CSV with intelligent header detection
   */
  parseCSV(content: string): ParsedCsvData {
    const lines = content.trim().split('\n');
    const rows: string[][] = [];
    
    for (const line of lines) {
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      row.push(current.trim());
      rows.push(row);
    }
    
    // Detect headers (first row with text content)
    const headers = rows[0] || [];
    const data = rows.slice(1);
    
    return { headers, data };
  }

  /**
   * Detect the delimiter used in the CSV
   */
  detectDelimiter(content: string): ',' | ';' | '\t' {
    const firstLine = content.split('\n')[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    
    if (tabCount > commaCount && tabCount > semicolonCount) {
      return '\t';
    }
    if (semicolonCount > commaCount) {
      return ';';
    }
    return ',';
  }

  /**
   * Validate CSV structure
   */
  validateStructure(data: ParsedCsvData): boolean {
    if (data.headers.length === 0) {
      logger.error('CSV has no headers');
      return false;
    }
    
    if (data.data.length === 0) {
      logger.error('CSV has no data rows');
      return false;
    }
    
    // Check if all rows have same number of columns
    const columnCount = data.headers.length;
    const invalidRows = data.data.filter(row => row.length !== columnCount);
    
    if (invalidRows.length > 0) {
      logger.warn(`${invalidRows.length} rows have mismatched column counts`);
    }
    
    return true;
  }

  /**
   * Clean and normalize CSV data
   */
  normalizeData(data: ParsedCsvData): ParsedCsvData {
    return {
      headers: data.headers.map(h => this.normalizeHeader(h)),
      data: data.data.map(row => row.map(cell => this.normalizeCell(cell)))
    };
  }

  /**
   * Normalize header names
   */
  private normalizeHeader(header: string): string {
    return header
      .trim()
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .toLowerCase();
  }

  /**
   * Normalize cell values
   */
  private normalizeCell(cell: string): string {
    return cell
      .trim()
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/\s+/g, ' '); // Normalize whitespace
  }
}

export const csvParser = new CsvParser();