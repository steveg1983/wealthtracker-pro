export default function ColorTest() {
  return (
    <div className="fixed bottom-20 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg z-50">
      <p className="text-xs font-bold mb-2">Color Test:</p>
      <div className="space-y-2">
        <button className="bg-primary text-white px-3 py-1 rounded text-xs hover:bg-secondary">
          Primary Button
        </button>
        <div className="text-primary text-xs">Primary Text</div>
        <div className="border-2 border-primary px-2 py-1 text-xs">Primary Border</div>
      </div>
    </div>
  );
}
