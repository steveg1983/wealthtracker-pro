import React, { useState } from 'react';
import { documentService } from '../services/documentService';
import type { ExtractedData } from '../services/documentService';
import { UploadIcon } from './icons';
import { useLogger } from '../services/ServiceProvider';

export default function OCRTest() {
  const logger = useLogger();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOCRProcess = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const result = await documentService.uploadDocument(selectedFile, {
        type: 'receipt',
        extractData: true
      });
      
      setExtractedData(result.extractedData || null);
    } catch (error) {
      logger.error('OCR processing failed:', error);
      alert('Failed to process image: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">OCR Test - Receipt Scanner</h2>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Upload Receipt Image</h3>
        
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="mb-4"
        />
        
        {imagePreview && (
          <div className="mb-4">
            <h4 className="font-medium mb-2">Preview:</h4>
            <img 
              src={imagePreview} 
              alt="Receipt preview" 
              className="max-w-md max-h-96 border rounded"
            />
          </div>
        )}
        
        <button
          onClick={handleOCRProcess}
          disabled={!selectedFile || isProcessing}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <UploadIcon size={20} />
          {isProcessing ? 'Processing...' : 'Process Receipt'}
        </button>
      </div>
      
      {extractedData && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Extracted Data</h3>
          
          <div className="space-y-2">
            {extractedData.merchant && (
              <div>
                <span className="font-medium">Merchant:</span> {extractedData.merchant}
              </div>
            )}
            {extractedData.date && (
              <div>
                <span className="font-medium">Date:</span> {new Date(extractedData.date).toLocaleDateString()}
              </div>
            )}
            {extractedData.totalAmount && (
              <div>
                <span className="font-medium">Total Amount:</span> {extractedData.currency || '$'}{extractedData.totalAmount}
              </div>
            )}
            {extractedData.taxAmount && (
              <div>
                <span className="font-medium">Tax:</span> {extractedData.currency || '$'}{extractedData.taxAmount}
              </div>
            )}
            {extractedData.paymentMethod && (
              <div>
                <span className="font-medium">Payment Method:</span> {extractedData.paymentMethod}
              </div>
            )}
            <div>
              <span className="font-medium">Confidence:</span> {Math.round(extractedData.confidence * 100)}%
            </div>
            {extractedData.error && (
              <div className="text-red-600">
                <span className="font-medium">Error:</span> {extractedData.error}
              </div>
            )}
          </div>
          
          {extractedData.items && extractedData.items.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Line Items:</h4>
              <ul className="space-y-1">
                {extractedData.items.map((item, index) => (
                  <li key={index} className="text-sm">
                    {item.description} - {extractedData.currency || '$'}{item.totalPrice || item.unitPrice}
                    {item.quantity && ` (${item.quantity} @ ${extractedData.currency || '$'}${item.unitPrice})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {extractedData.rawText && (
            <details className="mt-4">
              <summary className="cursor-pointer font-medium">Raw OCR Text</summary>
              <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto">
                {extractedData.rawText}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}