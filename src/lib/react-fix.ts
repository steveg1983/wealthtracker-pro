// Production fix for React bundling issues
// This ensures React is available globally for libraries that expect it
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';

// Make React available globally in production
// This fixes issues where minified code expects React to be available
if (typeof window !== 'undefined') {
  const win = window as any;
  
  // Make React available in multiple ways to ensure compatibility
  win.React = React;
  win.ReactDOM = ReactDOM;
  win.ReactDOMClient = ReactDOMClient;
  
  // Also ensure common React methods are directly available
  // This helps with minified code that might reference these directly
  if (!win.React.Component && React.Component) {
    Object.defineProperty(win.React, 'Component', {
      get: () => React.Component,
      configurable: true
    });
  }
  
  // Log to confirm React is available (only in dev)
  if (import.meta.env.DEV) {
    console.log('React fix applied:', {
      React: !!win.React,
      Component: !!win.React?.Component,
      forwardRef: !!win.React?.forwardRef,
      useSyncExternalStore: !!win.React?.useSyncExternalStore
    });
  }
}

export { React, ReactDOM, ReactDOMClient };