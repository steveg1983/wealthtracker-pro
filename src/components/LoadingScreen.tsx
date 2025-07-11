export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary dark:text-pink-400 mb-4">
          Danielle's Money <span className="inline-block animate-bounce">👋</span>
        </h1>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading your finances...</p>
      </div>
    </div>
  );
}
