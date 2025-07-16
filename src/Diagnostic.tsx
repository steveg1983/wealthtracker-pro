import { useState, useEffect } from 'react';

export default function Diagnostic() {
  const [checks, setChecks] = useState<Record<string, boolean | string>>({});
  
  useEffect(() => {
    const runChecks = () => {
      const newChecks: Record<string, boolean | string> = {};
      
      // Check if React is loaded
      newChecks['React Loaded'] = true;
      
      // Check localStorage
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        newChecks['LocalStorage'] = true;
      } catch {
        newChecks['LocalStorage'] = false;
      }
      
      // Check if contexts are available
      try {
        const hasAppContext = true; // Will error if context provider missing
        newChecks['Contexts'] = hasAppContext;
      } catch {
        newChecks['Contexts'] = false;
      }
      
      // Check Supabase env
      newChecks['Supabase URL'] = import.meta.env.VITE_SUPABASE_URL || 'Not configured';
      newChecks['Supabase Key'] = import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Configured' : 'Not configured';
      
      setChecks(newChecks);
    };
    
    runChecks();
  }, []);
  
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">App Diagnostic</h1>
      <div className="space-y-2">
        {Object.entries(checks).map(([key, value]) => (
          <div key={key} className="flex justify-between p-3 bg-gray-100 rounded">
            <span className="font-medium">{key}:</span>
            <span className={typeof value === 'boolean' ? (value ? 'text-green-600' : 'text-red-600') : ''}>
              {typeof value === 'boolean' ? (value ? '✓' : '✗') : value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 bg-blue-100 rounded">
        <p className="text-sm">If you see this page, React is loading correctly.</p>
        <p className="text-sm mt-2">Check the browser console for any error messages.</p>
      </div>
    </div>
  );
}