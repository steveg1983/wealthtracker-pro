import React, { useState, useRef, useCallback } from 'react';
import { documentService } from '../services/documentService';
import type { Document, DocumentUploadOptions } from '../services/documentService';
import {
  UploadIcon,
  FileTextIcon,
  CameraIcon,
  XIcon,
  CheckIcon,
  ImageIcon,
  TagIcon,
  RefreshCwIcon,
  PaperclipIcon
} from './icons';

interface DocumentUploadProps {
  transactionId?: string;
  accountId?: string;
  onUploadComplete?: (document: Document) => void;
  onClose?: () => void;
  compact?: boolean;
}

export default function DocumentUpload({
  transactionId,
  accountId,
  onUploadComplete,
  onClose,
  compact = false
}: DocumentUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadedDocs, setUploadedDocs] = useState<Document[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [documentType, setDocumentType] = useState<Document['type']>('receipt');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [extractData, setExtractData] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prevFiles => [...prevFiles, ...files]);
    
    // Reset file input to allow selecting the same file again
    if (event.target) {
      event.target.value = '';
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    setSelectedFiles(prevFiles => [...prevFiles, ...files]);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
    const fileName = selectedFiles[index].name;
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fileName];
      return newErrors;
    });
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setErrors({});
    const newUploadedDocs: Document[] = [];

    for (const file of selectedFiles) {
      try {
        // Update progress
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: Math.min((prev[file.name] || 0) + 10, 90)
          }));
        }, 100);

        const uploadOptions: DocumentUploadOptions = {
          transactionId,
          accountId,
          type: documentType,
          tags,
          notes,
          extractData
        };

        const document = await documentService.uploadDocument(file, uploadOptions);
        
        clearInterval(progressInterval);
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        
        newUploadedDocs.push(document);
        
        if (onUploadComplete) {
          onUploadComplete(document);
        }
      } catch (error) {
        setErrors(prev => ({
          ...prev,
          [file.name]: error instanceof Error ? error.message : 'Upload failed'
        }));
      }
    }

    setUploadedDocs(prev => [...prev, ...newUploadedDocs]);
    setSelectedFiles([]);
    setUploading(false);
    
    // Clear progress after a delay
    setTimeout(() => {
      setUploadProgress({});
    }, 1000);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon size={20} className="text-blue-600" />;
    }
    if (mimeType === 'application/pdf') {
      return <FileTextIcon size={20} className="text-red-600" />;
    }
    return <FileTextIcon size={20} className="text-gray-600" />;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFileSelection}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <PaperclipIcon size={16} />
          Attach
        </button>
        {uploadedDocs.length > 0 && (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {uploadedDocs.length} file{uploadedDocs.length > 1 ? 's' : ''} attached
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <UploadIcon size={48} className="mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Drop files here or click to browse
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Supported: Images, PDFs, Word docs, Excel files (max 10MB)
        </p>
        <div className="flex items-center justify-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelection}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <UploadIcon size={16} />
            Select Files
          </button>
          <button
            onClick={() => {
              // TODO: Implement camera capture for mobile
              alert('Camera capture coming soon!');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <CameraIcon size={16} />
            Take Photo
          </button>
        </div>
      </div>

      {/* Document Options */}
      {selectedFiles.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as Document['type'])}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="receipt">Receipt</option>
              <option value="invoice">Invoice</option>
              <option value="statement">Statement</option>
              <option value="contract">Contract</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                >
                  <TagIcon size={12} />
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-600"
                  >
                    <XIcon size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
              <button
                onClick={addTag}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about these documents..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              rows={2}
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={extractData}
              onChange={(e) => setExtractData(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Extract data from documents (OCR)
            </span>
          </label>
        </div>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-900 dark:text-white">
            Selected Files ({selectedFiles.length})
          </h3>
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-center gap-3">
                {getFileIcon(file.type)}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {uploadProgress[file.name] !== undefined && (
                  <div className="w-20">
                    <div className="h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${uploadProgress[file.name]}%` }}
                      />
                    </div>
                  </div>
                )}
                {errors[file.name] && (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    {errors[file.name]}
                  </span>
                )}
                {!uploading && (
                  <button
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <XIcon size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Documents */}
      {uploadedDocs.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <CheckIcon size={16} className="text-green-600" />
            Uploaded Documents ({uploadedDocs.length})
          </h3>
          {uploadedDocs.map(doc => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700"
            >
              <div className="flex items-center gap-3">
                {getFileIcon(doc.mimeType)}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {doc.fileName}
                  </p>
                  {doc.extractedData && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {doc.extractedData.merchant && `Merchant: ${doc.extractedData.merchant}`}
                      {doc.extractedData.totalAmount && ` • £${doc.extractedData.totalAmount}`}
                    </p>
                  )}
                </div>
              </div>
              <CheckIcon size={20} className="text-green-600" />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={() => {
            setSelectedFiles([]);
            setUploadedDocs([]);
            setErrors({});
            setUploadProgress({});
          }}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Clear All
        </button>
        <div className="flex gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
          )}
          <button
            onClick={uploadFiles}
            disabled={selectedFiles.length === 0 || uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? (
              <>
                <RefreshCwIcon size={16} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadIcon size={16} />
                Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
