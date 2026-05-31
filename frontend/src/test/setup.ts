import '@testing-library/jest-dom/vitest'

// Both this block AND jsdom.url in vite.config.ts are required on Node 26:
// vitest's populateGlobal skips localStorage (not in its KEYS allowlist), and
// without jsdom.url, accessing .localStorage on an opaque origin throws SecurityError.
try {
  const jsdomWindow = (global as unknown as { jsdom?: { window?: Window } }).jsdom?.window
  if (jsdomWindow?.localStorage != null) {
    Object.defineProperty(global, 'localStorage', {
      value: jsdomWindow.localStorage,
      writable: true,
      configurable: true
    })
  }
} catch {
  // jsdom not available or opaque origin — tests needing localStorage will fail naturally
}
