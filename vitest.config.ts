import path from 'path';
import { defineConfig } from 'vitest/config';

// Minimal vitest setup mirroring the app's `/@/...` path aliases so unit tests
// can import renderer/shared modules. Node environment - the units under test are
// plain data-transform functions, no DOM.
export default defineConfig({
    resolve: {
        alias: {
            '/@/i18n': path.resolve(__dirname, './src/i18n'),
            '/@/remote': path.resolve(__dirname, './src/remote'),
            '/@/renderer': path.resolve(__dirname, './src/renderer'),
            '/@/shared': path.resolve(__dirname, './src/shared'),
        },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});
