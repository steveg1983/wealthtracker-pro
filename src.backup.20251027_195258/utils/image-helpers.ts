let webpSupport: boolean | null = null;

export function checkWebPSupport(): Promise<boolean> {
  if (webpSupport !== null) {
    return Promise.resolve(webpSupport);
  }

  return new Promise(resolve => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      webpSupport = webP.height === 2;
      resolve(webpSupport);
    };
    webP.src =
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
}

interface OptimizedImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpg' | 'png';
}

export function getOptimizedImageUrl(
  src: string,
  options: OptimizedImageOptions = {}
): string {
  // Placeholder for CDN logic; returning `src` keeps current behaviour.
  void options;
  return src;
}
