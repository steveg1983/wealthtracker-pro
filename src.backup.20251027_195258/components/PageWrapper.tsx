import React from 'react';

interface BreadcrumbItem {
  label: string;
  path: string;
}

type IconProp = React.ReactNode | React.ComponentType<{ className?: string }>;

interface PageWrapperProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: IconProp;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  reducedHeaderWidth?: boolean;
}

export default function PageWrapper({
  title,
  subtitle,
  description,
  icon,
  breadcrumbs,
  actions,
  headerContent,
  children,
  rightContent,
  reducedHeaderWidth
}: PageWrapperProps): React.JSX.Element {
  const headerWidthClass = reducedHeaderWidth ? 'md:w-[80%]' : 'w-full';

  const renderedIcon = React.useMemo(() => {
    if (!icon) {
      return null;
    }

    if (typeof icon === 'function') {
      const IconComponent = icon as React.ComponentType<{ className?: string }>;
      return <IconComponent className="h-8 w-8 text-white" />;
    }

    return icon;
  }, [icon]);

  return (
    <div className="relative w-full">
      <div className={`relative mb-6 ${headerWidthClass}`}>
        <div className="relative bg-secondary dark:bg-gray-700 rounded-2xl shadow shadow-lg p-4 md:p-6">
          {rightContent && !reducedHeaderWidth && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex items-center">
              {rightContent}
            </div>
          )}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-start gap-4">
              {renderedIcon && (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                  {renderedIcon}
                </div>
              )}
              <div className="flex-1 text-white">
                {Array.isArray(breadcrumbs) && breadcrumbs.length > 0 && (
                  <nav className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-200/80">
                    {breadcrumbs.map((crumb, index) => (
                      <span key={crumb.path} className="mr-2">
                        {index > 0 && <span className="mx-2 text-gray-400">/</span>}
                        <a href={crumb.path} className="hover:text-white">
                          {crumb.label}
                        </a>
                      </span>
                    ))}
                  </nav>
                )}
                <h1 className="text-2xl font-bold">{title}</h1>
                {subtitle && (
                  <p className="mt-1 text-sm text-gray-200/80">{subtitle}</p>
                )}
                {description && (
                  <p className="mt-2 text-sm text-gray-200/70">{description}</p>
                )}
                {headerContent && (
                  <div className="mt-3 text-sm text-gray-200 dark:text-gray-300">
                    {headerContent}
                  </div>
                )}
              </div>
            </div>
            {actions && (
              <div className="flex flex-shrink-0 items-center gap-3 self-stretch md:self-start">
                <div className="flex items-center gap-3">{actions}</div>
              </div>
            )}
          </div>
        </div>
        {rightContent && reducedHeaderWidth && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            {rightContent}
          </div>
        )}
      </div>

      <div className="relative w-full">
        {children}
      </div>
    </div>
  );
}
