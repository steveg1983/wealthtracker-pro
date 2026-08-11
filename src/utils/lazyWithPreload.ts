import { lazy, ComponentType, LazyExoticComponent } from 'react';
import { importWithChunkRecovery } from './lazyWithRecovery';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PreloadableComponent<T extends ComponentType<any>> extends LazyExoticComponent<T> {
  preload: () => Promise<{ default: T }>;
}

// Stale-chunk recovery (the "Importing a module script failed" deploy race)
// lives in lazyWithRecovery — this only adds preloading on top of it, so a
// preload that hits a stale chunk heals the tab before the user even clicks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): PreloadableComponent<T> {
  const recovering = () => importWithChunkRecovery(factory);
  const Component = lazy(recovering) as PreloadableComponent<T>;
  Component.preload = recovering;
  return Component;
}

// Nobody asked for a preload, so a failed one must not surface as an unhandled
// rejection. The same import runs again when the user actually navigates, where
// Suspense and the error boundary handle it in front of them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function preloadQuietly<T extends ComponentType<any>>(component: PreloadableComponent<T>): void {
  component.preload().catch(() => {});
}

// Preload a component when the user hovers over a link
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function preloadOnHover<T extends ComponentType<any>>(component: PreloadableComponent<T>): { onMouseEnter: () => void; onTouchStart: () => void } {
  return {
    onMouseEnter: () => preloadQuietly(component),
    onTouchStart: () => preloadQuietly(component),
  };
}

// Preload a component when the browser is idle
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function preloadWhenIdle<T extends ComponentType<any>>(component: PreloadableComponent<T>): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => preloadQuietly(component));
  } else {
    // Fallback for browsers that don't support requestIdleCallback
    setTimeout(() => preloadQuietly(component), 1);
  }
}

// Preload components based on user patterns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function preloadByRoute<T extends ComponentType<any>>(currentPath: string, components: Record<string, PreloadableComponent<T>>): void {
  // Common navigation patterns
  const preloadMap: Record<string, string[]> = {
    '/dashboard': ['/accounts', '/budget'],
    '/accounts': ['/dashboard', '/budget'],
    '/find': ['/accounts'],
    '/budget': ['/goals', '/dashboard'],
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
