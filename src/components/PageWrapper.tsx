import PageHeader from './PageHeader';

interface PageWrapperProps {
  title: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  rightContent?: React.ReactNode;
}

export default function PageWrapper({ title, headerContent, children, rightContent }: PageWrapperProps) {
  return (
    <>
      <PageHeader title={title}>
        {headerContent}
      </PageHeader>
      <div className="pt-20 relative">
        {rightContent && (
          <div className="absolute right-0 top-4 z-30">
            {rightContent}
          </div>
        )}
        <div className="relative">
          {children}
        </div>
      </div>
    </>
  );
}