import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export function SectionCard({ 
  title, 
  icon, 
  children, 
  className = '',
  titleClassName = '',
  headerClassName = '',
  contentClassName = ''
}: SectionCardProps) {
  return (
    <div className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 overflow-hidden ${className}`}>
      <div className={`bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-gray-800/50 dark:to-gray-700/50 backdrop-blur-sm border-b border-blue-200/50 dark:border-gray-600/50 px-6 py-4 ${headerClassName}`}>
        <div className="flex items-center gap-3">
          {icon && <div className="text-blue-600 dark:text-blue-400">{icon}</div>}
          <h2 className={`text-lg font-semibold text-blue-800 dark:text-white ${titleClassName}`}>{title}</h2>
        </div>
      </div>
      <div className={`p-6 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}