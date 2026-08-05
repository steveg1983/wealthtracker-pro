/**
 * A dynamic import fails for two very different reasons, and the app must treat
 * them differently:
 *
 *  - the browser could not FETCH the chunk. Almost always because this tab
 *    holds the index it booted with and a deploy has since replaced every
 *    hashed filename in it — reloading fixes it; or
 *  - the chunk was fetched and its module code threw. That is a real bug, and
 *    reloading only reproduces it.
 *
 * Only the first is recoverable. Every engine words it differently, hence the
 * list. Anything unmatched counts as a genuine crash, which is the safe
 * direction: the user sees the real error rather than a surprise reload.
 */
const CHUNK_LOAD_ERROR_PATTERNS: readonly RegExp[] = [
  /failed to fetch dynamically imported module/i,        // Chrome, Edge
  /error loading dynamically imported module/i,          // Firefox
  /importing a module script failed/i,                   // Safari
  /failed to load module script/i,                       // Chrome, when the host answers a missing asset with index.html
  /expected a javascript(?:-or-wasm)? module script/i,   // the MIME-type half of that same failure
  /chunkloaderror/i,                                     // the error NAME used by webpack-style loaders
  /loading chunk \S+ failed/i,                           // and its message
  /unable to preload css/i,                              // Vite's preload helper, for a chunk's stylesheet
];

function toMatchableText(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error !== null && typeof error === 'object') {
    const name = 'name' in error && typeof error.name === 'string' ? error.name : '';
    const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
    return `${name} ${message}`;
  }

  return '';
}

/**
 * True when `error` is a failure to download application code, rather than a
 * failure inside it.
 */
export function isChunkLoadError(error: unknown): boolean {
  const text = toMatchableText(error);
  if (text.trim() === '') {
    return false;
  }

  return CHUNK_LOAD_ERROR_PATTERNS.some(pattern => pattern.test(text));
}
