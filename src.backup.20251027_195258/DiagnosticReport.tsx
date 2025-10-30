import { useEffect, useState } from 'react';
import { useApp } from './contexts/AppContext';

interface CorruptedKey {
  key: string;
  error: string;
}

interface DiagnosticSnapshot {
  localStorage: {
    keys: string[];
    totalKeys: number;
    encryptedKeys: number;
    corruptedKeys: CorruptedKey[];
  };
  indexedDB: string[] | string;
  appContext: {
    accounts: number;
    transactions: number;
    categories: number;
    isLoading: boolean;
    hasTestData: boolean;
  };
  errors: unknown[];
}

export default function DiagnosticReport() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticSnapshot | null>(null);
  const appContext = useApp();
  
  useEffect(() => {
    // Check localStorage
    const localStorageKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) localStorageKeys.push(key);
    }
    
    // Check IndexedDB
    const checkIndexedDB = async (): Promise<string[] | string> => {
      try {
        const dbs = await indexedDB.databases();
        return dbs
          .map(db => db.name)
          .filter((name): name is string => typeof name === 'string');
      } catch (_e) {
        return `IndexedDB check failed: ${String(_e)}`;
      }
    };
    
    // Check for corrupted data
    const checkCorruptedData = (): CorruptedKey[] => {
      const problematicKeys: CorruptedKey[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('enc_') || key.includes('encrypted'))) {
          try {
            const value = localStorage.getItem(key);
            if (value) {
              // Try to parse as JSON
              JSON.parse(value);
            }
          } catch {
            problematicKeys.push({ key, error: 'Parse error' });
          }
        }
      }
      return problematicKeys;
    };
    
    // Run diagnostics
    const runDiagnostics = async () => {
      const diag: DiagnosticSnapshot = {
        localStorage: {
          keys: localStorageKeys,
          totalKeys: localStorageKeys.length,
          encryptedKeys: localStorageKeys.filter(k => k.startsWith('enc_')).length,
          corruptedKeys: checkCorruptedData()
        },
        indexedDB: await checkIndexedDB(),
        appContext: {
          accounts: appContext?.accounts?.length || 0,
          transactions: appContext?.transactions?.length || 0,
          categories: appContext?.categories?.length || 0,
          isLoading: appContext?.isLoading || false,
          hasTestData: appContext?.hasTestData || false
        },
        errors: []
      };
      
      setDiagnostics(diag);
    };
    
    runDiagnostics();
  }, [appContext]);
  
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Diagnostic Report</h2>
      <pre className="text-xs overflow-auto bg-gray-100 p-4 rounded">
        {JSON.stringify(diagnostics ?? { status: 'Collecting diagnostics…' }, null, 2)}
      </pre>
      <div className="mt-4 space-x-2">
        <button 
          onClick={() => {
            // Clear encrypted keys
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.startsWith('enc_') || key.startsWith('wealthtracker_'))) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            alert(`Cleared ${keysToRemove.length} keys. Please refresh the page.`);
          }}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Clear Encrypted Storage
        </button>
        <button 
          onClick={() => {
            localStorage.clear();
            sessionStorage.clear();
            alert('All storage cleared. Please refresh the page.');
          }}
          className="px-4 py-2 bg-red-800 text-white rounded hover:bg-red-900"
        >
          Clear ALL Storage
        </button>
      </div>
    </div>
  );
}
