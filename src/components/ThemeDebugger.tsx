import { usePreferences } from '../contexts/PreferencesContext';

export default function ThemeDebugger() {
  const { theme, actualTheme, accentColor } = usePreferences();
  
  // Get computed styles to see actual CSS variable values
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  const primaryColor = computedStyle.getPropertyValue('--color-primary');
  const secondaryColor = computedStyle.getPropertyValue('--color-secondary');
  
  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border-2 border-red-500 z-50">
      <p className="text-xs font-mono">
        Theme: {theme} → {actualTheme}<br/>
        Accent: {accentColor}<br/>
        Primary: {primaryColor || 'not set'}<br/>
        Secondary: {secondaryColor || 'not set'}<br/>
        HTML class: {root.className || 'none'}
      </p>
      <div className="mt-2 flex gap-2">
        <div className="w-8 h-8 bg-primary rounded"></div>
        <div className="w-8 h-8 bg-secondary rounded"></div>
      </div>
    </div>
  );
}
