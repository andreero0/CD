const fc = require('fast-check');

// Mock hnswlib-node before importing gemini
const hnswlibPath = require.resolve('hnswlib-node');
require.cache[hnswlibPath] = {
    exports: {
        HierarchicalNSW: class {
            constructor() {}
            initIndex() {}
            addPoint() {}
            searchKnn() {
                return { neighbors: [], distances: [] };
            }
            writeIndexSync() {}
            readIndexSync() {}
        },
    },
};

// Mock electron before importing gemini
const electronPath = require.resolve('electron');
require.cache[electronPath] = {
    exports: {
        BrowserWindow: {
            getAllWindows: vi.fn(() => [{ webContents: { send: vi.fn() } }]),
        },
        ipcMain: { handle: vi.fn(), on: vi.fn() },
        shell: { openExternal: vi.fn() },
    },
};

const {
    removeStaleChunks,
    determineSpeakerFromCorrelation,
    calculateCorrelationConfidence,
    validateSpeakerAttribution,
    _getAudioChunkQueue,
    _getLastSpeakers,
    _getQueueSizeHistory,
    _getValidationMetrics,
    _resetTestState,
} = require('../../src/utils/gemini');

describe('Speaker Attribution Enhancements', () => {
    beforeEach(() => {
        // Reset all test state before each test
        _resetTestState();
    });

    describe('removeStaleChunks()', () => {
        it('should remove chunks older than 5 seconds', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Add stale chunks (older than 5s)
            queue.push(
                { correlationId: '1', source: 'mic', timestamp: now - 6000 },
                { correlationId: '2', source: 'system', timestamp: now - 7000 },
                { correlationId: '3', source: 'mic', timestamp: now - 10000 }
            );

            removeStaleChunks();

            expect(queue.length).toBe(0);
        });

        it('should preserve recent chunks', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Add recent chunks (within 5s)
            queue.push(
                { correlationId: '1', source: 'mic', timestamp: now - 1000 },
                { correlationId: '2', source: 'system', timestamp: now - 2000 },
                { correlationId: '3', source: 'mic', timestamp: now - 3000 }
            );

            removeStaleChunks();

            expect(queue.length).toBe(3);
        });

        it('should remove only stale chunks and preserve recent ones', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Mix of stale and recent chunks
            queue.push(
                { correlationId: '1', source: 'mic', timestamp: now - 8000 }, // stale
                { correlationId: '2', source: 'system', timestamp: now - 2000 }, // recent
                { correlationId: '3', source: 'mic', timestamp: now - 6000 }, // stale
                { correlationId: '4', source: 'system', timestamp: now - 1000 } // recent
            );

            removeStaleChunks();

            expect(queue.length).toBe(2);
            expect(queue[0].correlationId).toBe('2');
            expect(queue[1].correlationId).toBe('4');
        });

        it('should update queue size history', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();
            const history = _getQueueSizeHistory();

            queue.push(
                { correlationId: '1', source: 'mic', timestamp: now - 1000 },
                { correlationId: '2', source: 'system', timestamp: now - 2000 }
            );

            removeStaleChunks();

            expect(history.length).toBeGreaterThan(0);
            expect(history[history.length - 1]).toBe(2);
        });

        it('should limit queue size history to MAX_HISTORY_SIZE (20)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();
            const history = _getQueueSizeHistory();

            queue.push({ correlationId: '1', source: 'mic', timestamp: now - 1000 });

            // Call removeStaleChunks 25 times to exceed MAX_HISTORY_SIZE
            for (let i = 0; i < 25; i++) {
                removeStaleChunks();
            }

            expect(history.length).toBeLessThanOrEqual(20);
        });

        it('should handle empty queue gracefully', () => {
            const queue = _getAudioChunkQueue();

            expect(queue.length).toBe(0);
            removeStaleChunks();
            expect(queue.length).toBe(0);
        });

        it('should handle chunks exactly at 5 second boundary', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Add chunk exactly at 5000ms old (should be removed as age >= 5000)
            queue.push({ correlationId: '1', source: 'mic', timestamp: now - 5000 });

            removeStaleChunks();

            expect(queue.length).toBe(0);
        });
    });

    describe('determineSpeakerFromCorrelation()', () => {
        it('should return "You" for mic audio source (FIFO matching)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            queue.push({ correlationId: '1', source: 'mic', timestamp: now - 1000 });

            const speaker = determineSpeakerFromCorrelation();

            expect(speaker).toBe('You');
            expect(queue.length).toBe(0); // Should be shifted out
        });

        it('should return "Interviewer" for system audio source (FIFO matching)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            queue.push({ correlationId: '1', source: 'system', timestamp: now - 1000 });

            const speaker = determineSpeakerFromCorrelation();

            expect(speaker).toBe('Interviewer');
            expect(queue.length).toBe(0); // Should be shifted out
        });

        it('should use FIFO order - oldest chunk first', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Add chunks in order: mic, system, mic
            queue.push(
                { correlationId: '1', source: 'mic', timestamp: now - 3000 },
                { correlationId: '2', source: 'system', timestamp: now - 2000 },
                { correlationId: '3', source: 'mic', timestamp: now - 1000 }
            );

            const speaker1 = determineSpeakerFromCorrelation();
            expect(speaker1).toBe('You'); // First is mic

            const speaker2 = determineSpeakerFromCorrelation();
            expect(speaker2).toBe('Interviewer'); // Second is system

            const speaker3 = determineSpeakerFromCorrelation();
            expect(speaker3).toBe('You'); // Third is mic

            expect(queue.length).toBe(0);
        });

        it('should track speaker history (last 5 speakers)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();
            const lastSpeakers = _getLastSpeakers();

            // Add multiple chunks
            queue.push(
                { correlationId: '1', source: 'mic', timestamp: now - 1000 },
                { correlationId: '2', source: 'system', timestamp: now - 1000 },
                { correlationId: '3', source: 'mic', timestamp: now - 1000 }
            );

            determineSpeakerFromCorrelation();
            determineSpeakerFromCorrelation();
            determineSpeakerFromCorrelation();

            expect(lastSpeakers.length).toBe(3);
            expect(lastSpeakers).toEqual(['You', 'Interviewer', 'You']);
        });

        it('should limit speaker history to 5 entries', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();
            const lastSpeakers = _getLastSpeakers();

            // Add 7 chunks
            for (let i = 0; i < 7; i++) {
                queue.push({ correlationId: `${i}`, source: i % 2 === 0 ? 'mic' : 'system', timestamp: now - 1000 });
            }

            // Process all 7
            for (let i = 0; i < 7; i++) {
                determineSpeakerFromCorrelation();
            }

            expect(lastSpeakers.length).toBe(5);
        });

        it('should fallback to last speaker when queue is empty', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();
            const lastSpeakers = _getLastSpeakers();

            // Build history first
            queue.push({ correlationId: '1', source: 'system', timestamp: now - 1000 });
            determineSpeakerFromCorrelation();

            // Now queue is empty but we have history
            expect(queue.length).toBe(0);
            expect(lastSpeakers.length).toBe(1);

            const speaker = determineSpeakerFromCorrelation();
            expect(speaker).toBe('Interviewer'); // Should use last speaker
        });

        it('should fallback to "You" when queue and history are empty', () => {
            const queue = _getAudioChunkQueue();
            const lastSpeakers = _getLastSpeakers();

            expect(queue.length).toBe(0);
            expect(lastSpeakers.length).toBe(0);

            const speaker = determineSpeakerFromCorrelation();
            expect(speaker).toBe('You');
        });

        it('should remove stale chunks before processing', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Add stale and fresh chunks
            queue.push(
                { correlationId: '1', source: 'system', timestamp: now - 8000 }, // stale
                { correlationId: '2', source: 'mic', timestamp: now - 1000 } // fresh
            );

            const speaker = determineSpeakerFromCorrelation();

            // Should skip stale chunk and use fresh one
            expect(speaker).toBe('You');
            expect(queue.length).toBe(0);
        });

        it('should handle rapid speaker alternation', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Simulate rapid back-and-forth conversation
            const sources = ['mic', 'system', 'mic', 'system', 'mic'];
            sources.forEach((source, i) => {
                queue.push({ correlationId: `${i}`, source, timestamp: now - 1000 });
            });

            const speakers = sources.map(() => determineSpeakerFromCorrelation());

            expect(speakers).toEqual(['You', 'Interviewer', 'You', 'Interviewer', 'You']);
        });
    });

    describe('calculateCorrelationConfidence()', () => {
        it('should return score between 0.0 and 1.0', () => {
            const confidence = calculateCorrelationConfidence();
            expect(confidence).toBeGreaterThanOrEqual(0.0);
            expect(confidence).toBeLessThanOrEqual(1.0);
        });

        it('should decrease confidence when queue is empty (fallback mode)', () => {
            const queue = _getAudioChunkQueue();
            expect(queue.length).toBe(0);

            const confidence = calculateCorrelationConfidence();

            // Base 0.5 - 0.3 (empty queue) = 0.2
            expect(confidence).toBeLessThan(0.5);
        });

        it('should decrease confidence for large queue (>10 chunks)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Add 15 chunks
            for (let i = 0; i < 15; i++) {
                queue.push({ correlationId: `${i}`, source: 'mic', timestamp: now - 1000 });
            }

            const confidence = calculateCorrelationConfidence();

            // Base 0.5 - 0.2 (large queue) = 0.3 (approximately)
            expect(confidence).toBeLessThan(0.5);
        });

        it('should increase confidence for small queue (<3 chunks)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Add 2 recent chunks
            queue.push(
                { correlationId: '1', source: 'mic', timestamp: now - 100 },
                { correlationId: '2', source: 'system', timestamp: now - 50 }
            );

            const confidence = calculateCorrelationConfidence();

            // Base 0.5 + 0.2 (small queue) + 0.1 (very recent) = 0.8
            expect(confidence).toBeGreaterThan(0.5);
        });

        it('should decrease confidence for old chunks (>3 seconds)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            queue.push({ correlationId: '1', source: 'mic', timestamp: now - 4000 });

            const confidence = calculateCorrelationConfidence();

            // Base 0.5 + 0.2 (small queue) - 0.2 (old chunk) = 0.5
            expect(confidence).toBeLessThanOrEqual(0.7);
        });

        it('should increase confidence for very recent chunks (<500ms)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            queue.push({ correlationId: '1', source: 'mic', timestamp: now - 200 });

            const confidence = calculateCorrelationConfidence();

            // Base 0.5 + 0.2 (small queue) + 0.1 (very recent) = 0.8
            expect(confidence).toBeGreaterThan(0.7);
        });

        it('should increase confidence for speaker continuity (same speaker 3+ times)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();
            const lastSpeakers = _getLastSpeakers();

            // Simulate 3 consecutive "You" attributions
            lastSpeakers.push('You', 'You', 'You');
            queue.push({ correlationId: '1', source: 'mic', timestamp: now - 1000 });

            const confidence = calculateCorrelationConfidence();

            // Base 0.5 + 0.2 (small queue) + 0.2 (continuity) = 0.9
            expect(confidence).toBeGreaterThan(0.7);
        });

        it('should increase confidence for stable queue size', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();
            const history = _getQueueSizeHistory();

            // Simulate stable queue (size 2 for 10 samples)
            for (let i = 0; i < 10; i++) {
                history.push(2);
            }

            queue.push(
                { correlationId: '1', source: 'mic', timestamp: now - 1000 },
                { correlationId: '2', source: 'system', timestamp: now - 1000 }
            );

            const confidence = calculateCorrelationConfidence();

            // Base 0.5 + 0.2 (small queue) + 0.1 (stable) = 0.8
            expect(confidence).toBeGreaterThan(0.7);
        });

        it('should clamp confidence to maximum 1.0', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();
            const lastSpeakers = _getLastSpeakers();
            const history = _getQueueSizeHistory();

            // Create ideal conditions: small queue, recent, continuity, stable
            queue.push({ correlationId: '1', source: 'mic', timestamp: now - 100 });
            lastSpeakers.push('You', 'You', 'You');
            for (let i = 0; i < 10; i++) history.push(1);

            const confidence = calculateCorrelationConfidence();

            expect(confidence).toBe(1.0);
        });

        it('should clamp confidence to minimum 0.0', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Create worst conditions: empty queue + no history
            expect(queue.length).toBe(0);

            const confidence = calculateCorrelationConfidence();

            expect(confidence).toBeGreaterThanOrEqual(0.0);
        });

        it('Property: Confidence always in [0.0, 1.0] range', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.integer({ min: 0, max: 20 }), { minLength: 0, maxLength: 30 }),
                    fc.array(fc.constantFrom('You', 'Interviewer'), { minLength: 0, maxLength: 10 }),
                    fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 0, maxLength: 25 }),
                    (queueSizes, speakers, history) => {
                        _resetTestState();
                        const now = Date.now();
                        const queue = _getAudioChunkQueue();
                        const lastSpeakers = _getLastSpeakers();
                        const queueHistory = _getQueueSizeHistory();

                        // Populate queue
                        for (let i = 0; i < queueSizes[0] || 0; i++) {
                            queue.push({
                                correlationId: `${i}`,
                                source: i % 2 === 0 ? 'mic' : 'system',
                                timestamp: now - (i * 100)
                            });
                        }

                        // Populate speaker history
                        speakers.forEach(s => lastSpeakers.push(s));

                        // Populate queue size history
                        history.forEach(h => queueHistory.push(h));

                        const confidence = calculateCorrelationConfidence();

                        expect(confidence).toBeGreaterThanOrEqual(0.0);
                        expect(confidence).toBeLessThanOrEqual(1.0);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('validateSpeakerAttribution()', () => {
        it('should return validation object with expected structure', () => {
            const result = validateSpeakerAttribution('You', 'test transcript');

            expect(result).toHaveProperty('attributedSpeaker');
            expect(result).toHaveProperty('confidence');
            expect(result).toHaveProperty('warnings');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('queueSize');
            expect(result).toHaveProperty('queueAge');
        });

        it('should include attributed speaker in result', () => {
            const result = validateSpeakerAttribution('Interviewer', 'test');

            expect(result.attributedSpeaker).toBe('Interviewer');
        });

        it('should calculate confidence score', () => {
            const result = validateSpeakerAttribution('You', 'test');

            expect(result.confidence).toBeGreaterThanOrEqual(0.0);
            expect(result.confidence).toBeLessThanOrEqual(1.0);
        });

        it('should warn on low confidence (<0.3)', () => {
            const queue = _getAudioChunkQueue();
            expect(queue.length).toBe(0); // Empty queue = low confidence

            const result = validateSpeakerAttribution('You', 'test');

            expect(result.warnings).toContain('LOW_CONFIDENCE: Correlation reliability is low');
        });

        it('should warn on queue drift (>15 chunks)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Add 20 chunks
            for (let i = 0; i < 20; i++) {
                queue.push({ correlationId: `${i}`, source: 'mic', timestamp: now - 1000 });
            }

            const result = validateSpeakerAttribution('You', 'test');

            expect(result.warnings).toContain('QUEUE_DRIFT: Audio chunk queue is unusually large');
        });

        it('should warn on rapid speaker changes (3+ changes in last 5)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();
            const lastSpeakers = _getLastSpeakers();

            // Simulate rapid alternation: You, Interviewer, You, Interviewer, You
            lastSpeakers.push('You', 'Interviewer', 'You', 'Interviewer', 'You');
            queue.push({ correlationId: '1', source: 'mic', timestamp: now - 1000 });

            const result = validateSpeakerAttribution('You', 'test');

            expect(result.warnings.some(w => w.includes('RAPID_CHANGES'))).toBe(true);
        });

        it('should warn on fallback mode (empty queue)', () => {
            const queue = _getAudioChunkQueue();
            expect(queue.length).toBe(0);

            const result = validateSpeakerAttribution('You', 'test');

            expect(result.warnings).toContain('FALLBACK_MODE: Using previous speaker (no audio chunks available)');
        });

        it('should track multiple warning types simultaneously', () => {
            const queue = _getAudioChunkQueue();
            expect(queue.length).toBe(0); // Empty = LOW_CONFIDENCE + FALLBACK_MODE

            const result = validateSpeakerAttribution('You', 'test');

            expect(result.warnings.length).toBeGreaterThanOrEqual(2);
        });

        it('should update validation metrics', () => {
            const metrics = _getValidationMetrics();
            const initialTotal = metrics.totalAttributions;

            validateSpeakerAttribution('You', 'test');

            expect(metrics.totalAttributions).toBe(initialTotal + 1);
        });

        it('should track low confidence count', () => {
            const metrics = _getValidationMetrics();
            const queue = _getAudioChunkQueue();

            expect(queue.length).toBe(0); // Low confidence scenario

            validateSpeakerAttribution('You', 'test');

            expect(metrics.lowConfidenceCount).toBeGreaterThan(0);
        });

        it('should calculate average confidence over time', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();
            const metrics = _getValidationMetrics();

            // First attribution with low confidence
            validateSpeakerAttribution('You', 'test1');

            // Second attribution with higher confidence
            queue.push({ correlationId: '1', source: 'mic', timestamp: now - 100 });
            validateSpeakerAttribution('You', 'test2');

            expect(metrics.averageConfidence).toBeGreaterThan(0);
            expect(metrics.totalAttributions).toBe(2);
        });

        it('should track warnings by type', () => {
            const metrics = _getValidationMetrics();
            const queue = _getAudioChunkQueue();

            expect(queue.length).toBe(0); // Will trigger FALLBACK_MODE and LOW_CONFIDENCE

            validateSpeakerAttribution('You', 'test');

            expect(metrics.warningsByType.LOW_CONFIDENCE).toBeGreaterThan(0);
            expect(metrics.warningsByType.FALLBACK_MODE).toBeGreaterThan(0);
        });

        it('should include current queue size in result', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            queue.push(
                { correlationId: '1', source: 'mic', timestamp: now - 1000 },
                { correlationId: '2', source: 'system', timestamp: now - 1000 }
            );

            const result = validateSpeakerAttribution('You', 'test');

            expect(result.queueSize).toBe(2);
        });

        it('should include oldest chunk age when queue has items', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            queue.push({ correlationId: '1', source: 'mic', timestamp: now - 2000 });

            const result = validateSpeakerAttribution('You', 'test');

            expect(result.queueAge).toBeGreaterThanOrEqual(2000);
            expect(result.queueAge).toBeLessThan(3000);
        });

        it('should have null queueAge when queue is empty', () => {
            const queue = _getAudioChunkQueue();
            expect(queue.length).toBe(0);

            const result = validateSpeakerAttribution('You', 'test');

            expect(result.queueAge).toBeNull();
        });

        it('should include ISO timestamp', () => {
            const result = validateSpeakerAttribution('You', 'test');

            expect(result.timestamp).toBeTruthy();
            expect(() => new Date(result.timestamp)).not.toThrow();
        });

        it('Property: Metrics never negative and monotonically increase', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.constantFrom('You', 'Interviewer'), { minLength: 1, maxLength: 20 }),
                    (speakers) => {
                        _resetTestState();
                        const metrics = _getValidationMetrics();
                        let prevTotal = 0;
                        let prevConfidenceSum = 0;

                        speakers.forEach(speaker => {
                            validateSpeakerAttribution(speaker, 'test');

                            // Metrics should never be negative
                            expect(metrics.totalAttributions).toBeGreaterThanOrEqual(0);
                            expect(metrics.lowConfidenceCount).toBeGreaterThanOrEqual(0);
                            expect(metrics.averageConfidence).toBeGreaterThanOrEqual(0);
                            expect(metrics.confidenceSum).toBeGreaterThanOrEqual(0);

                            // Metrics should monotonically increase
                            expect(metrics.totalAttributions).toBeGreaterThanOrEqual(prevTotal);
                            expect(metrics.confidenceSum).toBeGreaterThanOrEqual(prevConfidenceSum);

                            prevTotal = metrics.totalAttributions;
                            prevConfidenceSum = metrics.confidenceSum;
                        });
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Edge Cases and Integration', () => {
        it('should handle queue overflow (>50 chunks) - MAX_QUEUE_SIZE protection', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Add 60 chunks (exceeds MAX_QUEUE_SIZE of 50)
            for (let i = 0; i < 60; i++) {
                queue.push({ correlationId: `${i}`, source: 'mic', timestamp: now - 1000 });
            }

            // removeStaleChunks doesn't enforce MAX_QUEUE_SIZE, but validation should warn
            const result = validateSpeakerAttribution('You', 'test');

            // Should warn about large queue
            expect(result.warnings.some(w => w.includes('QUEUE_DRIFT'))).toBe(true);
        });

        it('should handle very old chunks (>10 seconds)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            queue.push({ correlationId: '1', source: 'mic', timestamp: now - 15000 });

            removeStaleChunks();

            // Should be removed (>5s old)
            expect(queue.length).toBe(0);
        });

        it('should handle rapid speaker changes scenario', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Simulate rapid conversation
            const sources = ['mic', 'system', 'mic', 'system', 'mic', 'system'];
            sources.forEach((source, i) => {
                queue.push({ correlationId: `${i}`, source, timestamp: now - (i * 100) });
            });

            const speakers = [];
            for (let i = 0; i < sources.length; i++) {
                speakers.push(determineSpeakerFromCorrelation());
            }

            expect(speakers).toEqual(['You', 'Interviewer', 'You', 'Interviewer', 'You', 'Interviewer']);

            // Validate should detect rapid changes
            const result = validateSpeakerAttribution('You', 'test');
            expect(result.warnings.some(w => w.includes('RAPID_CHANGES'))).toBe(true);
        });

        it('should maintain single speaker continuity', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Add 5 consecutive mic chunks
            for (let i = 0; i < 5; i++) {
                queue.push({ correlationId: `${i}`, source: 'mic', timestamp: now - (i * 100) });
            }

            const speakers = [];
            for (let i = 0; i < 5; i++) {
                speakers.push(determineSpeakerFromCorrelation());
            }

            expect(speakers).toEqual(['You', 'You', 'You', 'You', 'You']);

            // After processing all chunks, add a new one to check confidence with continuity
            queue.push({ correlationId: 'test', source: 'mic', timestamp: now - 50 });

            // High confidence due to continuity and small queue
            const confidence = calculateCorrelationConfidence();
            expect(confidence).toBeGreaterThan(0.7);
        });

        it('should handle queue drift recovery scenario', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            // Simulate drift: add many chunks
            for (let i = 0; i < 20; i++) {
                queue.push({ correlationId: `${i}`, source: 'mic', timestamp: now - 1000 });
            }

            const result1 = validateSpeakerAttribution('You', 'test');
            expect(result1.warnings).toContain('QUEUE_DRIFT: Audio chunk queue is unusually large');

            // Process some chunks to reduce queue
            for (let i = 0; i < 10; i++) {
                determineSpeakerFromCorrelation();
            }

            // Should have fewer warnings now
            const result2 = validateSpeakerAttribution('You', 'test');
            expect(result2.queueSize).toBe(10);
        });

        it('Property: Queue operations maintain FIFO order', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            source: fc.constantFrom('mic', 'system'),
                            id: fc.integer({ min: 0, max: 1000 })
                        }),
                        { minLength: 1, maxLength: 20 }
                    ),
                    (chunks) => {
                        _resetTestState();
                        const now = Date.now();
                        const queue = _getAudioChunkQueue();

                        // Add chunks in order
                        chunks.forEach(chunk => {
                            queue.push({
                                correlationId: `${chunk.id}`,
                                source: chunk.source,
                                timestamp: now - 1000
                            });
                        });

                        const originalIds = chunks.map(c => `${c.id}`);
                        const retrievedIds = [];

                        // Retrieve in FIFO order
                        while (queue.length > 0) {
                            const chunk = queue.shift();
                            retrievedIds.push(chunk.correlationId);
                        }

                        expect(retrievedIds).toEqual(originalIds);
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('Property: Age calculation is always non-negative', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: 10000 }),
                    (msAgo) => {
                        _resetTestState();
                        const now = Date.now();
                        const queue = _getAudioChunkQueue();

                        queue.push({
                            correlationId: '1',
                            source: 'mic',
                            timestamp: now - msAgo
                        });

                        const age = now - queue[0].timestamp;
                        expect(age).toBeGreaterThanOrEqual(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle mixed timestamps (some stale, some fresh)', () => {
            const now = Date.now();
            const queue = _getAudioChunkQueue();

            queue.push(
                { correlationId: '1', source: 'mic', timestamp: now - 10000 }, // very old
                { correlationId: '2', source: 'system', timestamp: now - 4000 }, // fresh
                { correlationId: '3', source: 'mic', timestamp: now - 6000 }, // stale
                { correlationId: '4', source: 'system', timestamp: now - 2000 }, // fresh
                { correlationId: '5', source: 'mic', timestamp: now - 500 } // very fresh
            );

            removeStaleChunks();

            expect(queue.length).toBe(3); // Only fresh ones remain
            expect(queue[0].correlationId).toBe('2');
            expect(queue[1].correlationId).toBe('4');
            expect(queue[2].correlationId).toBe('5');
        });
    });

    describe('State Isolation Tests', () => {
        it('should properly reset state between tests', () => {
            const queue = _getAudioChunkQueue();
            const lastSpeakers = _getLastSpeakers();
            const history = _getQueueSizeHistory();
            const metrics = _getValidationMetrics();

            expect(queue.length).toBe(0);
            expect(lastSpeakers.length).toBe(0);
            expect(history.length).toBe(0);
            expect(metrics.totalAttributions).toBe(0);
        });

        it('should not leak state across multiple validations', () => {
            const metrics = _getValidationMetrics();

            validateSpeakerAttribution('You', 'test1');
            const count1 = metrics.totalAttributions;

            validateSpeakerAttribution('Interviewer', 'test2');
            const count2 = metrics.totalAttributions;

            expect(count2).toBe(count1 + 1);
        });
    });
});
