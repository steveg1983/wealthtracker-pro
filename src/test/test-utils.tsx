import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '../contexts/AppContextSupabase';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { LayoutProvider } from '../contexts/LayoutContext';

// Create a custom render function that includes all providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <PreferencesProvider>
        <AppProvider>
          <LayoutProvider>
            {children}
          </LayoutProvider>
        </AppProvider>
      </PreferencesProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };