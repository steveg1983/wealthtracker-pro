/**
 * Lazy loading with preload support
 * Enhances React.lazy with preloading capabilities for better performance
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { MouseEvent } from 'react';

type LazyComponent<T extends ComponentType = ComponentType> = LazyExoticComponent<T> & {
  preload: () => Promise<{ default: T }>;
};

type PreloadableComponent<T extends ComponentType = ComponentType> = ComponentType | LazyComponent<T>;

const hasPreload = <T extends ComponentType = ComponentType>(
  component: PreloadableComponent<T>
): component is LazyComponent<T> => typeof (component as LazyComponent<T>).preload === 'function';

const safelyPreload = <T extends ComponentType = ComponentType>(component: PreloadableComponent<T>): Promise<unknown> | void => {
  if (!hasPreload(component)) {
    return undefined;
  }

  return component.preload().catch(() => {
    // Explicitly swallow preload errors to avoid user-facing noise.
    // Subsequent lazy rendering will surface real loader errors.
    return undefined;
  });
};

/**
 * Create a lazy component with preload capability
 */
export function lazyWithPreload<T extends ComponentType = ComponentType>(
  importFunction: () => Promise<{ default: T }>
): LazyComponent<T> {
  const LazyComponentWithPreload = lazy(importFunction) as LazyComponent<T>;

  // Add preload method
  LazyComponentWithPreload.preload = importFunction;

  return LazyComponentWithPreload;
}

/**
 * Preload multiple lazy components
 */
export function preloadComponents<T extends ComponentType = ComponentType>(
  components: Array<PreloadableComponent<T>>
): Promise<Array<unknown | void>> {
  const preloadPromises = components.map(component => safelyPreload(component) ?? Promise.resolve());
  return Promise.all(preloadPromises);
}

/**
 * Preload component on hover
 */
export function preloadOnHover<T extends ComponentType = ComponentType>(
  component: PreloadableComponent<T>
): (event: MouseEvent) => void {
  return () => {
    safelyPreload(component);
  };
}

/**
 * Preload component on intersection
 */
export function preloadOnIntersection<T extends ComponentType = ComponentType>(
  component: PreloadableComponent<T>,
  element: Element,
  options?: IntersectionObserverInit
): void {
  if (typeof IntersectionObserver === 'undefined') return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        safelyPreload(component);
        observer.disconnect();
      }
    });
  }, options);

  observer.observe(element);
}

/**
 * Preload component when browser is idle
 */
export function preloadWhenIdle<T extends ComponentType = ComponentType>(
  component: PreloadableComponent<T>
): void {
  if (typeof requestIdleCallback === 'undefined') {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      safelyPreload(component);
    }, 100);
    return;
  }

  requestIdleCallback(() => {
    safelyPreload(component);
  });
}
