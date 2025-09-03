import React from 'react';
import DOMPurify from 'dompurify';

interface MarkdownNoteProps {
  content: string;
  className?: string;
}

// Simple markdown to HTML converter with sanitization
const parseMarkdown = (text: string): string => {
  // First convert markdown to HTML
  const html = text
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-2 text-gray-900 dark:text-white">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-3 text-gray-900 dark:text-white">$1</h1>')
    
    // Bold and Italic
    .replace(/\*\*\*(.*)\*\*\*/gim, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*)\*\*/gim, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.*)\*/gim, '<em class="italic">$1</em>')
    
    // Code
    .replace(/`([^`]+)`/gim, '<code class="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
    
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-gray-600 dark:text-gray-500 hover:underline">$1</a>')
    
    // Lists
    .replace(/^[*-] (.+)$/gim, '<li class="ml-4 mb-1">• $1</li>')
    
    // Blockquotes
    .replace(/^> (.+)$/gim, '<blockquote class="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 mb-2">$1</blockquote>')
    
    // Line breaks
    .replace(/\n/gim, '<br>');
  
  // Sanitize the HTML to prevent XSS
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'br', 'strong', 'em', 'code', 'a', 'li', 'blockquote'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false
  });
};

export default function MarkdownNote({ content, className = '' }: MarkdownNoteProps) {
  if (!content || content.trim() === '') {
    return null;
  }

  return (
    <div 
      className={`markdown-content prose prose-sm max-w-none dark:prose-invert text-gray-700 dark:text-gray-300 ${className}`}
      dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
    />
  );
}