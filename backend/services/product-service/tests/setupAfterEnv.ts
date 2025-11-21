// This file runs after Jest has set up its test environment (so hooks like afterAll are available)
// It performs teardown that was deferred from tests/setup.ts

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const helpers: any = (global as any).__testHelpers;

if (helpers && typeof helpers.__reset === 'function') {
  afterAll(async () => {
    try {
      helpers.__reset();
    } catch (err) {
      // ignore errors during teardown
      // eslint-disable-next-line no-console
      console.warn('Error during test teardown', err);
    }
  });
}

