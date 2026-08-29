export default function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        {/* The house spinner ring: border-primary, which index.css remaps under
            .dark so one class reads on both grounds (stock-blue ruling, 28 Aug
            2026; same ring as layout/AccessibilityImprovements.tsx). */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}