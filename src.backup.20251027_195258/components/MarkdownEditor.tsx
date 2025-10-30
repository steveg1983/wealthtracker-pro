import React, { useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { 
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  EyeIcon,
  EditIcon,
  CodeIcon,
  QuoteIcon,
} from './icons';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxHeight?: string;
  showPreview?: boolean;
  className?: string;
}

export default function MarkdownEditor({ 
  value, 
  onChange, 
  placeholder = "Enter your notes...",
  maxHeight = "200px",
  showPreview = true,
  className = ""
}: MarkdownEditorProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Simple markdown to HTML converter with sanitization
  const parseMarkdown = (text: string): string => {
    // First convert markdown to HTML
    const html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-3">$1</h1>')
      
      // Bold and Italic
      .replace(/\*\*\*(.*)\*\*\*/gim, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      
      // Code
      .replace(/`([^`]+)`/gim, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>')
      
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-gray-600 dark:text-gray-500 hover:underline">$1</a>')
      
      // Lists
      .replace(/^\* (.+)$/gim, '<li class="ml-4">• $1</li>')
      .replace(/^- (.+)$/gim, '<li class="ml-4">• $1</li>')
      
      // Blockquotes
      .replace(/^> (.+)$/gim, '<blockquote class="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400">$1</blockquote>')
      
      // Line breaks
      .replace(/\n/gim, '<br>');
    
    // Sanitize the HTML to prevent XSS
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'br', 'strong', 'em', 'code', 'a', 'li', 'blockquote'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      ALLOW_DATA_ATTR: false
    });
  };

  const insertText = (before: string, after: string = '', placeholder: string = ''): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const newValue = 
      value.substring(0, start) + 
      before + textToInsert + after + 
      value.substring(end);
    
    onChange(newValue);

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      const newStart = start + before.length;
      const newEnd = newStart + textToInsert.length;
      textarea.setSelectionRange(newStart, newEnd);
    }, 0);
  };

  const formatButtons = [
    {
      icon: <BoldIcon size={14} />,
      title: 'Bold',
      action: () => insertText('**', '**', 'bold text')
    },
    {
      icon: <ItalicIcon size={14} />,
      title: 'Italic', 
      action: () => insertText('*', '*', 'italic text')
    },
    {
      icon: <CodeIcon size={14} />,
      title: 'Code',
      action: () => insertText('`', '`', 'code')
    },
    {
      icon: <LinkIcon size={14} />,
      title: 'Link',
      action: () => insertText('[', '](url)', 'link text')
    },
    {
      icon: <ListIcon size={14} />,
      title: 'List',
      action: () => insertText('- ', '', 'list item')
    },
    {
      icon: <QuoteIcon size={14} />,
      title: 'Quote',
      action: () => insertText('> ', '', 'quote')
    }
  ];

  return (
    <div className={`markdown-editor border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b border-gray-300 dark:border-gray-600">
        <div className="flex items-center gap-1">
          {formatButtons.map((button, index) => (
            <button
              key={index}
              onClick={button.action}
              title={button.title}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              {button.icon}
            </button>
          ))}
        </div>
        
        {showPreview && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsPreviewMode(false)}
              className={`p-1.5 rounded text-sm ${
                !isPreviewMode 
                  ? 'bg-blue-100 dark:bg-gray-900/30 text-blue-700 dark:text-gray-300' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <EditIcon size={14} />
            </button>
            <button
              onClick={() => setIsPreviewMode(true)}
              className={`p-1.5 rounded text-sm ${
                isPreviewMode 
                  ? 'bg-blue-100 dark:bg-gray-900/30 text-blue-700 dark:text-gray-300' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <EyeIcon size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Editor/Preview */}
      <div className="relative">
        {isPreviewMode && showPreview ? (
          <div 
            className="p-3 min-h-[100px] prose prose-sm max-w-none dark:prose-invert"
            style={{ maxHeight }}
          >
            {value ? (
              <div dangerouslySetInnerHTML={{ __html: parseMarkdown(value) }} />
            ) : (
              <p className="text-gray-500 dark:text-gray-400 italic">Nothing to preview...</p>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full p-3 border-none resize-none focus:outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            style={{ 
              maxHeight,
              minHeight: '100px'
            }}
          />
        )}
      </div>

      {/* Help Text */}
      <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-300 dark:border-gray-600">
        <div className="flex flex-wrap gap-4">
          <span>**bold**</span>
          <span>*italic*</span>
          <span>`code`</span>
          <span>[link](url)</span>
          <span>- list</span>
          <span>&gt; quote</span>
        </div>
      </div>
    </div>
  );
}
