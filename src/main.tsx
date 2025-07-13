import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SimpleTest from './SimpleTest.tsx'
// import Diagnostic from './Diagnostic.tsx'
// import TestApp from './App.test.tsx'

// Remove any pre-existing dark class on app start
document.documentElement.classList.remove('dark');

// Add error handling
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

const urlParams = new URLSearchParams(window.location.search);
const isTest = urlParams.get('test') === 'true';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTest ? <SimpleTest /> : <App />}
  </StrictMode>,
)
