import { defineConfig } from 'vitest/config';

// Config separata da vite.config.ts: i test non servono PWA, proxy né plugin React (si
// provano funzioni pure, senza JSX), e così `npm test` parte senza costruire tutto il resto.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});
