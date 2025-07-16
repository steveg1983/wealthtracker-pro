interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 h-20 bg-[#6B86B3] dark:bg-gray-700 shadow-lg z-20">
      <div className="h-full flex items-center px-4 md:px-8">
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        {children}
      </div>
    </div>
  );
}