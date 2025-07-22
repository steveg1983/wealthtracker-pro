interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, children }: PageHeaderProps): React.JSX.Element {
  return (
    <div className="mb-6">
      <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4">
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        {children}
      </div>
    </div>
  );
}