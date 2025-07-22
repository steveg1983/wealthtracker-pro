// Type definitions for Tesseract.js

export interface TesseractWorker {
  loadLanguage(lang: string): Promise<void>;
  initialize(lang: string): Promise<void>;
  recognize(image: string | File | Blob | HTMLImageElement | HTMLCanvasElement): Promise<TesseractResult>;
  terminate(): Promise<void>;
}

export interface TesseractResult {
  data: {
    text: string;
    confidence: number;
    lines: TesseractLine[];
    words: TesseractWord[];
    blocks: TesseractBlock[];
  };
}

export interface TesseractLine {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  words: TesseractWord[];
}

export interface TesseractWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface TesseractBlock {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TesseractLogMessage {
  status: string;
  progress: number;
  userJobId?: string;
}

export interface TesseractCreateWorkerOptions {
  logger?: (message: TesseractLogMessage) => void;
  errorHandler?: (error: Error) => void;
}