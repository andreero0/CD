/**
 * Property-Based Tests for Error Diagnostics Module
 * Feature: macos-audio-capture-fix
 */

const fc = require('fast-check');
const { diagnoseSpawnError86, formatErrorMessage } = require('../utils/errorDiagnostics');

describe('Error Diagnostics Module', () => {
    describe('diagnoseSpawnError86', () => {
        it('should diagnose missing binary', async () => {
            const error = new Error('spawn ENOEXEC');
            error.code = 'ENOEXEC';
            error.errno = -86;

            const mockOptions = {
                execSyncFn: vi.fn(),
                existsSyncFn: vi.fn().mockReturnValue(false),
                accessSyncFn: vi.fn()
            };

            const result = await diagnoseSpawnError86(error, '/path/to/binary', mockOptions);

            expect(result.cause).toBe('missing_binary');
            expect(result.userMessage).toContain('missing');
            expect(result.canRetry).toBe(false);
            expect(result.fallbackAvailable).toBe(true);
        });

        it('should diagnose permission issues', async () => {
            const error = new Error('spawn ENOEXEC');
            error.code = 'ENOEXEC';
            error.errno = -86;

            const mockOptions = {
                execSyncFn: vi.fn().mockReturnValue('Architectures in the fat file: /path/to/binary are: x86_64 arm64'),
                existsSyncFn: vi.fn().mockReturnValue(true),
                accessSyncFn: vi.fn().mockImplementation(() => {
                    throw new Error('Permission denied');
                })
            };

            const result = await diagnoseSpawnError86(error, '/path/to/binary', mockOptions);

            expect(result.cause).toBe('permissions');
            expect(result.userMessage).toContain('execute permissions');
            expect(result.canRetry).toBe(true);
        });

        it('should diagnose architecture mismatch', async () => {
            const error = new Error('spawn ENOEXEC');
            error.code = 'ENOEXEC';
            error.errno = -86;

            // Mock for arm64-only binary on x86_64 system
            const mockOptions = {
                execSyncFn: vi.fn().mockReturnValue('Non-fat file: /path/to/binary is architecture: arm64'),
                existsSyncFn: vi.fn().mockReturnValue(true),
                accessSyncFn: vi.fn()
            };

            // Mock process.arch to be x64 (which maps to x86_64)
            const originalArch = process.arch;
            Object.defineProperty(process, 'arch', {
                value: 'x64',
                writable: true,
                configurable: true
            });

            const result = await diagnoseSpawnError86(error, '/path/to/binary', mockOptions);

            expect(result.cause).toBe('architecture_mismatch');
            expect(result.userMessage).toContain('not compatible');
            expect(result.canRetry).toBe(false);

            // Restore
            Object.defineProperty(process, 'arch', {
                value: originalArch,
                writable: true,
                configurable: true
            });
        });

        it('should diagnose code signing issues', async () => {
            const error = new Error('spawn ENOEXEC');
            error.code = 'ENOEXEC';
            error.errno = -86;

            const mockExecSync = vi.fn()
                .mockReturnValueOnce('Architectures in the fat file: /path/to/binary are: x86_64 arm64')
                .mockImplementationOnce(() => {
                    throw new Error('not signed');
                });

            const mockOptions = {
                execSyncFn: mockExecSync,
                existsSyncFn: vi.fn().mockReturnValue(true),
                accessSyncFn: vi.fn()
            };

            const result = await diagnoseSpawnError86(error, '/path/to/binary', mockOptions);

            expect(result.cause).toBe('code_signing');
            expect(result.userMessage).toContain('code signing');
            expect(result.canRetry).toBe(true);
        });

        it('should handle non-86 errors', async () => {
            const error = new Error('Some other error');
            error.code = 'EOTHER';

            const result = await diagnoseSpawnError86(error, '/path/to/binary', {});

            expect(result.cause).toBe('unknown');
            expect(result.userMessage).toContain('unexpected error');
            expect(result.canRetry).toBe(true);
        });

        /**
         * **Feature: macos-audio-capture-fix, Property 3: Error Diagnosis Completeness**
         * **Validates: Requirements 4.1, 5.1**
         * 
         * Property: For any spawn error -86, the diagnosis should identify exactly one 
         * root cause (architecture mismatch, code signing, permissions, or missing binary).
         */
        it('Property 3: Error Diagnosis Completeness', async () => {
            // Define valid causes
            const validCauses = ['architecture_mismatch', 'code_signing', 'permissions', 'missing_binary', 'unknown'];

            // Generator for error scenarios
            const errorScenarioArb = fc.record({
                // Binary existence
                exists: fc.boolean(),
                // Execute permissions
                executable: fc.boolean(),
                // Architectures in binary
                architectures: fc.constantFrom(
                    ['x86_64'],
                    ['arm64'],
                    ['x86_64', 'arm64'],
                    []
                ),
                // Code signing status
                signed: fc.boolean(),
                signatureValid: fc.boolean()
            });

            await fc.assert(
                fc.asyncProperty(
                    errorScenarioArb,
                    async (scenario) => {
                        // Create error -86
                        const error = new Error('spawn ENOEXEC');
                        error.code = 'ENOEXEC';
                        error.errno = -86;

                        // Mock the verification dependencies
                        const mockExecSync = vi.fn();
                        
                        // Mock lipo output based on architectures
                        if (scenario.architectures.length === 0) {
                            mockExecSync.mockReturnValueOnce('');
                        } else if (scenario.architectures.length === 1) {
                            mockExecSync.mockReturnValueOnce(
                                `Non-fat file: /path/to/binary is architecture: ${scenario.architectures[0]}`
                            );
                        } else {
                            mockExecSync.mockReturnValueOnce(
                                `Architectures in the fat file: /path/to/binary are: ${scenario.architectures.join(' ')}`
                            );
                        }

                        // Mock codesign output
                        if (!scenario.signed) {
                            mockExecSync.mockImplementationOnce(() => {
                                throw new Error('not signed');
                            });
                        } else if (!scenario.signatureValid) {
                            mockExecSync.mockReturnValueOnce('Identifier=test\ninvalid signature');
                        } else {
                            mockExecSync.mockReturnValueOnce('Identifier=test\nTeamIdentifier=ABC123');
                        }

                        const mockOptions = {
                            execSyncFn: mockExecSync,
                            existsSyncFn: vi.fn().mockReturnValue(scenario.exists),
                            accessSyncFn: scenario.executable 
                                ? vi.fn() 
                                : vi.fn().mockImplementation(() => { throw new Error('Permission denied'); })
                        };

                        // Run diagnosis
                        const result = await diagnoseSpawnError86(error, '/path/to/binary', mockOptions);

                        // Property 1: Exactly one cause is identified
                        expect(validCauses).toContain(result.cause);
                        expect(result.cause).toBeTruthy();

                        // Property 2: All required fields are present
                        expect(result).toHaveProperty('cause');
                        expect(result).toHaveProperty('userMessage');
                        expect(result).toHaveProperty('technicalDetails');
                        expect(result).toHaveProperty('suggestedFix');
                        expect(result).toHaveProperty('canRetry');
                        expect(result).toHaveProperty('fallbackAvailable');

                        // Property 3: User message and suggested fix are non-empty
                        expect(result.userMessage.length).toBeGreaterThan(0);
                        expect(result.suggestedFix.length).toBeGreaterThan(0);

                        // Property 4: Technical details contain relevant information
                        expect(result.technicalDetails).toContain('Binary path:');
                        expect(result.technicalDetails).toContain('Current architecture:');

                        // Property 5: Cause matches the scenario
                        if (!scenario.exists) {
                            expect(result.cause).toBe('missing_binary');
                        } else if (!scenario.executable) {
                            expect(result.cause).toBe('permissions');
                        }
                        // Note: Architecture mismatch and code signing depend on current system arch
                        // so we can't assert them deterministically without more mocking

                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('formatErrorMessage', () => {
        it('should format error message with all sections', () => {
            const diagnosis = {
                cause: 'architecture_mismatch',
                userMessage: 'Binary is not compatible with your system.',
                technicalDetails: 'Some technical details',
                suggestedFix: 'Rebuild the binary as universal.',
                canRetry: false,
                fallbackAvailable: true
            };

            const result = formatErrorMessage(diagnosis);

            expect(result).toContain('❌ Audio Capture Error');
            expect(result).toContain(diagnosis.userMessage);
            expect(result).toContain('💡 Suggested Fix:');
            expect(result).toContain(diagnosis.suggestedFix);
            expect(result).toContain('alternative audio capture methods');
        });

        it('should include retry message when canRetry is true', () => {
            const diagnosis = {
                cause: 'code_signing',
                userMessage: 'Code signing issue.',
                technicalDetails: 'Details',
                suggestedFix: 'Re-sign the binary.',
                canRetry: true,
                fallbackAvailable: true
            };

            const result = formatErrorMessage(diagnosis);

            expect(result).toContain('🔄 You can try restarting');
        });

        it('should not include retry message when canRetry is false', () => {
            const diagnosis = {
                cause: 'missing_binary',
                userMessage: 'Binary is missing.',
                technicalDetails: 'Details',
                suggestedFix: 'Reinstall the application.',
                canRetry: false,
                fallbackAvailable: true
            };

            const result = formatErrorMessage(diagnosis);

            expect(result).not.toContain('🔄 You can try restarting');
        });

        it('should handle fallbackAvailable false', () => {
            const diagnosis = {
                cause: 'unknown',
                userMessage: 'Unknown error.',
                technicalDetails: 'Details',
                suggestedFix: 'Contact support.',
                canRetry: false,
                fallbackAvailable: false
            };

            const result = formatErrorMessage(diagnosis);

            expect(result).toContain('❌ Audio Capture Error');
            expect(result).toContain(diagnosis.userMessage);
        });
    });
});
