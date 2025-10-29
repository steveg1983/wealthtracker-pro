import { useState } from 'react';

export default function ImportTest() {
  const [test, setTest] = useState(0);
  
  const testImport = async (name: string, importFn: () => Promise<unknown>) => {
    try {
      console.log(`Testing import: ${name}...`);
      await importFn();
      console.log(`✅ ${name} imported successfully`);
      return true;
    } catch (error) {
      console.error(`❌ ${name} import failed:`, error);
      return false;
    }
  };

  const runTests = async () => {
    setTest(1);
    
    // Test imports one by one
    await testImport('ErrorBoundary', () => import('./components/ErrorBoundary'));
    await testImport('PreferencesContext', () => import('./contexts/PreferencesContext'));
    await testImport('AppContext', () => import('./contexts/AppContext'));
    await testImport('LayoutContext', () => import('./contexts/LayoutContext'));
    await testImport('Layout', () => import('./components/Layout'));
    await testImport('Welcome', () => import('./pages/Welcome'));
    await testImport('Router', () => import('react-router-dom'));
    
    setTest(2);
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Import Test</h1>
      {test === 0 && <button onClick={runTests}>Run Import Tests</button>}
      {test === 1 && <p>Running tests... Check console</p>}
      {test === 2 && <p>Tests complete! Check console for results</p>}
    </div>
  );
}