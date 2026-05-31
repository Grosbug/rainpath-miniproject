import '@testing-library/jest-dom/vitest'

// Node 26 stubs `localStorage` as undefined on globalThis, which prevents
// vitest from copying jsdom's real Storage implementation to the global.
// Restore jsdom's localStorage so tests can use window.localStorage normally.
const jsdomWindow = (global as unknown as { jsdom?: { window?: Window } }).jsdom?.window
if (jsdomWindow?.localStorage != null) {
  Object.defineProperty(global, 'localStorage', {
    value: jsdomWindow.localStorage,
    writable: true,
    configurable: true
  })
}
