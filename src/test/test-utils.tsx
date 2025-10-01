import { render, type RenderOptions } from '@testing-library/react';
import type { PreloadedState } from '@reduxjs/toolkit';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '../contexts/AppContextSupabase';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { LayoutProvider } from '../contexts/LayoutContext';
import type { AppStore, RootState } from '../store';
import { createTestStore } from './utils/createTestStore';

// Create a custom render function that includes all providers
const createAllProviders = (store: AppStore) => ({ children }: { children: React.ReactNode }) => {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <PreferencesProvider>
          <AppProvider>
            <LayoutProvider>
              {children}
            </LayoutProvider>
          </AppProvider>
        </PreferencesProvider>
      </BrowserRouter>
    </Provider>
  );
};

interface RenderWithStoreOptions extends Omit<RenderOptions, 'wrapper'> {
  store?: AppStore;
  preloadedState?: PreloadedState<RootState>;
}

const customRender = (
  ui: ReactElement,
  renderOptions: RenderWithStoreOptions = {}
) => {
  const { preloadedState, store = createTestStore(preloadedState), ...options } = renderOptions;
  const Wrapper = createAllProviders(store);
  return render(ui, { wrapper: Wrapper, ...options });
};

// Re-export everything
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';
export { customRender as render };
export { createTestStore };
