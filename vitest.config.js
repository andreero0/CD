const { defineConfig } = require('vitest/config');
const path = require('path');

module.exports = defineConfig({
    test: {
        environment: 'node',
        include: ['src/__tests__/**/*.test.js', 'tests/**/*.test.js'],
        globals: true,
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
