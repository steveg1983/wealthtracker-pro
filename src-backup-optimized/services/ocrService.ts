/**
 * OCR Service - Optical Character Recognition for document processing
 *
 * Features:
 * - Receipt text extraction
 * - Bank statement parsing
 * - Invoice processing
 * - Multi-format document support
 * - Confidence scoring
 */

import { lazyLogger } from './serviceFactory';

const logger = lazyLogger.getLogger('OCRService');

export interface OCRResult {
  id: string;
  text: string;
  confidence: number;
  words: OCRWord[];
  lines: OCRLine[];
  blocks: OCRBlock[];
  processing_time_ms: number;
  detected_language?: string;
  extracted_data?: ExtractedData;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bounding_box: BoundingBox;
  font_size?: number;
  font_family?: string;
  is_bold?: boolean;
  is_italic?: boolean;
}

export interface OCRLine {
  text: string;
  confidence: number;
  bounding_box: BoundingBox;
  words: OCRWord[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bounding_box: BoundingBox;
  lines: OCRLine[];
  block_type: 'text' | 'table' | 'image' | 'header' | 'footer';
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedData {
  document_type: 'receipt' | 'bank_statement' | 'invoice' | 'tax_document' | 'unknown';
  merchant_name?: string;
  transaction_date?: string;
  total_amount?: number;
  tax_amount?: number;
  items?: LineItem[];
  account_info?: AccountInfo;
  structured_data?: Record<string, any>;
}

export interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total_price: number;
  category?: string;
}

export interface AccountInfo {
  account_number?: string;
  bank_name?: string;
  statement_period?: {
    start_date: string;
    end_date: string;
  };
  opening_balance?: number;
  closing_balance?: number;
}

export interface OCROptions {
  language?: string;
  extract_structured_data?: boolean;
  min_confidence?: number;
  preprocess_image?: boolean;
  detect_tables?: boolean;
  enhance_contrast?: boolean;
}

class OCRService {
  private static instance: OCRService;
  private apiKey: string | null = null;
  private apiEndpoint: string = 'https://api.ocr.example.com/v1';

  private constructor() {
    // Initialize OCR service
    this.apiKey = process.env.VITE_OCR_API_KEY || null;
    logger.info('OCRService initialized');
  }

  public static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  // Document Text Extraction
  public static async extractText(
    file: File,
    options: OCROptions = {}
  ): Promise<OCRResult> {
    const startTime = Date.now();
    logger.info('Starting OCR text extraction', {
      fileName: file.name,
      fileSize: file.size,
      options
    });

    try {
      // Mock OCR processing
      const mockResult: OCRResult = {
        id: `ocr-${Date.now()}`,
        text: await this.mockTextExtraction(file),
        confidence: 0.92,
        words: [],
        lines: [],
        blocks: [],
        processing_time_ms: Date.now() - startTime,
        detected_language: options.language || 'en',
        extracted_data: options.extract_structured_data
          ? await this.mockDataExtraction(file)
          : undefined
      };

      // Generate mock word-level data if high confidence
      if (mockResult.confidence > (options.min_confidence || 0.8)) {
        mockResult.words = this.generateMockWords(mockResult.text);
        mockResult.lines = this.generateMockLines(mockResult.words);
        mockResult.blocks = this.generateMockBlocks(mockResult.lines);
      }

      logger.info('OCR extraction completed', {
        textLength: mockResult.text.length,
        confidence: mockResult.confidence,
        processingTime: mockResult.processing_time_ms
      });

      return mockResult;
    } catch (error) {
      logger.error('Error during OCR extraction:', error);
      throw new Error('Failed to extract text from document');
    }
  }

  // Receipt Processing
  public static async processReceipt(file: File): Promise<OCRResult> {
    logger.info('Processing receipt', { fileName: file.name });

    try {
      const options: OCROptions = {
        extract_structured_data: true,
        detect_tables: true,
        enhance_contrast: true,
        min_confidence: 0.8
      };

      const result = await this.extractText(file, options);

      // Enhanced receipt processing
      if (result.extracted_data) {
        result.extracted_data = {
          ...result.extracted_data,
          document_type: 'receipt',
          merchant_name: this.extractMerchantName(result.text),
          transaction_date: this.extractDate(result.text),
          total_amount: this.extractTotal(result.text),
          tax_amount: this.extractTax(result.text),
          items: this.extractLineItems(result.text)
        };
      }

      return result;
    } catch (error) {
      logger.error('Error processing receipt:', error);
      throw error;
    }
  }

  // Bank Statement Processing
  public static async processBankStatement(file: File): Promise<OCRResult> {
    logger.info('Processing bank statement', { fileName: file.name });

    try {
      const options: OCROptions = {
        extract_structured_data: true,
        detect_tables: true,
        min_confidence: 0.85
      };

      const result = await this.extractText(file, options);

      // Enhanced bank statement processing
      if (result.extracted_data) {
        result.extracted_data = {
          ...result.extracted_data,
          document_type: 'bank_statement',
          account_info: {
            account_number: this.extractAccountNumber(result.text),
            bank_name: this.extractBankName(result.text),
            statement_period: this.extractStatementPeriod(result.text),
            opening_balance: this.extractOpeningBalance(result.text),
            closing_balance: this.extractClosingBalance(result.text)
          }
        };
      }

      return result;
    } catch (error) {
      logger.error('Error processing bank statement:', error);
      throw error;
    }
  }

  // Invoice Processing
  public static async processInvoice(file: File): Promise<OCRResult> {
    logger.info('Processing invoice', { fileName: file.name });

    try {
      const options: OCROptions = {
        extract_structured_data: true,
        detect_tables: true,
        min_confidence: 0.8
      };

      const result = await this.extractText(file, options);

      // Enhanced invoice processing
      if (result.extracted_data) {
        result.extracted_data = {
          ...result.extracted_data,
          document_type: 'invoice',
          merchant_name: this.extractMerchantName(result.text),
          transaction_date: this.extractDate(result.text),
          total_amount: this.extractTotal(result.text),
          tax_amount: this.extractTax(result.text),
          items: this.extractLineItems(result.text)
        };
      }

      return result;
    } catch (error) {
      logger.error('Error processing invoice:', error);
      throw error;
    }
  }

  // Batch Processing
  public static async processMultipleDocuments(
    files: File[],
    options: OCROptions = {}
  ): Promise<OCRResult[]> {
    logger.info('Processing multiple documents', { fileCount: files.length });

    try {
      const results = await Promise.all(
        files.map(file => this.extractText(file, options))
      );

      logger.info('Batch processing completed', {
        totalFiles: files.length,
        successfulExtractions: results.length
      });

      return results;
    } catch (error) {
      logger.error('Error during batch processing:', error);
      throw error;
    }
  }

  // Mock Implementation Helpers
  private static async mockTextExtraction(file: File): Promise<string> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    const fileName = file.name.toLowerCase();

    if (fileName.includes('receipt')) {
      return `SUPERMARKET RECEIPT
Date: 2024-01-15
Time: 14:23

GROCERIES
Milk - 2L          £3.50
Bread - White      £1.20
Eggs - 12 pack     £2.80
Chicken Breast     £8.90

Subtotal:         £16.40
Tax (VAT 20%):     £3.28
TOTAL:            £19.68

Payment Method: Card
Card Number: ****1234

Thank you for shopping with us!`;
    }

    if (fileName.includes('statement') || fileName.includes('bank')) {
      return `BANK STATEMENT
XYZ Bank Ltd
Account: 12345678
Statement Period: 01/01/2024 - 31/01/2024

Opening Balance:  £1,250.00

TRANSACTIONS:
15/01  Supermarket      -£19.68
16/01  Salary Deposit  +£2,500.00
18/01  Utility Bill    -£89.50
20/01  ATM Withdrawal  -£50.00

Closing Balance:  £3,590.82`;
    }

    if (fileName.includes('invoice')) {
      return `INVOICE #INV-2024-001
ABC Services Ltd

Bill To:
John Smith
123 Main Street
City, ST 12345

Date: 2024-01-15
Due Date: 2024-02-15

Description          Qty    Rate      Amount
Consulting Services    8    £150.00   £1,200.00
Travel Expenses        1     £89.50     £89.50

Subtotal:                              £1,289.50
VAT (20%):                              £257.90
TOTAL:                                £1,547.40`;
    }

    // Generic document text
    return `This is a sample document that has been processed by OCR.
The system has extracted this text from the uploaded file.
Processing confidence is high and the text should be accurate.`;
  }

  private static async mockDataExtraction(file: File): Promise<ExtractedData> {
    const fileName = file.name.toLowerCase();

    if (fileName.includes('receipt')) {
      return {
        document_type: 'receipt',
        merchant_name: 'Supermarket',
        transaction_date: '2024-01-15',
        total_amount: 19.68,
        tax_amount: 3.28,
        items: [
          { description: 'Milk - 2L', quantity: 1, unit_price: 3.50, total_price: 3.50 },
          { description: 'Bread - White', quantity: 1, unit_price: 1.20, total_price: 1.20 },
          { description: 'Eggs - 12 pack', quantity: 1, unit_price: 2.80, total_price: 2.80 },
          { description: 'Chicken Breast', quantity: 1, unit_price: 8.90, total_price: 8.90 }
        ]
      };
    }

    if (fileName.includes('statement') || fileName.includes('bank')) {
      return {
        document_type: 'bank_statement',
        account_info: {
          account_number: '12345678',
          bank_name: 'XYZ Bank Ltd',
          statement_period: {
            start_date: '2024-01-01',
            end_date: '2024-01-31'
          },
          opening_balance: 1250.00,
          closing_balance: 3590.82
        }
      };
    }

    if (fileName.includes('invoice')) {
      return {
        document_type: 'invoice',
        merchant_name: 'ABC Services Ltd',
        transaction_date: '2024-01-15',
        total_amount: 1547.40,
        tax_amount: 257.90,
        items: [
          { description: 'Consulting Services', quantity: 8, unit_price: 150.00, total_price: 1200.00 },
          { description: 'Travel Expenses', quantity: 1, unit_price: 89.50, total_price: 89.50 }
        ]
      };
    }

    return {
      document_type: 'unknown',
      structured_data: {}
    };
  }

  private static generateMockWords(text: string): OCRWord[] {
    return text.split(/\s+/).map((word, index) => ({
      text: word,
      confidence: 0.88 + Math.random() * 0.12,
      bounding_box: {
        x: (index % 10) * 50,
        y: Math.floor(index / 10) * 20,
        width: word.length * 8,
        height: 16
      }
    }));
  }

  private static generateMockLines(words: OCRWord[]): OCRLine[] {
    const lines: OCRLine[] = [];
    let currentLine: OCRWord[] = [];
    let currentY = -1;

    words.forEach(word => {
      if (currentY === -1 || Math.abs(word.bounding_box.y - currentY) < 5) {
        currentLine.push(word);
        currentY = word.bounding_box.y;
      } else {
        if (currentLine.length > 0) {
          lines.push(this.createLineFromWords(currentLine));
        }
        currentLine = [word];
        currentY = word.bounding_box.y;
      }
    });

    if (currentLine.length > 0) {
      lines.push(this.createLineFromWords(currentLine));
    }

    return lines;
  }

  private static createLineFromWords(words: OCRWord[]): OCRLine {
    const text = words.map(w => w.text).join(' ');
    const avgConfidence = words.reduce((sum, w) => sum + w.confidence, 0) / words.length;

    const minX = Math.min(...words.map(w => w.bounding_box.x));
    const maxX = Math.max(...words.map(w => w.bounding_box.x + w.bounding_box.width));
    const minY = Math.min(...words.map(w => w.bounding_box.y));
    const maxY = Math.max(...words.map(w => w.bounding_box.y + w.bounding_box.height));

    return {
      text,
      confidence: avgConfidence,
      bounding_box: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      },
      words
    };
  }

  private static generateMockBlocks(lines: OCRLine[]): OCRBlock[] {
    // Group lines into blocks (simplified - just one block for all text)
    if (lines.length === 0) return [];

    const text = lines.map(l => l.text).join('\n');
    const avgConfidence = lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length;

    const minX = Math.min(...lines.map(l => l.bounding_box.x));
    const maxX = Math.max(...lines.map(l => l.bounding_box.x + l.bounding_box.width));
    const minY = Math.min(...lines.map(l => l.bounding_box.y));
    const maxY = Math.max(...lines.map(l => l.bounding_box.y + l.bounding_box.height));

    return [{
      text,
      confidence: avgConfidence,
      bounding_box: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      },
      lines,
      block_type: 'text'
    }];
  }

  // Data extraction helpers (simplified mock implementations)
  private static extractMerchantName(text: string): string {
    const lines = text.split('\n');
    return lines[0] || 'Unknown Merchant';
  }

  private static extractDate(text: string): string {
    const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})/);
    return dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0];
  }

  private static extractTotal(text: string): number {
    const totalMatch = text.match(/TOTAL[:\s]*£?(\d+\.?\d*)/i);
    return totalMatch ? parseFloat(totalMatch[1]) : 0;
  }

  private static extractTax(text: string): number {
    const taxMatch = text.match(/(?:VAT|TAX)[:\s]*[(\[]?(\d+\.?\d*)[%\)]?[:\s]*£?(\d+\.?\d*)/i);
    return taxMatch ? parseFloat(taxMatch[2]) : 0;
  }

  private static extractLineItems(text: string): LineItem[] {
    // Simplified item extraction - would be more sophisticated in real implementation
    const lines = text.split('\n');
    const items: LineItem[] = [];

    lines.forEach(line => {
      const itemMatch = line.match(/^(.+?)\s+£?(\d+\.?\d*)$/);
      if (itemMatch && !line.match(/total|subtotal|tax|vat/i)) {
        items.push({
          description: itemMatch[1].trim(),
          total_price: parseFloat(itemMatch[2])
        });
      }
    });

    return items;
  }

  private static extractAccountNumber(text: string): string {
    const accountMatch = text.match(/Account[:\s]*(\d{8,})/i);
    return accountMatch ? accountMatch[1] : '';
  }

  private static extractBankName(text: string): string {
    const lines = text.split('\n');
    return lines.find(line => line.match(/bank/i)) || 'Unknown Bank';
  }

  private static extractStatementPeriod(text: string): { start_date: string; end_date: string } {
    const periodMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
    return periodMatch ? {
      start_date: periodMatch[1],
      end_date: periodMatch[2]
    } : {
      start_date: '2024-01-01',
      end_date: '2024-01-31'
    };
  }

  private static extractOpeningBalance(text: string): number {
    const balanceMatch = text.match(/Opening Balance[:\s]*£?(\d+,?\d*\.?\d*)/i);
    return balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : 0;
  }

  private static extractClosingBalance(text: string): number {
    const balanceMatch = text.match(/Closing Balance[:\s]*£?(\d+,?\d*\.?\d*)/i);
    return balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : 0;
  }
}

// Export standalone function for compatibility
export async function performOCR(file: File): Promise<OCRResult> {
  const service = new OCRService();
  return service.processDocument(file);
}

export default OCRService;