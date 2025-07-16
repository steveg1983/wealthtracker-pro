import { usePreferences } from '../contexts/PreferencesContext';

export default function Welcome() {
  const { firstName } = usePreferences();
  const displayName = firstName || 'User';

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
      {/* Welcome message */}
      <div className="text-center space-y-8">
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
          Welcome back, {displayName}!
        </h2>
        
        {/* App title */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white">
          Wealth Tracker Pro
        </h1>
        
        {/* Optional subtitle */}
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Your comprehensive financial management solution
        </p>
      </div>
    </div>
  );
}