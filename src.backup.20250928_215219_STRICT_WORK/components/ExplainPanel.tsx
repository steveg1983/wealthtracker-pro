import React from 'react';
import ReactMarkdown from 'react-markdown';
import { XIcon, LightbulbIcon } from './icons';

interface ExplainPanelProps {
  isOpen: boolean;
  title: string;
  markdown: string;
  onClose: () => void;
}

export default function ExplainPanel({ isOpen, title, markdown, onClose }: ExplainPanelProps): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1" onClick={onClose} aria-hidden />
      <aside
        className="w-full sm:w-[480px] h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 p-5 overflow-y-auto"
        aria-label="Explain this page"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <LightbulbIcon size={20} className="text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            aria-label="Close explanation"
          >
            <XIcon size={18} />
          </button>
        </div>
        <div className="prose dark:prose-invert max-w-none">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      </aside>
    </div>
  );
}

