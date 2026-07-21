import { lazy, ComponentType, LazyExoticComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PreloadableComponent<T extends ComponentType<any>> extends LazyExoticComponent<T> {
  preload: () => Promise<{ default: T }>;
}

// After a deploy, a long-lived tab holds an index that references chunk
// hashes that no longer exist — its next route navigation fails with
// "Importing a module script failed" (the Bank Feeds error). One automatic
// reload fetches the fresh index and fixes it; the sessionStorage guard
// stops a reload loop if the failure is real (e.g. offline).
const RELOAD_GUARD_KEY = 'chunk_reload_guard';

function importWithStaleChunkRecovery<T>(factory: () => Promise<T>): Promise<T> {
  return factory().then(module => {
    window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
    return module;
  }).catch((error: unknown) => {
    if (window.sessionStorage.getItem(RELOAD_GUARD_KEY) !== 'true') {
      window.sessionStorage.setItem(RELOAD_GUARD_KEY, 'true');
      window.location.reload();
      // The page is reloading — never resolve, so no broken UI flashes.
      return new Promise<T>(() => {});
    }
    throw error;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): PreloadableComponent<T> {
  const recovering = () => importWithStaleChunkRecovery(factory);
  const Component = lazy(recovering) as PreloadableComponent<T>;
  Component.preload = recovering;
  return Component;
}

// Preload a component when the user hovers over a link
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function preloadOnHover<T extends ComponentType<any>>(component: PreloadableComponent<T>): { onMouseEnter: () => void; onTouchStart: () => void } {
  return {
    onMouseEnter: () => component.preload(),
    onTouchStart: () => component.preload(),
  };
}

// Preload a component when the browser is idle
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function preloadWhenIdle<T extends ComponentType<any>>(component: PreloadableComponent<T>): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => component.preload());
  } else {
    // Fallback for browsers that don't support requestIdleCallback
    setTimeout(() => component.preload(), 1);
  }
}

// Preload components based on user patterns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function preloadByRoute<T extends ComponentType<any>>(currentPath: string, components: Record<string, PreloadableComponent<T>>): void {
  // Common navigation patterns
  const preloadMap: Record<string, string[]> = {
    '/dashboard': ['/transactions', '/accounts', '/budget'],
    '/accounts': ['/transactions', '/dashboard'],
    '/transactions': ['/accounts', '/dashboard', '/budget'],
    '/budget': ['/goals', '/transactions'],
    '/goals': ['/budget', '/dashboard'],
  };

  const toPreload = preloadMap[currentPath] || [];
  toPreload.forEach(path => {
    const component = components[path];
    if (component && typeof component.preload === 'function') {
      preloadWhenIdle(component);
    }
  });
}
