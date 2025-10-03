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
    <div className="w-full">
      <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow-lg mb-6">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              {headerContent && (
                <div className="mt-2 text-sm text-gray-200 dark:text-gray-300">
                  {headerContent}
                </div>
              )}
            </div>
            {rightContent && (
              <div className="ml-4">
                {rightContent}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}