import { lazy, ComponentType, LazyExoticComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PreloadableComponent<T extends ComponentType<any>> extends LazyExoticComponent<T> {
  preload: () => Promise<{ default: T }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): PreloadableComponent<T> {
  const Component = lazy(factory) as PreloadableComponent<T>;
  Component.preload = factory;
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
