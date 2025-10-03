import React from 'react';
import { LightbulbIcon } from './icons';

export interface ExplainPayload {
  title?: string;
  signals?: Record<string, string | number | boolean | undefined>;
}

export default function ExplainThisButton({ title, signals }: ExplainPayload): React.JSX.Element {
  const handleClick = () => {
    const detail = {
      route: window.location.pathname,
      title: title || document.title || 'This Page',
      signals: signals || {},
    };
    window.dispatchEvent(new CustomEvent('open-explain', { detail }));
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
      title="Explain this page"
      aria-label="Explain this page"
    >
      <LightbulbIcon size={16} />
      <span className="text-sm font-medium">Explain</span>
    </button>
  );
}

