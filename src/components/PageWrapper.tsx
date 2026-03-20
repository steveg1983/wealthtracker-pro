import React from 'react';

interface PageWrapperProps {
  title: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  reducedHeaderWidth?: boolean;
}

export default function PageWrapper({ title, headerContent, children, rightContent }: PageWrapperProps): React.JSX.Element {
  return (
    <>
      <div className="relative mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
          {headerContent}
        </div>
        {rightContent && (
          <div className="flex items-center gap-2">
            {rightContent}
          </div>
        )}
      </div>
      <div className="relative pb-24 lg:pb-0">
        {children}
      </div>
    </>
  );
}