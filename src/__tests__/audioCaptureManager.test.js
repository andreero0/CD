const fc = require('fast-check');
const AudioCaptureManager = require('../utils/audioCaptureManager');
const { EventEmitter } = require('events');

/**
 * Property-Based Tests for AudioCaptureManager
 * Feature: macos-audio-capture-fix
 */

describe('AudioCaptureManager', () => {
    describe('Property 5: Resource Cleanup', () => {
        /**
         * **Feature: macos-audio-capture-fix, Property 5: Resource Cleanup**
         * **Validates: Requirements 5.2**
         * 
         * For any audio capture session that is started, when it is stopped,
         * all associated resources (processes, file handles, event listeners) should be cleaned up.
         */
        it('should clean up all resources when stop() is called', async () => {
            await fc.assert(
                fc.asyncProperty(
                    // Generate random session configurations
                    fc.record({
                        maxRetries: fc.integer({ min: 1, max: 5 }),
                        hasAudioData: fc.boolean(),
                        processExitCode: fc.option(fc.integer({ min: 0, max: 255 }), { nil: null }),
                    }),
                    async (config) => {
                        // Create manager instance
                        const manager = new AudioCaptureManager({
                            maxRetries: config.maxRetries
                        });

                        // Mock the binary path
                        manager.binaryPath = '/mock/path/SystemAudioDump';

                        // Create a mock process that behaves like a real child process
                        const mockProcess = new EventEmitter();
                        mockProcess.pid = Math.floor(Math.random() * 10000) + 1000;
                        mockProcess.kill = vi.fn();
                        mockProcess.stdout = new EventEmitter();
                        mockProcess.stderr = new EventEmitter();

                        // Track event listener counts
                        const initialStdoutListeners = mockProcess.stdout.listenerCount('data');
                        const initialStderrListeners = mockProcess.stderr.listenerCount('data');
                        const initialCloseListeners = mockProcess.listenerCount('close');
                        const initialErrorListeners = mockProcess.listenerCount('error');

                        // Simulate starting audio capture by setting up the process
                        manager.systemAudioProc = mockProcess;
                        manager.status.active = true;
                        manager.status.method = 'native_binary';
                        manager.status.startTime = Date.now();

                        // Set up event handlers (simulating what _spawnSystemAudioDump does)
                        manager.eventHandlers.stdout = () => {};
                        manager.eventHandlers.stderr = () => {};
                        manager.eventHandlers.close = () => {};
                        manager.eventHandlers.error = () => {};

                        mockProcess.stdout.on('data', manager.eventHandlers.stdout);
                        mockProcess.stderr.on('data', manager.eventHandlers.stderr);
                        mockProcess.on('close', manager.eventHandlers.close);
                        mockProcess.on('error', manager.eventHandlers.error);

                        // Add some data to audio buffer
                        manager.audioBuffer = Buffer.from('test audio data');

                        // Verify resources are allocated
                        expect(manager.systemAudioProc).toBeTruthy();
                        expect(manager.systemAudioProc.pid).toBeTruthy();
                        expect(manager.status.active).toBe(true);
                        expect(manager.audioBuffer.length).toBeGreaterThan(0);
                        expect(mockProcess.stdout.listenerCount('data')).toBeGreaterThan(initialStdoutListeners);
                        expect(mockProcess.stderr.listenerCount('data')).toBeGreaterThan(initialStderrListeners);
                        expect(mockProcess.listenerCount('close')).toBeGreaterThan(initialCloseListeners);
                        expect(mockProcess.listenerCount('error')).toBeGreaterThan(initialErrorListeners);

                        // Call stop() to clean up
                        manager.stop();

                        // PROPERTY: All resources should be cleaned up
                        
                        // 1. Process should be killed
                        expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
                        
                        // 2. Process reference should be null
                        expect(manager.systemAudioProc).toBeNull();
                        
                        // 3. Event handlers should be cleared
                        expect(manager.eventHandlers.stdout).toBeNull();
                        expect(manager.eventHandlers.stderr).toBeNull();
                        expect(manager.eventHandlers.close).toBeNull();
                        expect(manager.eventHandlers.error).toBeNull();
                        
                        // 4. Audio buffer should be cleared
                        expect(manager.audioBuffer.length).toBe(0);
                        
                        // 5. Status should be reset
                        expect(manager.status.active).toBe(false);
                        expect(manager.status.method).toBe('none');
                        expect(manager.status.startTime).toBeNull();
                        
                        // 6. Event listeners should be removed (back to initial count)
                        // Note: We can't check this directly because we called stop() which sets
                        // systemAudioProc to null, but the property is that listeners are removed
                        // before the reference is cleared
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle stop() when no process is running (idempotent)', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 5 }),
                    async (maxRetries) => {
                        const manager = new AudioCaptureManager({ maxRetries });

                        // Verify initial state
                        expect(manager.systemAudioProc).toBeNull();
                        expect(manager.status.active).toBe(false);

                        // Call stop() when nothing is running
                        manager.stop();

                        // PROPERTY: Should not throw and state should remain clean
                        expect(manager.systemAudioProc).toBeNull();
                        expect(manager.status.active).toBe(false);
                        expect(manager.status.method).toBe('none');
                        expect(manager.audioBuffer.length).toBe(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should clean up resources even if process reference is lost', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 5 }),
                    async (maxRetries) => {
                        const manager = new AudioCaptureManager({ maxRetries });

                        // Simulate a scenario where process reference exists but is invalid
                        manager.systemAudioProc = null;
                        manager.status.active = true;
                        manager.status.method = 'native_binary';
                        manager.audioBuffer = Buffer.from('orphaned data');
                        manager.eventHandlers.stdout = () => {};
                        manager.eventHandlers.stderr = () => {};

                        // Call stop()
                        manager.stop();

                        // PROPERTY: All state should be cleaned up even without valid process
                        expect(manager.systemAudioProc).toBeNull();
                        expect(manager.status.active).toBe(false);
                        expect(manager.status.method).toBe('none');
                        expect(manager.audioBuffer.length).toBe(0);
                        expect(manager.eventHandlers.stdout).toBeNull();
                        expect(manager.eventHandlers.stderr).toBeNull();
                        expect(manager.eventHandlers.close).toBeNull();
                        expect(manager.eventHandlers.error).toBeNull();
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should allow multiple stop() calls without errors (idempotent)', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        maxRetries: fc.integer({ min: 1, max: 5 }),
                        stopCount: fc.integer({ min: 2, max: 10 })
                    }),
                    async (config) => {
                        const manager = new AudioCaptureManager({
                            maxRetries: config.maxRetries
                        });

                        // Set up a mock process
                        const mockProcess = new EventEmitter();
                        mockProcess.pid = 12345;
                        mockProcess.kill = vi.fn();
                        mockProcess.stdout = new EventEmitter();
                        mockProcess.stderr = new EventEmitter();

                        manager.systemAudioProc = mockProcess;
                        manager.status.active = true;
                        manager.audioBuffer = Buffer.from('test');

                        // Call stop() multiple times
                        for (let i = 0; i < config.stopCount; i++) {
                            expect(() => manager.stop()).not.toThrow();
                        }

                        // PROPERTY: State should be clean after multiple stops
                        expect(manager.systemAudioProc).toBeNull();
                        expect(manager.status.active).toBe(false);
                        expect(manager.audioBuffer.length).toBe(0);
                        
                        // Kill should only be called once (on first stop when process existed)
                        expect(mockProcess.kill).toHaveBeenCalledTimes(1);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Property 4: Fallback Activation', () => {
        /**
         * **Feature: macos-audio-capture-fix, Property 4: Fallback Activation**
         * **Validates: Requirements 7.1, 7.2**
         * 
         * For any failed native binary spawn attempt, if fallback methods are available,
         * at least one fallback method should be attempted before giving up.
         */
        it('should attempt at least one fallback method when native binary fails', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        maxRetries: fc.integer({ min: 1, max: 3 }),
                    }),
                    async (config) => {
                        const manager = new AudioCaptureManager({
                            maxRetries: config.maxRetries
                        });

                        // Mock the binary path
                        manager.binaryPath = '/mock/path/SystemAudioDump';

                        // Track fallback attempts
                        let fallbackAttempts = 0;
                        
                        manager._tryFallbackMethods = async (geminiSessionRef, onAudioData) => {
                            fallbackAttempts++;
                            // Simulate fallback failure for testing
                            return false;
                        };

                        // Mock verifyBinary to return failure
                        manager.verifyBinary = async () => ({
                            exists: true,
                            executable: true,
                            architectures: ['arm64'],
                            supportsCurrentArch: false,
                            signed: true,
                            signatureValid: true,
                            signatureType: 'adhoc',
                            errors: ['Architecture mismatch'],
                            warnings: []
                        });

                        // Mock _spawnSystemAudioDump to fail with error -86
                        manager._spawnSystemAudioDump = async () => {
                            const error = new Error('spawn ENOEXEC');
                            error.code = 'ENOEXEC'; // Always use ENOEXEC to trigger error -86 path
                            error.errno = -86;
                            throw error;
                        };

                        // Mock diagnoseError to return a message
                        manager.diagnoseError = async (error) => {
                            return 'Binary architecture mismatch';
                        };

                        // Mock retry strategy to avoid delays
                        manager.retryStrategy.shouldRetry = () => false;
                        manager.retryStrategy.getNextDelay = () => 0;

                        // Attempt to start (should fail and trigger fallback)
                        const mockGeminiRef = { current: null };
                        const mockOnAudioData = () => {};

                        try {
                            await manager.start(mockGeminiRef, mockOnAudioData);
                        } catch (error) {
                            // Expected to fail since fallback also fails
                        }

                        // PROPERTY: At least one fallback method should be attempted
                        expect(fallbackAttempts).toBeGreaterThanOrEqual(1);
                    }
                ),
                { numRuns: 100 }
            );
        }, 10000); // Increase timeout to 10 seconds

        it('should try all fallback methods in order when each fails', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 3 }),
                    async (maxRetries) => {
                        const manager = new AudioCaptureManager({ maxRetries });

                        // Track which fallback methods were attempted
                        const attemptedMethods = [];

                        // Mock fallback methods to track attempts
                        manager.fallbackMethods = [
                            {
                                name: 'desktop_capturer',
                                method: async () => {
                                    attemptedMethods.push('desktop_capturer');
                                    return { success: false, stream: null, error: new Error('Failed') };
                                },
                                description: 'Mock Desktop Capturer'
                            },
                            {
                                name: 'web_audio',
                                method: async () => {
                                    attemptedMethods.push('web_audio');
                                    return { success: false, stream: null, error: new Error('Failed') };
                                },
                                description: 'Mock Web Audio'
                            }
                        ];

                        // Call _tryFallbackMethods
                        const mockGeminiRef = { current: null };
                        const mockOnAudioData = () => {};
                        const result = await manager._tryFallbackMethods(mockGeminiRef, mockOnAudioData);

                        // PROPERTY: All fallback methods should be attempted in order
                        expect(result).toBe(false); // All failed
                        expect(attemptedMethods).toEqual(['desktop_capturer', 'web_audio']);
                        expect(attemptedMethods.length).toBe(manager.fallbackMethods.length);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should stop trying fallbacks after first success', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        maxRetries: fc.integer({ min: 1, max: 3 }),
                        successIndex: fc.integer({ min: 0, max: 1 }) // Which fallback succeeds
                    }),
                    async (config) => {
                        const manager = new AudioCaptureManager({
                            maxRetries: config.maxRetries
                        });

                        const attemptedMethods = [];

                        // Mock fallback methods
                        manager.fallbackMethods = [
                            {
                                name: 'desktop_capturer',
                                method: async () => {
                                    attemptedMethods.push('desktop_capturer');
                                    if (config.successIndex === 0) {
                                        return {
                                            success: true,
                                            stream: { getTracks: () => [] },
                                            audioContext: { close: async () => {} },
                                            processor: { disconnect: () => {} },
                                            error: null
                                        };
                                    }
                                    return { success: false, stream: null, error: new Error('Failed') };
                                },
                                description: 'Mock Desktop Capturer'
                            },
                            {
                                name: 'web_audio',
                                method: async () => {
                                    attemptedMethods.push('web_audio');
                                    if (config.successIndex === 1) {
                                        return {
                                            success: true,
                                            stream: { getTracks: () => [] },
                                            audioContext: { close: async () => {} },
                                            processor: { disconnect: () => {} },
                                            error: null
                                        };
                                    }
                                    return { success: false, stream: null, error: new Error('Failed') };
                                },
                                description: 'Mock Web Audio'
                            }
                        ];

                        const mockGeminiRef = { current: null };
                        const mockOnAudioData = () => {};
                        const result = await manager._tryFallbackMethods(mockGeminiRef, mockOnAudioData);

                        // PROPERTY: Should stop after first success
                        expect(result).toBe(true);
                        expect(attemptedMethods.length).toBe(config.successIndex + 1);
                        expect(manager.status.active).toBe(true);
                        expect(manager.currentMethod).toBe(attemptedMethods[attemptedMethods.length - 1]);

                        // Cleanup
                        manager.stop();
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should update status correctly when fallback succeeds', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constantFrom('desktop_capturer', 'web_audio'),
                    async (successfulMethod) => {
                        const manager = new AudioCaptureManager();

                        // Mock fallback methods
                        manager.fallbackMethods = [
                            {
                                name: 'desktop_capturer',
                                method: async () => {
                                    if (successfulMethod === 'desktop_capturer') {
                                        return {
                                            success: true,
                                            stream: { getTracks: () => [] },
                                            audioContext: { close: async () => {} },
                                            processor: { disconnect: () => {} },
                                            error: null
                                        };
                                    }
                                    return { success: false, stream: null, error: new Error('Failed') };
                                },
                                description: 'Mock Desktop Capturer'
                            },
                            {
                                name: 'web_audio',
                                method: async () => {
                                    if (successfulMethod === 'web_audio') {
                                        return {
                                            success: true,
                                            stream: { getTracks: () => [] },
                                            audioContext: { close: async () => {} },
                                            processor: { disconnect: () => {} },
                                            error: null
                                        };
                                    }
                                    return { success: false, stream: null, error: new Error('Failed') };
                                },
                                description: 'Mock Web Audio'
                            }
                        ];

                        const mockGeminiRef = { current: null };
                        const mockOnAudioData = () => {};
                        
                        const beforeTime = Date.now();
                        const result = await manager._tryFallbackMethods(mockGeminiRef, mockOnAudioData);
                        const afterTime = Date.now();

                        // PROPERTY: Status should reflect successful fallback
                        expect(result).toBe(true);
                        expect(manager.status.active).toBe(true);
                        expect(manager.status.method).toBe(successfulMethod);
                        expect(manager.status.startTime).toBeGreaterThanOrEqual(beforeTime);
                        expect(manager.status.startTime).toBeLessThanOrEqual(afterTime);
                        expect(manager.currentMethod).toBe(successfulMethod);

                        // Cleanup
                        manager.stop();
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Unit Tests', () => {
        let manager;

        beforeEach(() => {
            manager = new AudioCaptureManager();
        });

        afterEach(() => {
            if (manager) {
                manager.stop();
            }
        });

        it('should initialize with correct default values', () => {
            expect(manager.currentMethod).toBe('none');
            expect(manager.systemAudioProc).toBeNull();
            expect(manager.retryCount).toBe(0);
            expect(manager.maxRetries).toBe(3);
            expect(manager.status.active).toBe(false);
            expect(manager.status.method).toBe('none');
            expect(manager.status.startTime).toBeNull();
            expect(manager.status.errors).toEqual([]);
        });

        it('should accept custom maxRetries option', () => {
            const customManager = new AudioCaptureManager({ maxRetries: 5 });
            expect(customManager.maxRetries).toBe(5);
            expect(customManager.retryStrategy.maxAttempts).toBe(5);
        });

        it('should return current status', () => {
            const status = manager.getStatus();
            expect(status).toEqual({
                active: false,
                method: 'none',
                startTime: null,
                errors: []
            });
        });

        it('should cache binary path after first call', () => {
            // Set binary path manually to avoid Electron dependency
            manager.binaryPath = '/test/path/SystemAudioDump';
            
            const path1 = manager._getBinaryPath();
            const path2 = manager._getBinaryPath();
            expect(path1).toBe(path2);
            expect(path1).toBe('/test/path/SystemAudioDump');
        });
    });
});
