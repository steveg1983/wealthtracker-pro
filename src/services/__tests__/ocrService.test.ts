import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRService, performOCR } from '../ocrService';
import type { TesseractWorker } from '../../types/tesseract';

const createFile = (type = 'image/png') => new File(['receipt data'], 'receipt.png', { type });

const createWorker = () => {
  const worker: TesseractWorker = {
    loadLanguage: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    recognize: vi.fn().mockResolvedValue({
      data: {
        text: 'Total: $12.34',
        confidence: 95,
        lines: [{ text: 'Coffee $12.34' }]
      }
    }),
    terminate: vi.fn().mockResolvedValue(undefined)
  } as unknown as TesseractWorker;
  return worker;
};

describe('OCRService (deterministic)', () => {
  const logger = { warn: vi.fn(), error: vi.fn() };
  const urlAdapter = {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn()
  };
  let worker: TesseractWorker;
  let tesseractLoader: () => Promise<{ createWorker: () => Promise<TesseractWorker> }>;

  beforeEach(() => {
    logger.warn.mockReset();
    logger.error.mockReset();
    urlAdapter.createObjectURL.mockClear();
    urlAdapter.revokeObjectURL.mockClear();
    worker = createWorker();
    tesseractLoader = vi.fn(async () => ({
      createWorker: vi.fn().mockResolvedValue(worker)
    }));
  });

  it('extracts data from images using injected URL/Tesseract adapters', async () => {
    const service = new OCRService({
      logger,
      urlAdapter,
      tesseractLoader
    });

    const result = await service.extractDataFromDocument(createFile());

    expect(urlAdapter.createObjectURL).toHaveBeenCalledTimes(1);
    expect(urlAdapter.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(worker.recognize).toHaveBeenCalledWith('blob:test');
    expect(result.rawText).toBe('Total: $12.34');
    expect(result.totalAmount).toBe(12.34);
    expect(result.confidence).toBeCloseTo(0.95, 5);
  });

  it('gracefully skips OCR when URL APIs are unavailable', async () => {
    const service = new OCRService({
      logger,
      urlAdapter: null,
      tesseractLoader
    });

    const result = await service.extractDataFromDocument(createFile());
    expect(result.confidence).toBe(0);
    expect(result.error).toBe('Image OCR not supported');
    expect(logger.warn).toHaveBeenCalledWith(
      'Image OCR unavailable: URL.createObjectURL not supported in this environment.'
    );
    expect(tesseractLoader).not.toHaveBeenCalled();
  });

  it('exposes performOCR helper that logs failures via injected logger', async () => {
    const failingService = {
      extractDataFromDocument: vi.fn().mockRejectedValue(new Error('boom'))
    } as unknown as OCRService;
    const errorLogger = { error: vi.fn() };

    const result = await performOCR(createFile(), { service: failingService, logger: errorLogger });

    expect(result.error).toBe('boom');
    expect(errorLogger.error).toHaveBeenCalledWith('OCR failed:', expect.any(Error));
  });
});
