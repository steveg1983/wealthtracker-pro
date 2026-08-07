import React from 'react';

interface PageWrapperProps {
  title: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  reducedHeaderWidth?: boolean;
  /**
   * Extra classes for the content container. Its reason to exist is vertical
   * rhythm: a page made of stacked sections should say `space-y-6` here once,
   * rather than have every section bring its own margin and disagree.
   */
  contentClassName?: string;
}

export default function PageWrapper({ title, headerContent, children, rightContent, contentClassName = '' }: PageWrapperProps): React.JSX.Element {
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
      <div className={`relative pb-24 lg:pb-0 ${contentClassName}`.trimEnd()}>
        {children}
      </div>
    </>
  );
}