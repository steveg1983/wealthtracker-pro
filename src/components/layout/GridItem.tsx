import type { ReactNode } from 'react';

interface GridItemProps {
  title: string;
  children: ReactNode;
  key: string;
}

export function GridItem({ title, children }: GridItemProps) {
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 overflow-hidden h-full flex flex-col">
      <div className="drag-handle bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-gray-800/50 dark:to-gray-700/50 backdrop-blur-sm border-b border-blue-200/50 dark:border-gray-600/50 px-3 sm:px-4 py-2.5 sm:py-3">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <svg className="drag-handle-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 3h2v2H9V3zm4 0h2v2h-2V3zM9 7h2v2H9V7zm4 0h2v2h-2V7zM9 11h2v2H9v-2zm4 0h2v2h-2v-2zM9 15h2v2H9v-2zm4 0h2v2h-2v-2zM9 19h2v2H9v-2zm4 0h2v2h-2v-2z"/>
          </svg>
          <span className="text-base font-semibold text-white">{title}</span>
        </div>
      </div>
      <div className="grid-item-content p-3 sm:p-4 flex-1">
        {children}
      </div>
    </div>
  );
}