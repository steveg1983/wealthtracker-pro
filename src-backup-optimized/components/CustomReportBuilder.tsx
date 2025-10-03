// Minimal CustomReportBuilder types and component
export interface CustomReport {
  id: string;
  name: string;
  description?: string;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export default function CustomReportBuilder() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Custom Report Builder</h2>
      <p className="text-gray-600">Custom report builder coming soon...</p>
    </div>
  );
}