import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/__tests__/**/*.test.js', 'tests/**/*.test.js'],
        globals: true,
        setupFiles: ['./vitest.setup.js'],
        coverage: {
            reporter: ['text'],
        },
    },
    resolve: {
        alias: {
            electron: path.resolve(__dirname, 'src/__mocks__/electron.js'),
            'hnswlib-node': path.resolve(__dirname, 'src/__mocks__/hnswlib-node.js'),
        },
    },
});
