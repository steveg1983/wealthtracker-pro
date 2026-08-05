import { describe, it, expect } from 'vitest';
import { isChunkLoadError } from './chunkLoadError';

describe('isChunkLoadError', () => {
  // The same failure — a chunk this tab asked for is no longer on the CDN —
  // reported by each engine, plus the two shapes a host's SPA fallback creates.
  const chunkFailures: Array<[string, unknown]> = [
    ['Chrome / Edge', new TypeError('Failed to fetch dynamically imported module: https://app.example/assets/Transactions-8f3a1c.js')],
    ['Safari', new TypeError('Importing a module script failed.')],
    ['Firefox', new TypeError('error loading dynamically imported module: https://app.example/assets/Transactions-8f3a1c.js')],
    ['SPA fallback served index.html', new TypeError("Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of \"text/html\".")],
    ['webpack-style loader', Object.assign(new Error('Loading chunk 42 failed.'), { name: 'ChunkLoadError' })],
    ["a chunk's stylesheet", new Error('Unable to preload CSS for /assets/Transactions-8f3a1c.css')],
    ['a message with no Error wrapper', 'Importing a module script failed.'],
  ];

  it.each(chunkFailures)('recognises the %s wording', (_engine, error) => {
    expect(isChunkLoadError(error)).toBe(true);
  });

  const genuineCrashes: Array<[string, unknown]> = [
    ['a bug inside a module that did load', new TypeError("Cannot read properties of undefined (reading 'balance')")],
    ['a failed API call', new TypeError('Failed to fetch')],
    ['a thrown string', 'Something went wrong'],
    ['no error at all', undefined],
    ['null', null],
    ['an object with no message', {}],
  ];

  it.each(genuineCrashes)('leaves %s to the generic crash path', (_case, error) => {
    expect(isChunkLoadError(error)).toBe(false);
  });
});
