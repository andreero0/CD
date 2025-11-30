/**
 * Property-Based Tests for Binary Verification Module
 * Feature: macos-audio-capture-fix
 */

const fc = require('fast-check');
const fs = require('fs');

describe('Binary Verification Module', () => {
    let binaryVerification;
    let childProcess;

    beforeEach(() => {
        // Clear module cache to ensure fresh imports
        vi.resetModules();
        
        // Import modules
        childProcess = require('child_process');
        binaryVerification = require('../utils/binaryVerification');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('checkCodeSignature', () => {
        it('should detect unsigned binary', async () => {
            const mockExecSync = vi.fn().mockImplementation(() => {
                const error = new Error('code object is not signed at all');
                error.message = 'code object is not signed at all';
                throw error;
            });

            const result = await binaryVerification.checkCodeSignature('/path/to/binary', mockExecSync);
            
            expect(result.signed).toBe(false);
            expect(result.signatureType).toBe('none');
            expect(result.valid).toBe(false);
        });

        it('should detect adhoc signature', async () => {
            const mockExecSync = vi.fn().mockReturnValue(
                'Executable=/path/to/binary\n' +
                'Identifier=com.example.binary\n' +
                'Format=Mach-O thin (arm64)\n' +
                'CodeDirectory v=20500 size=1234 flags=0x20002(adhoc) hashes=10+0 location=embedded\n' +
                'Signature=adhoc\n'
            );

            const result = await binaryVerification.checkCodeSignature('/path/to/binary', mockExecSync);
            
            expect(result.signed).toBe(true);
            expect(result.signatureType).toBe('adhoc');
            expect(result.identifier).toBe('com.example.binary');
            expect(result.teamId).toBeNull();
            expect(result.valid).toBe(true);
        });

        it('should detect developer signature', async () => {
            const mockExecSync = vi.fn().mockReturnValue(
                'Executable=/path/to/binary\n' +
                'Identifier=com.example.binary\n' +
                'Format=Mach-O thin (arm64)\n' +
                'CodeDirectory v=20500 size=1234 flags=0x0 hashes=10+0 location=embedded\n' +
                'TeamIdentifier=ABC123XYZ\n' +
                'Signature size=4321\n'
            );

            const result = await binaryVerification.checkCodeSignature('/path/to/binary', mockExecSync);
            
            expect(result.signed).toBe(true);
            expect(result.signatureType).toBe('developer');
            expect(result.identifier).toBe('com.example.binary');
            expect(result.teamId).toBe('ABC123XYZ');
            expect(result.valid).toBe(true);
        });

        it('should detect invalid signature', async () => {
            const mockExecSync = vi.fn().mockReturnValue(
                'Executable=/path/to/binary\n' +
                'Identifier=com.example.binary\n' +
                'Format=Mach-O thin (arm64)\n' +
                'CodeDirectory v=20500 size=1234 flags=0x0 hashes=10+0 location=embedded\n' +
                'Signature=invalid\n'
            );

            const result = await binaryVerification.checkCodeSignature('/path/to/binary', mockExecSync);
            
            expect(result.signed).toBe(true);
            expect(result.valid).toBe(false);
        });
    });

    describe('verifySystemAudioDump', () => {
        it('should detect missing binary', async () => {
            const mockExistsSync = vi.fn().mockReturnValue(false);
            
            const result = await binaryVerification.verifySystemAudioDump('/nonexistent/binary', {
                existsSyncFn: mockExistsSync
            });
            
            expect(result.exists).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('does not exist');
        });

        it('should detect non-executable binary', async () => {
            const mockExistsSync = vi.fn().mockReturnValue(true);
            const mockAccessSync = vi.fn().mockImplementation(() => {
                throw new Error('Permission denied');
            });
            const mockExecSync = vi.fn().mockReturnValue(
                'Architectures in the fat file: /path/to/binary are: x86_64 arm64'
            );
            
            const result = await binaryVerification.verifySystemAudioDump('/path/to/binary', {
                existsSyncFn: mockExistsSync,
                accessSyncFn: mockAccessSync,
                execSyncFn: mockExecSync
            });
            
            expect(result.exists).toBe(true);
            expect(result.executable).toBe(false);
            expect(result.errors).toContain('Binary does not have execute permissions');
        });

        it('should detect architecture mismatch', async () => {
            const mockExistsSync = vi.fn().mockReturnValue(true);
            const mockAccessSync = vi.fn(); // No error = executable
            const mockExecSync = vi.fn()
                .mockReturnValueOnce('Non-fat file: /path/to/binary is architecture: arm64') // getBinaryArchitectures
                .mockReturnValueOnce('Identifier=com.example.binary\nSignature=adhoc\n'); // checkCodeSignature
            
            // Mock process.arch to be x64 (which maps to x86_64)
            const originalArch = process.arch;
            Object.defineProperty(process, 'arch', {
                value: 'x64',
                writable: true,
                configurable: true
            });
            
            const result = await binaryVerification.verifySystemAudioDump('/path/to/binary', {
                existsSyncFn: mockExistsSync,
                accessSyncFn: mockAccessSync,
                execSyncFn: mockExecSync
            });
            
            expect(result.exists).toBe(true);
            expect(result.executable).toBe(true);
            expect(result.architectures).toEqual(['arm64']);
            expect(result.supportsCurrentArch).toBe(false);
            expect(result.errors.some(e => e.includes('does not support current architecture'))).toBe(true);
            
            // Restore
            Object.defineProperty(process, 'arch', {
                value: originalArch,
                writable: true,
                configurable: true
            });
        });

        it('should verify valid universal binary', async () => {
            const mockExistsSync = vi.fn().mockReturnValue(true);
            const mockAccessSync = vi.fn(); // No error = executable
            const mockExecSync = vi.fn()
                .mockReturnValueOnce('Architectures in the fat file: /path/to/binary are: x86_64 arm64') // getBinaryArchitectures
                .mockReturnValueOnce('Identifier=com.example.binary\nTeamIdentifier=ABC123\n'); // checkCodeSignature
            
            const result = await binaryVerification.verifySystemAudioDump('/path/to/binary', {
                existsSyncFn: mockExistsSync,
                accessSyncFn: mockAccessSync,
                execSyncFn: mockExecSync
            });
            
            expect(result.exists).toBe(true);
            expect(result.executable).toBe(true);
            expect(result.architectures).toEqual(['x86_64', 'arm64']);
            expect(result.supportsCurrentArch).toBe(true);
            expect(result.signed).toBe(true);
            expect(result.signatureType).toBe('developer');
            expect(result.errors.length).toBe(0);
        });

        /**
         * **Feature: macos-audio-capture-fix, Property 2: Binary Verification Idempotence**
         * **Validates: Requirements 5.1**
         * 
         * Property: For any binary path, calling verifySystemAudioDump multiple times 
         * should return the same result (assuming the binary hasn't changed).
         */
        it('Property 2: Binary Verification Idempotence', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        exists: fc.boolean(),
                        executable: fc.boolean(),
                        architectures: fc.constantFrom(
                            ['x86_64'],
                            ['arm64'],
                            ['x86_64', 'arm64'],
                            []
                        ),
                        signed: fc.boolean(),
                        signatureType: fc.constantFrom('adhoc', 'developer', 'none'),
                        teamId: fc.option(fc.string(), { nil: null })
                    }),
                    async (binaryState) => {
                        // Create mock functions that return consistent results
                        const mockExistsSync = vi.fn().mockReturnValue(binaryState.exists);
                        
                        const mockAccessSync = vi.fn().mockImplementation(() => {
                            if (!binaryState.executable) {
                                throw new Error('Permission denied');
                            }
                        });
                        
                        const mockExecSync = vi.fn().mockImplementation((cmd) => {
                            if (cmd.includes('lipo -info')) {
                                // Return architecture info
                                if (binaryState.architectures.length === 0) {
                                    throw new Error('Not a valid binary');
                                } else if (binaryState.architectures.length === 1) {
                                    return `Non-fat file: /path/to/binary is architecture: ${binaryState.architectures[0]}`;
                                } else {
                                    return `Architectures in the fat file: /path/to/binary are: ${binaryState.architectures.join(' ')}`;
                                }
                            } else if (cmd.includes('codesign')) {
                                // Return signature info
                                if (!binaryState.signed) {
                                    throw new Error('code object is not signed at all');
                                }
                                let output = 'Identifier=com.example.binary\n';
                                if (binaryState.signatureType === 'developer' && binaryState.teamId) {
                                    output += `TeamIdentifier=${binaryState.teamId}\n`;
                                }
                                return output;
                            }
                            return '';
                        });
                        
                        const options = {
                            existsSyncFn: mockExistsSync,
                            accessSyncFn: mockAccessSync,
                            execSyncFn: mockExecSync
                        };
                        
                        // Call verification multiple times
                        const result1 = await binaryVerification.verifySystemAudioDump('/path/to/binary', options);
                        const result2 = await binaryVerification.verifySystemAudioDump('/path/to/binary', options);
                        const result3 = await binaryVerification.verifySystemAudioDump('/path/to/binary', options);
                        
                        // Verify all results are identical
                        expect(result1.exists).toBe(result2.exists);
                        expect(result2.exists).toBe(result3.exists);
                        
                        expect(result1.executable).toBe(result2.executable);
                        expect(result2.executable).toBe(result3.executable);
                        
                        expect(result1.architectures).toEqual(result2.architectures);
                        expect(result2.architectures).toEqual(result3.architectures);
                        
                        expect(result1.supportsCurrentArch).toBe(result2.supportsCurrentArch);
                        expect(result2.supportsCurrentArch).toBe(result3.supportsCurrentArch);
                        
                        expect(result1.signed).toBe(result2.signed);
                        expect(result2.signed).toBe(result3.signed);
                        
                        expect(result1.signatureValid).toBe(result2.signatureValid);
                        expect(result2.signatureValid).toBe(result3.signatureValid);
                        
                        expect(result1.signatureType).toBe(result2.signatureType);
                        expect(result2.signatureType).toBe(result3.signatureType);
                        
                        expect(result1.errors).toEqual(result2.errors);
                        expect(result2.errors).toEqual(result3.errors);
                        
                        expect(result1.warnings).toEqual(result2.warnings);
                        expect(result2.warnings).toEqual(result3.warnings);
                        
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
