import { lazy, ComponentType, LazyExoticComponent } from 'react';

export interface PreloadableComponent<T extends ComponentType<any>>
  extends LazyExoticComponent<T> {
  preload: () => Promise<{ default: T }>;
}

export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): PreloadableComponent<T> {
  const Component = lazy(factory) as PreloadableComponent<T>;
  Component.preload = factory;
  return Component;
}

// Preload a component when the user hovers over a link
export function preloadOnHover(component: PreloadableComponent<ComponentType<any>>): { onMouseEnter: () => void; onTouchStart: () => void } {
  return {
    onMouseEnter: () => component.preload(),
    onTouchStart: () => component.preload(),
  };
}

// Preload a component when the browser is idle
export function preloadWhenIdle(component: PreloadableComponent<ComponentType<any>>): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => component.preload());
  } else {
    // Fallback for browsers that don't support requestIdleCallback
    setTimeout(() => component.preload(), 1);
  }
}

// Preload components based on user patterns
export function preloadByRoute(currentPath: string, components: Record<string, PreloadableComponent<ComponentType<any>>>): void {
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
