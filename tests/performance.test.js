const { describe, it, expect } = require('vitest');

describe('Performance Tests', () => {
    it('Debounce latency ≤ 500ms', async () => {
        const start = Date.now();

        // Schedule debounced context injection
        scheduleContextInjection('test');

        // Wait for debounce
        await new Promise(resolve => setTimeout(resolve, 600));

        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(550);  // Allow 50ms margin
    });

    it('Buffer flush latency ≤ 100ms to UI', () => {
        const buffer = 'This is a test buffer with enough words';
        const start = Date.now();

        // Flush buffer
        flushBufferToUI(buffer, 'You');

        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(100);
    });

    it('Context injection ≤ 1000ms API call', async () => {
        const context = 'Test context';
        const start = Date.now();

        await sendContextToAI(context, 'test');

        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(1000);
    });

    it('RAG query ≤ 500ms', async () => {
        const question = 'Tell me about your experience with leadership and teamwork';
        const start = Date.now();

        await queryRAGIfNeeded(question, 'test-session');

        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(500);
    });
});

describe('Memory Usage Tests', () => {
    it('Audio correlation queue cleanup prevents leaks', async () => {
        // Fill queue
        for (let i = 0; i < 200; i++) {
            audioChunkQueue.push({
                correlationId: `test-${i}`,
                source: 'mic',
                timestamp: Date.now() - 60000,  // Old entries
                expiresAt: Date.now() - 30000   // Expired
            });
        }

        const beforeSize = audioChunkQueue.length;

        // Run cleanup
        cleanupExpiredCorrelations();

        const afterSize = audioChunkQueue.length;

        expect(afterSize).toBeLessThan(beforeSize);
        expect(afterSize).toBe(0);  // All should be expired
    });
});
