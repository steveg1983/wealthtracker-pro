import { usePreferences } from '../contexts/PreferencesContext';
import { useEffect, useState } from 'react';

export default function ThemeDebugger() {
  const { theme, actualTheme, accentColor } = usePreferences();
  const [htmlClasses, setHtmlClasses] = useState('');
  
  useEffect(() => {
    // Update HTML classes display
    const updateClasses = () => {
      setHtmlClasses(document.documentElement.className);
    };
    
    updateClasses();
    
    // Watch for class changes
    const observer = new MutationObserver(updateClasses);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border-2 border-red-500 z-50 text-black dark:text-white">
      <p className="text-xs font-mono">
        Theme: {theme} → {actualTheme}<br/>
        Accent: {accentColor}<br/>
        HTML: {htmlClasses}<br/>
        Has dark class: {htmlClasses.includes('dark') ? 'YES' : 'NO'}
      </p>
      <button 
        onClick={() => {
          document.documentElement.classList.toggle('dark');
          console.log('Manually toggled dark class');
        }}
        className="mt-2 text-xs bg-red-500 text-white px-2 py-1 rounded"
      >
        Manual Toggle Dark
      </button>
    </div>
  );
}
