import { describe, expect, it } from 'vitest';
import { isChunkError } from './RouteErrorBoundary';

// Real messages emitted when a hashed chunk 404s after a deploy, one per engine.
const CHUNK_ERRORS = [
  new TypeError('Failed to fetch dynamically imported module: https://x/assets/Trends-a1b2c3.js'), // Chrome
  new TypeError('error loading dynamically imported module: https://x/assets/Drafts-d4e5.js'), // Firefox
  new TypeError('Importing a module script failed.'), // Safari
  Object.assign(new Error('Loading chunk 7 failed.'), { name: 'ChunkLoadError' }), // webpack-style
];

describe('isChunkError', () => {
  it('recognizes a rejected dynamic import from every engine', () => {
    for (const e of CHUNK_ERRORS) expect(isChunkError(e)).toBe(true);
  });

  it('does not claim ordinary render errors as chunk failures', () => {
    expect(isChunkError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(isChunkError(new Error('league.json is malformed'))).toBe(false);
    expect(isChunkError('some string')).toBe(false);
  });
});
