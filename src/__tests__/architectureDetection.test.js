/**
 * Property-Based Tests for Architecture Detection Module
 * Feature: macos-audio-capture-fix
 */

const fc = require('fast-check');

describe('Architecture Detection Module', () => {
    let childProcess;
    let architectureDetection;
    let execSyncSpy;

    beforeEach(() => {
        // Clear module cache to ensure fresh imports
        vi.resetModules();
        
        // Import child_process and set up spy
        childProcess = require('child_process');
        execSyncSpy = vi.spyOn(childProcess, 'execSync');
        
        // Now import the module under test
        architectureDetection = require('../utils/architectureDetection');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getSystemArchitecture', () => {
        it('should map x64 to x86_64', () => {
            const originalArch = process.arch;
            Object.defineProperty(process, 'arch', {
                value: 'x64',
                writable: true,
                configurable: true
            });
            
            const result = architectureDetection.getSystemArchitecture();
            expect(result).toBe('x86_64');
            
            // Restore original
            Object.defineProperty(process, 'arch', {
                value: originalArch,
                writable: true,
                configurable: true
            });
        });

        it('should map arm64 to arm64', () => {
            const originalArch = process.arch;
            Object.defineProperty(process, 'arch', {
                value: 'arm64',
                writable: true,
                configurable: true
            });
            
            const result = architectureDetection.getSystemArchitecture();
            expect(result).toBe('arm64');
            
            // Restore original
            Object.defineProperty(process, 'arch', {
                value: originalArch,
                writable: true,
                configurable: true
            });
        });

        /**
         * **Feature: macos-audio-capture-fix, Property 7: Architecture Detection Consistency**
         * **Validates: Requirements 2.5**
         * 
         * Property: For any system, the detected architecture from process.arch should 
         * consistently map to the correct macOS architecture name.
         */
        it('Property 7: Architecture Detection Consistency', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('x64', 'arm64'),
                    (nodeArch) => {
                        const originalArch = process.arch;
                        
                        // Mock process.arch
                        Object.defineProperty(process, 'arch', {
                            value: nodeArch,
                            writable: true,
                            configurable: true
                        });
                        
                        const result = architectureDetection.getSystemArchitecture();
                        
                        // Verify mapping is consistent
                        if (nodeArch === 'x64') {
                            expect(result).toBe('x86_64');
                        } else if (nodeArch === 'arm64') {
                            expect(result).toBe('arm64');
                        }
                        
                        // Verify idempotence - calling multiple times returns same result
                        const result2 = architectureDetection.getSystemArchitecture();
                        expect(result).toBe(result2);
                        
                        // Restore original
                        Object.defineProperty(process, 'arch', {
                            value: originalArch,
                            writable: true,
                            configurable: true
                        });
                        
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('getBinaryArchitectures', () => {
        it('should parse universal binary output', async () => {
            const mockExecSync = vi.fn().mockReturnValue(
                'Architectures in the fat file: /path/to/binary are: x86_64 arm64'
            );
            
            const result = await architectureDetection.getBinaryArchitectures('/path/to/binary', mockExecSync);
            expect(result).toEqual(['x86_64', 'arm64']);
        });

        it('should parse single architecture output', async () => {
            const mockExecSync = vi.fn().mockReturnValue(
                'Non-fat file: /path/to/binary is architecture: arm64'
            );
            
            const result = await architectureDetection.getBinaryArchitectures('/path/to/binary', mockExecSync);
            expect(result).toEqual(['arm64']);
        });

        it('should handle lipo command failure', async () => {
            const mockExecSync = vi.fn().mockImplementation(() => {
                throw new Error('lipo: can\'t open file');
            });
            
            const result = await architectureDetection.getBinaryArchitectures('/nonexistent/binary', mockExecSync);
            expect(result).toEqual([]);
        });

        it('should handle unparseable output', async () => {
            const mockExecSync = vi.fn().mockReturnValue(
                'Some unexpected output format'
            );
            
            const result = await architectureDetection.getBinaryArchitectures('/path/to/binary', mockExecSync);
            expect(result).toEqual([]);
        });
    });

    describe('binarySupportsArchitecture', () => {
        it('should return true when architecture is supported', async () => {
            const mockExecSync = vi.fn().mockReturnValue(
                'Architectures in the fat file: /path/to/binary are: x86_64 arm64'
            );
            
            const result = await architectureDetection.binarySupportsArchitecture('/path/to/binary', 'x86_64', mockExecSync);
            expect(result).toBe(true);
        });

        it('should return false when architecture is not supported', async () => {
            const mockExecSync = vi.fn().mockReturnValue(
                'Non-fat file: /path/to/binary is architecture: arm64'
            );
            
            const result = await architectureDetection.binarySupportsArchitecture('/path/to/binary', 'x86_64', mockExecSync);
            expect(result).toBe(false);
        });

        it('should return false when binary does not exist', async () => {
            const mockExecSync = vi.fn().mockImplementation(() => {
                throw new Error('lipo: can\'t open file');
            });
            
            const result = await architectureDetection.binarySupportsArchitecture('/nonexistent/binary', 'x86_64', mockExecSync);
            expect(result).toBe(false);
        });
    });
});
