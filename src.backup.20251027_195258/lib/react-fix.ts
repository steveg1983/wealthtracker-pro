// Production fix for React bundling issues
// This ensures React is available globally for libraries that expect it
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as ReactJSXRuntime from 'react/jsx-runtime';
import * as ReactJSXDevRuntime from 'react/jsx-dev-runtime';

declare global {
  interface Window {
    React: typeof React;
    ReactDOM: typeof ReactDOM;
    ReactDOMClient: typeof ReactDOMClient;
    ReactJSXRuntime: typeof ReactJSXRuntime;
    ReactJSXDevRuntime: typeof ReactJSXDevRuntime;
  }
}

// Make React available globally in production
// This fixes issues where minified code expects React to be available
if (typeof window !== 'undefined') {
  // Make React available in multiple ways to ensure compatibility
  window.React = React;
  window.ReactDOM = ReactDOM;
  window.ReactDOMClient = ReactDOMClient;
  window.ReactJSXRuntime = ReactJSXRuntime;
  window.ReactJSXDevRuntime = ReactJSXDevRuntime;

  // Also ensure common React methods are directly available
  // This helps with minified code that might reference these directly
  if (!window.React.Component && React.Component) {
    Object.defineProperty(window.React, 'Component', {
      get: () => React.Component,
      configurable: true
    });
  }
  
  // Log to confirm React is available (only in dev)
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('React fix applied:', {
      React: !!window.React,
      Component: !!window.React?.Component,
      forwardRef: !!window.React?.forwardRef,
      useSyncExternalStore: !!window.React?.useSyncExternalStore
    });
  }
}

export { React, ReactDOM, ReactDOMClient };
