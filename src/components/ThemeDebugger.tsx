import { usePreferences } from '../contexts/PreferencesContext';

export default function ThemeDebugger() {
  const { theme, actualTheme } = usePreferences();
  
  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border-2 border-red-500 z-50">
      <p className="text-xs font-mono">
        Selected: {theme}<br/>
        Actual: {actualTheme}<br/>
        HTML class: {document.documentElement.className || 'none'}
      </p>
    </div>
  );
}
