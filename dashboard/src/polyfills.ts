import { Buffer } from 'buffer'

// Make Buffer globally available for browser environment
if (typeof window !== 'undefined') {
  window.Buffer = Buffer
}

// Polyfill for global
if (typeof globalThis !== 'undefined') {
  globalThis.Buffer = Buffer
}
