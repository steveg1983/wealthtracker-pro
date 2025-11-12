// OCR Service using Tesseract.js for client-side OCR
// Note: In production, you might want to use a server-side OCR service like Google Vision API or AWS Textract

import type { ExtractedData, ExtractedItem } from './documentService';
import type { TesseractWorker, TesseractLine } from '../types/tesseract';

interface OCRResult {
  text: string;
  confidence: number;
  lines: string[];
}

type Logger = Pick<Console, 'error' | 'warn'>;

interface UrlAdapter {
  createObjectURL(file: File): string;
  revokeObjectURL(url: string): void;
}

type TesseractImporter = () => Promise<{ createWorker: (lang: string) => Promise<TesseractWorker> }>;

export interface OCRServiceOptions {
  logger?: Logger;
  urlAdapter?: UrlAdapter | null;
  tesseractLoader?: TesseractImporter;
}

export class OCRService {
  private tesseractLoaded = false;
  private tesseractWorker: TesseractWorker | null = null;
  private readonly logger: Logger;
  private readonly urlAdapter: UrlAdapter | null;
  private readonly tesseractLoader: TesseractImporter;

  constructor(options: OCRServiceOptions = {}) {
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? noop),
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop)
    };
    this.urlAdapter = options.urlAdapter ?? this.getBrowserUrlAdapter();
    this.tesseractLoader = options.tesseractLoader ?? (() => import('tesseract.js'));
  }

  private getBrowserUrlAdapter(): UrlAdapter | null {
    if (typeof URL === 'undefined' || !URL.createObjectURL || !URL.revokeObjectURL) {
      return null;
    }
    return {
      createObjectURL: URL.createObjectURL.bind(URL),
      revokeObjectURL: URL.revokeObjectURL.bind(URL)
    };
  }

  async initialize() {
    if (this.tesseractLoaded) return;

    try {
      // Dynamically import Tesseract.js to avoid bundling it if not used
      const tesseractModule = await this.tesseractLoader();
      this.tesseractWorker = await tesseractModule.createWorker('eng');

      if (this.tesseractWorker) {
        await this.tesseractWorker.loadLanguage('eng');
        await this.tesseractWorker.initialize('eng');
      }
      
      this.tesseractLoaded = true;
    } catch (error) {
      this.logger.error('Failed to initialize OCR:', error as Error);
      throw new Error('OCR initialization failed');
    }
  }

  async extractTextFromImage(imageUrl: string): Promise<OCRResult> {
    await this.initialize();

    try {
      if (!this.tesseractWorker) {
        throw new Error('OCR worker not initialized');
      }
      const { data } = await this.tesseractWorker.recognize(imageUrl);
      
      return {
        text: data.text,
        confidence: data.confidence / 100, // Convert to 0-1 range
        lines: data.lines.map((line: TesseractLine) => line.text)
      };
    } catch (error) {
      this.logger.error('OCR extraction failed:', error as Error);
      throw new Error('Failed to extract text from image');
    }
  }

  async extractDataFromDocument(file: File): Promise<ExtractedData> {
    // For PDFs, we would need a different approach (pdf.js)
    if (file.type === 'application/pdf') {
      return this.extractDataFromPDF(file);
    }

    // For images, use Tesseract.js
    if (file.type.startsWith('image/')) {
      if (!this.urlAdapter) {
        this.logger.warn('Image OCR unavailable: URL.createObjectURL not supported in this environment.');
        return { confidence: 0, rawText: '', error: 'Image OCR not supported' };
      }

      const imageUrl = this.urlAdapter.createObjectURL(file);
      try {
        const ocrResult = await this.extractTextFromImage(imageUrl);
        const extractedData = this.parseReceiptText(ocrResult.text, ocrResult.lines);
        
        return {
          ...extractedData,
          confidence: ocrResult.confidence,
          rawText: ocrResult.text
        };
      } finally {
        this.urlAdapter.revokeObjectURL(imageUrl);
      }
    }

    // For other file types, return minimal data
    return {
      confidence: 0,
      rawText: ''
    };
  }

  private parseReceiptText(text: string, lines: string[]): Partial<ExtractedData> {
    const data: Partial<ExtractedData> = {};
    
    // Extract merchant name (usually one of the first lines)
    const merchantPatterns = [
      /^([A-Z][A-Za-z\s&'-]+)$/m, // All caps or title case at start
      /(?:from|at|@)\s+([A-Za-z\s&'-]+)/i, // After "from" or "at"
    ];
    
    for (const pattern of merchantPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.merchant = match[1].trim();
        break;
      }
    }

    // Extract date
    const datePatterns = [
      /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
      /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i,
      /(?:Date|DATE|Date:)\s*([^\n]+)/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const dateStr = match[1].trim();
        const parsedDate = this.parseDate(dateStr);
        if (parsedDate) {
          data.date = parsedDate;
          break;
        }
      }
    }

    // Extract amounts
    const amountPatterns = [
      /(?:Total|TOTAL|Total:)\s*[£$€]?\s*(\d+[.,]\d{2})/i,
      /(?:Amount|AMOUNT|Amount:)\s*[£$€]?\s*(\d+[.,]\d{2})/i,
      /(?:Grand Total|GRAND TOTAL):\s*[£$€]?\s*(\d+[.,]\d{2})/i,
      /[£$€]\s*(\d+[.,]\d{2})(?:\s|$)/g, // Any currency amounts
    ];

    const amounts: number[] = [];
    for (const pattern of amountPatterns) {
      const matches = text.matchAll(pattern instanceof RegExp && pattern.global ? pattern : new RegExp(pattern, 'g'));
      for (const match of matches) {
        const amount = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(amount)) {
          amounts.push(amount);
        }
      }
    }

    // The largest amount is likely the total
    if (amounts.length > 0) {
      data.totalAmount = Math.max(...amounts);
    }

    // Extract tax amount
    const taxPatterns = [
      /(?:Tax|TAX|VAT|GST)\s*[£$€]?\s*(\d+[.,]\d{2})/i,
      /(?:Sales Tax|SALES TAX):\s*[£$€]?\s*(\d+[.,]\d{2})/i,
    ];

    for (const pattern of taxPatterns) {
      const match = text.match(pattern);
      if (match) {
        const taxAmount = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(taxAmount)) {
          data.taxAmount = taxAmount;
          break;
        }
      }
    }

    // Extract currency
    const currencyMatch = text.match(/[£$€]/);
    if (currencyMatch) {
      switch (currencyMatch[0]) {
        case '£': data.currency = 'GBP'; break;
        case '$': data.currency = 'USD'; break;
        case '€': data.currency = 'EUR'; break;
      }
    }

    // Extract line items (basic implementation)
    data.items = this.extractLineItems(lines);

    // Extract payment method
    const paymentPatterns = [
      /(?:paid by|payment method|pay by):\s*([^\n]+)/i,
      /(?:VISA|MASTERCARD|AMEX|CASH|DEBIT|CREDIT)(?:\s*CARD)?/i,
      /\*{4}\s*\d{4}/, // Masked card number
    ];

    for (const pattern of paymentPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.paymentMethod = match[0].trim();
        break;
      }
    }

    return data;
  }

  private extractLineItems(lines: string[]): ExtractedItem[] {
    const items: ExtractedItem[] = [];
    
    // Look for lines that appear to be items with prices
    const itemPattern = /^(.+?)\s+[£$€]?\s*(\d+[.,]\d{2})$/;
    const quantityPattern = /(\d+)\s*[xX@]\s*[£$€]?\s*(\d+[.,]\d{2})/;

    for (const line of lines) {
      const itemMatch = line.match(itemPattern);
      if (itemMatch) {
        const description = itemMatch[1].trim();
        const price = parseFloat(itemMatch[2].replace(',', '.'));
        
        // Check if line contains quantity information
        const qtyMatch = line.match(quantityPattern);
        if (qtyMatch) {
          items.push({
            description: description.replace(qtyMatch[0], '').trim(),
            quantity: parseInt(qtyMatch[1]),
            unitPrice: parseFloat(qtyMatch[2].replace(',', '.')),
            totalPrice: price
          });
        } else {
          items.push({
            description,
            totalPrice: price
          });
        }
      }
    }

    return items;
  }

  private parseDate(dateStr: string): Date | undefined {
    // Try different date formats
    const formats = [
      // US format: MM/DD/YYYY or MM-DD-YYYY
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/,
      // UK format: DD/MM/YYYY or DD-MM-YYYY
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/,
      // Text format: 15 Jan 2024
      /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/,
    ];

    // Try parsing with Date constructor first
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Try manual parsing for ambiguous formats
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        // For DD/MM vs MM/DD ambiguity, we'll default to UK format (DD/MM)
        // In a real app, this should be configurable based on user locale
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // JavaScript months are 0-indexed
        const year = parseInt(match[3]);
        
        const date = new Date(year < 100 ? 2000 + year : year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return undefined;
  }

  private async extractDataFromPDF(file: File): Promise<ExtractedData> {
    // This is a placeholder for PDF extraction
    // In a real implementation, you would use pdf.js or a similar library
    this.logger.warn('PDF extraction not yet implemented');
    
    return {
      confidence: 0,
      rawText: 'PDF extraction not yet implemented'
    };
  }

  async cleanup() {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
      this.tesseractLoaded = false;
    }
  }
}

// Export singleton instance
export const ocrService = new OCRService();

type PerformOCRLogger = Pick<Console, 'error'>;

// Export function to use in document service
export async function performOCR(
  file: File,
  options: { service?: OCRService; logger?: PerformOCRLogger } = {}
): Promise<ExtractedData> {
  const service = options.service ?? ocrService;
  const fallbackLogger = options.logger ?? (typeof console !== 'undefined' ? console : undefined);

  try {
    return await service.extractDataFromDocument(file);
  } catch (error) {
    fallbackLogger?.error?.('OCR failed:', error);
    // Return minimal data on error
    return {
      confidence: 0,
      rawText: '',
      error: error instanceof Error ? error.message : 'OCR extraction failed'
    };
  }
}
