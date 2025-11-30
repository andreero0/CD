/**
 * Property-Based Tests for Retry Strategy Module
 * Feature: macos-audio-capture-fix
 */

const fc = require('fast-check');
const RetryStrategy = require('../utils/retryStrategy');

describe('RetryStrategy', () => {
    describe('Basic functionality', () => {
        it('should initialize with default values', () => {
            const strategy = new RetryStrategy();
            expect(strategy.maxAttempts).toBe(3);
            expect(strategy.baseDelay).toBe(1000);
            expect(strategy.maxDelay).toBe(10000);
            expect(strategy.getAttemptCount()).toBe(0);
        });

        it('should initialize with custom values', () => {
            const strategy = new RetryStrategy({
                maxAttempts: 5,
                baseDelay: 500,
                maxDelay: 5000
            });
            expect(strategy.maxAttempts).toBe(5);
            expect(strategy.baseDelay).toBe(500);
            expect(strategy.maxDelay).toBe(5000);
        });

        it('should increment attempt count on getNextDelay', () => {
            const strategy = new RetryStrategy();
            expect(strategy.getAttemptCount()).toBe(0);
            
            strategy.getNextDelay();
            expect(strategy.getAttemptCount()).toBe(1);
            
            strategy.getNextDelay();
            expect(strategy.getAttemptCount()).toBe(2);
        });

        it('should reset attempt count', () => {
            const strategy = new RetryStrategy();
            strategy.getNextDelay();
            strategy.getNextDelay();
            expect(strategy.getAttemptCount()).toBe(2);
            
            strategy.reset();
            expect(strategy.getAttemptCount()).toBe(0);
        });

        it('should return false for shouldRetry when max attempts reached', () => {
            const strategy = new RetryStrategy({ maxAttempts: 2 });
            expect(strategy.shouldRetry()).toBe(true);
            
            strategy.getNextDelay();
            expect(strategy.shouldRetry()).toBe(true);
            
            strategy.getNextDelay();
            expect(strategy.shouldRetry()).toBe(false);
        });
    });

    describe('Exponential backoff behavior', () => {
        it('should produce exponential delays: 1s, 2s, 4s, 8s', () => {
            const strategy = new RetryStrategy({ baseDelay: 1000, maxDelay: 10000 });
            
            expect(strategy.getNextDelay()).toBe(1000);  // 1s * 2^0 = 1s
            expect(strategy.getNextDelay()).toBe(2000);  // 1s * 2^1 = 2s
            expect(strategy.getNextDelay()).toBe(4000);  // 1s * 2^2 = 4s
            expect(strategy.getNextDelay()).toBe(8000);  // 1s * 2^3 = 8s
        });

        it('should cap delays at maxDelay', () => {
            const strategy = new RetryStrategy({ 
                baseDelay: 1000, 
                maxDelay: 5000,
                maxAttempts: 10 
            });
            
            expect(strategy.getNextDelay()).toBe(1000);  // 1s
            expect(strategy.getNextDelay()).toBe(2000);  // 2s
            expect(strategy.getNextDelay()).toBe(4000);  // 4s
            expect(strategy.getNextDelay()).toBe(5000);  // capped at 5s
            expect(strategy.getNextDelay()).toBe(5000);  // still capped
        });
    });

    /**
     * **Feature: macos-audio-capture-fix, Property 6: Retry Backoff**
     * **Validates: Requirements 4.5**
     * 
     * Property: For any sequence of failed capture attempts, the delay between 
     * retries should increase exponentially (not constant or random).
     */
    describe('Property 6: Retry Backoff', () => {
        it('should always produce exponentially increasing delays until max', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 100, max: 5000 }),  // baseDelay
                    fc.integer({ min: 5000, max: 30000 }), // maxDelay
                    fc.integer({ min: 2, max: 10 }),       // maxAttempts
                    (baseDelay, maxDelay, maxAttempts) => {
                        const strategy = new RetryStrategy({ baseDelay, maxDelay, maxAttempts });
                        
                        const delays = [];
                        let previousDelay = 0;
                        
                        // Generate delays up to maxAttempts
                        for (let i = 0; i < maxAttempts; i++) {
                            const delay = strategy.getNextDelay();
                            delays.push(delay);
                            
                            // Verify delay is not negative
                            expect(delay).toBeGreaterThanOrEqual(0);
                            
                            // Verify delay does not exceed maxDelay
                            expect(delay).toBeLessThanOrEqual(maxDelay);
                            
                            // Verify exponential growth or capping
                            if (previousDelay > 0 && previousDelay < maxDelay) {
                                // If not yet at max, delay should be at least as large as previous
                                // (exponential growth means it should double or hit the cap)
                                expect(delay).toBeGreaterThanOrEqual(previousDelay);
                            }
                            
                            previousDelay = delay;
                        }
                        
                        // Verify we got the expected number of delays
                        expect(delays.length).toBe(maxAttempts);
                        
                        // Verify first delay matches expected formula: baseDelay * 2^0 = baseDelay
                        const expectedFirstDelay = Math.min(baseDelay, maxDelay);
                        expect(delays[0]).toBe(expectedFirstDelay);
                        
                        // Verify delays are monotonically non-decreasing
                        for (let i = 1; i < delays.length; i++) {
                            expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
                        }
                        
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should produce consistent delays for same configuration', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 100, max: 2000 }),
                    fc.integer({ min: 5000, max: 15000 }),
                    fc.integer({ min: 2, max: 5 }),
                    (baseDelay, maxDelay, maxAttempts) => {
                        // Create two strategies with same config
                        const strategy1 = new RetryStrategy({ baseDelay, maxDelay, maxAttempts });
                        const strategy2 = new RetryStrategy({ baseDelay, maxDelay, maxAttempts });
                        
                        // Generate delays from both
                        const delays1 = [];
                        const delays2 = [];
                        
                        for (let i = 0; i < maxAttempts; i++) {
                            delays1.push(strategy1.getNextDelay());
                            delays2.push(strategy2.getNextDelay());
                        }
                        
                        // Verify they produce identical sequences
                        expect(delays1).toEqual(delays2);
                        
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should reset to initial state after reset()', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 100, max: 2000 }),
                    fc.integer({ min: 5000, max: 15000 }),
                    fc.integer({ min: 2, max: 5 }),
                    fc.integer({ min: 1, max: 3 }), // number of times to call getNextDelay before reset
                    (baseDelay, maxDelay, maxAttempts, callsBeforeReset) => {
                        const strategy = new RetryStrategy({ baseDelay, maxDelay, maxAttempts });
                        
                        // Get first delay
                        const firstDelay = strategy.getNextDelay();
                        
                        // Make some more calls
                        for (let i = 1; i < callsBeforeReset; i++) {
                            strategy.getNextDelay();
                        }
                        
                        // Reset
                        strategy.reset();
                        
                        // Get delay after reset - should match first delay
                        const delayAfterReset = strategy.getNextDelay();
                        expect(delayAfterReset).toBe(firstDelay);
                        
                        // Verify attempt count is 1 after reset and one call
                        expect(strategy.getAttemptCount()).toBe(1);
                        
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should correctly implement exponential formula: min(baseDelay * 2^attempts, maxDelay)', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 100, max: 2000 }),
                    fc.integer({ min: 5000, max: 20000 }),
                    (baseDelay, maxDelay) => {
                        const strategy = new RetryStrategy({ baseDelay, maxDelay, maxAttempts: 10 });
                        
                        for (let attempt = 0; attempt < 10; attempt++) {
                            const delay = strategy.getNextDelay();
                            const expectedDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
                            
                            expect(delay).toBe(expectedDelay);
                        }
                        
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should respect shouldRetry() boundary', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 10 }),
                    (maxAttempts) => {
                        const strategy = new RetryStrategy({ maxAttempts });
                        
                        // shouldRetry should be true before reaching maxAttempts
                        for (let i = 0; i < maxAttempts; i++) {
                            expect(strategy.shouldRetry()).toBe(true);
                            strategy.getNextDelay();
                        }
                        
                        // shouldRetry should be false after maxAttempts
                        expect(strategy.shouldRetry()).toBe(false);
                        
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
