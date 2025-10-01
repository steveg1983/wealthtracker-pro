// Central API base for same-origin proxy
// Always use relative "/api" so Vite dev proxy and production proxy can route to backend

export function apiBase(): string {
  return '/api';
}

export function apiUrl(path: string): string {
  if (!path) return '/api';
  return path.startsWith('/') ? `/api${path}` : `/api/${path}`;
}

