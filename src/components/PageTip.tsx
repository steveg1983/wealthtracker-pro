import { useState } from 'react';
import { XIcon } from './icons';

interface PageTipProps {
  id: string;
  title: string;
  description: string;
  learnMoreUrl?: string;
}

export default function PageTip({ id, title, description, learnMoreUrl }: PageTipProps): React.JSX.Element | null {
  const storageKey = `pageTipDismissed_${id}`;
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(storageKey) === 'true';
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(storageKey, 'true');
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 md:bottom-4 md:left-auto md:right-4 md:max-w-lg">
      <div className="bg-[#1a2332] text-white p-4 md:rounded-xl shadow-xl border border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-1">{title}</h4>
            <p className="text-xs text-white/70 leading-relaxed">{description}</p>
            {learnMoreUrl && (
              <a
                href={learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-xs text-amber-400 hover:text-amber-300 font-medium"
              >
                Learn more
              </a>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
            aria-label="Dismiss tip"
          >
            <XIcon size={16} className="text-white/60" />
          </button>
        </div>
      </div>
    </div>
  );
}
