import { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
// import { PreferencesProvider } from './contexts/PreferencesContext';
import { PreferencesProvider } from './contexts/PreferencesContextSafe';
import { AppProvider } from './contexts/AppContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { createScopedLogger } from './loggers/scopedLogger';

const debugLogger = createScopedLogger('AppDebug');

function AppDebugInner() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>('');
  
  useEffect(() => {
    debugLogger.info('AppDebug step updated', { step });
  }, [step]);

  const renderWithProviders = () => {
    try {
      switch(step) {
        case 0:
          return <div>Click button to start testing...</div>;
        case 1:
          return (
            <ErrorBoundary>
              <div>ErrorBoundary works! ✅</div>
            </ErrorBoundary>
          );
        case 2:
          return (
            <ErrorBoundary>
              <PreferencesProvider>
                <div>PreferencesProvider works! ✅</div>
              </PreferencesProvider>
            </ErrorBoundary>
          );
        case 3:
          return (
            <ErrorBoundary>
              <PreferencesProvider>
                <AppProvider>
                  <div>AppProvider works! ✅</div>
                </AppProvider>
              </PreferencesProvider>
            </ErrorBoundary>
          );
        case 4:
          debugLogger.info('Attempting to render LayoutProvider');
          try {
            return (
              <ErrorBoundary>
                <PreferencesProvider>
                  <AppProvider>
                    <LayoutProvider>
                      <div>LayoutProvider works! ✅</div>
                    </LayoutProvider>
                  </AppProvider>
                </PreferencesProvider>
              </ErrorBoundary>
            );
          } catch (e) {
            debugLogger.error('LayoutProvider render error', e);
            throw e;
          }
        case 5:
          return (
            <div>Router tested separately - All providers work! ✅</div>
          );
        default:
          return <div>Test complete!</div>;
      }
    } catch (err) {
      debugLogger.error('Render error', { step, error: err });
      setError(`Error at step ${step}: ${err}`);
      return <div style={{color: 'red'}}>Error: {error}</div>;
    }
  };

  const nextStep = () => {
    debugLogger.info('Moving to step', { nextStep: step + 1 });
    setStep(step + 1);
    setError('');
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>App Debug Mode</h1>
      <p>Current step: {step}</p>
      <button onClick={nextStep} disabled={step >= 5}>Next Step</button>
      <button onClick={() => setStep(0)} style={{ marginLeft: '10px' }}>Reset</button>
      
      {error && <div style={{ color: 'red', margin: '10px 0' }}>{error}</div>}
      
      <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc' }}>
        <h3>Render Test:</h3>
        {renderWithProviders()}
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h3>Component Status:</h3>
        <ul>
          <li>ErrorBoundary: {step >= 1 ? '✅' : '❌'}</li>
          <li>PreferencesProvider: {step >= 2 ? '✅' : '❌'}</li>
          <li>AppProvider: {step >= 3 ? '✅' : '❌'}</li>
          <li>LayoutProvider: {step >= 4 ? '✅' : '❌'}</li>
          <li>Router: {step >= 5 ? '✅' : '❌'}</li>
        </ul>
      </div>
    </div>
  );
}

// Wrapper component that includes Router at the root
export default function AppDebug() {
  const [useRouter, setUseRouter] = useState(false);
  
  if (useRouter) {
    return (
      <Router>
        <div style={{ padding: '20px' }}>
          <h1>Full App Test with Router</h1>
          <ErrorBoundary>
            <PreferencesProvider>
              <AppProvider>
                <LayoutProvider>
                  <div style={{ padding: '20px', border: '2px solid green' }}>
                    <h2>✅ All components working with Router!</h2>
                    <p>The app structure is functional.</p>
                    <button onClick={() => setUseRouter(false)}>Back to Debug Mode</button>
                  </div>
                </LayoutProvider>
              </AppProvider>
            </PreferencesProvider>
          </ErrorBoundary>
        </div>
      </Router>
    );
  }
  
  return (
    <div>
      <AppDebugInner />
      <div style={{ padding: '20px', marginTop: '20px', borderTop: '2px solid #ccc' }}>
        <button 
          onClick={() => setUseRouter(true)}
          style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: '#3B82F6', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          Test Full Stack with Router
        </button>
      </div>
    </div>
  );
}
