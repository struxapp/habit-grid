import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Tests that care about the zone set it themselves; this default has daylight saving time.
    env: { TZ: 'America/New_York' },
  },
});
