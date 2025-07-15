export default function BasicTest() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-blue-600">Basic Test Page</h1>
      <p className="mt-4">This is a basic test without any context dependencies.</p>
      <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
        <p>If you can see this, the routing and basic component rendering works.</p>
      </div>
    </div>
  );
}