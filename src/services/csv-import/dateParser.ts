import { logger } from '../loggingService';

/**
 * Date parsing utilities
 * Handles multiple date formats commonly used in CSV exports
 */
export class DateParser {
  private readonly dateFormats = [
    // ISO format
    { regex: /^\d{4}-\d{2}-\d{2}$/, parser: (v: string) => v },
    // DD/MM/YYYY (UK/EU)
    { regex: /^\d{2}\/\d{2}\/\d{4}$/, parser: this.parseDDMMYYYY },
    // DD-MM-YYYY
    { regex: /^\d{2}-\d{2}-\d{4}$/, parser: this.parseDDMMYYYYDash },
    // MM/DD/YYYY (US)
    { regex: /^\d{2}\/\d{2}\/\d{4}$/, parser: this.parseMMDDYYYY },
    // DD.MM.YYYY (German)
    { regex: /^\d{2}\.\d{2}\.\d{4}$/, parser: this.parseDDMMYYYYDot },
    // YYYY/MM/DD
    { regex: /^\d{4}\/\d{2}\/\d{2}$/, parser: this.parseYYYYMMDD },
    // DD MMM YYYY (e.g., "01 Jan 2024")
    { regex: /^\d{1,2}\s+\w{3}\s+\d{4}$/, parser: this.parseDDMMMYYYY },
    // MMM DD, YYYY (e.g., "Jan 01, 2024")
    { regex: /^\w{3}\s+\d{1,2},\s+\d{4}$/, parser: this.parseMMMDDYYYY },
  ];

  /**
   * Parse date with multiple format support
   */
  parseDate(value: string, format?: string): string {
    if (!value || value.trim() === '') {
      logger.warn('Empty date value, using today\'s date');
      return new Date().toISOString().split('T')[0];
    }

    // Try standard Date parsing first
    const standardDate = new Date(value);
    if (!isNaN(standardDate.getTime())) {
      return standardDate.toISOString().split('T')[0];
    }

    // Try each format
    for (const { regex, parser } of this.dateFormats) {
      if (regex.test(value)) {
        try {
          const result = parser.call(this, value);
          const date = new Date(result);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch (e) {
          // Continue to next format
        }
      }
    }

    // If custom format provided, try to use it
    if (format) {
      const parsed = this.parseWithFormat(value, format);
      if (parsed) return parsed;
    }

    // Default to today if parsing fails
    logger.warn(`Cannot parse date: ${value}, using today's date`);
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Parse DD/MM/YYYY format
   */
  private parseDDMMYYYY(value: string): string {
    const [day, month, year] = value.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  /**
   * Parse DD-MM-YYYY format
   */
  private parseDDMMYYYYDash(value: string): string {
    const [day, month, year] = value.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  /**
   * Parse MM/DD/YYYY format
   */
  private parseMMDDYYYY(value: string): string {
    const [month, day, year] = value.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  /**
   * Parse DD.MM.YYYY format
   */
  private parseDDMMYYYYDot(value: string): string {
    const [day, month, year] = value.split('.');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  /**
   * Parse YYYY/MM/DD format
   */
  private parseYYYYMMDD(value: string): string {
    return value.replace(/\//g, '-');
  }

  /**
   * Parse DD MMM YYYY format
   */
  private parseDDMMMYYYY(value: string): string {
    const date = new Date(value);
    return date.toISOString().split('T')[0];
  }

  /**
   * Parse MMM DD, YYYY format
   */
  private parseMMMDDYYYY(value: string): string {
    const date = new Date(value);
    return date.toISOString().split('T')[0];
  }

  /**
   * Parse with custom format string
   */
  private parseWithFormat(value: string, format: string): string | null {
    // Simple format parsing (e.g., "DD/MM/YYYY" or "MM-DD-YYYY")
    try {
      const formatParts = format.toUpperCase().split(/[^A-Z]+/);
      const valueParts = value.split(/[^0-9]+/);
      
      if (formatParts.length !== valueParts.length) {
        return null;
      }

      let year = '', month = '', day = '';
      
      for (let i = 0; i < formatParts.length; i++) {
        const formatPart = formatParts[i];
        const valuePart = valueParts[i];
        
        if (formatPart.includes('Y')) {
          year = valuePart.length === 2 ? `20${valuePart}` : valuePart;
        } else if (formatPart.includes('M')) {
          month = valuePart.padStart(2, '0');
        } else if (formatPart.includes('D')) {
          day = valuePart.padStart(2, '0');
        }
      }
      
      if (year && month && day) {
        const date = new Date(`${year}-${month}-${day}`);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    } catch (e) {
      logger.error('Error parsing with format:', e);
    }
    
    return null;
  }
}

export const dateParser = new DateParser();