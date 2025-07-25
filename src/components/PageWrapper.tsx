import React from 'react';

interface PageWrapperProps {
  title: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  reducedHeaderWidth?: boolean;
}

export default function PageWrapper({ title, headerContent, children, rightContent, reducedHeaderWidth }: PageWrapperProps): React.JSX.Element {
  return (
    <>
      <div className="relative mb-6">
        <div className={`bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4 relative ${reducedHeaderWidth ? 'w-[80%]' : ''}`}>
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          {headerContent}
          {rightContent && !reducedHeaderWidth && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
              {rightContent}
            </div>
          )}
        </div>
        {rightContent && reducedHeaderWidth && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            {rightContent}
          </div>
        )}
      </div>
      <div className="relative">
        {children}
      </div>
    </>
  );
}