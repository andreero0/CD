const AudioLogger = require('../utils/audioLogger');

describe('AudioLogger', () => {
    let logger;
    let consoleLogSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        logger = new AudioLogger('[Test]');
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('Basic Logging', () => {
        it('should log info messages', () => {
            logger.info('Test message');
            expect(consoleLogSpy).toHaveBeenCalled();
            const logCall = consoleLogSpy.mock.calls[0][0];
            expect(logCall).toContain('[Test]');
            expect(logCall).toContain('[INFO]');
            expect(logCall).toContain('Test message');
        });

        it('should log warning messages', () => {
            logger.warn('Warning message');
            expect(consoleWarnSpy).toHaveBeenCalled();
            const logCall = consoleWarnSpy.mock.calls[0][0];
            expect(logCall).toContain('[Test]');
            expect(logCall).toContain('[WARN]');
            expect(logCall).toContain('Warning message');
        });

        it('should log error messages', () => {
            logger.error('Error message');
            expect(consoleErrorSpy).toHaveBeenCalled();
            const logCall = consoleErrorSpy.mock.calls[0][0];
            expect(logCall).toContain('[Test]');
            expect(logCall).toContain('[ERROR]');
            expect(logCall).toContain('Error message');
        });

        it('should include metadata in logs', () => {
            logger.info('Test with metadata', { key: 'value', number: 42 });
            expect(consoleLogSpy).toHaveBeenCalled();
            const logCall = consoleLogSpy.mock.calls[0][0];
            expect(logCall).toContain('Test with metadata');
            expect(logCall).toContain('"key": "value"');
            expect(logCall).toContain('"number": 42');
        });
    });

    describe('Lifecycle Logging', () => {
        it('should log initialization with system info', () => {
            logger.logInitialization({ maxRetries: 3 });
            expect(consoleLogSpy).toHaveBeenCalled();
            const logCall = consoleLogSpy.mock.calls[0][0];
            expect(logCall).toContain('Initializing audio capture');
            expect(logCall).toContain('platform');
            expect(logCall).toContain('arch');
            expect(logCall).toContain('maxRetries');
        });

        it('should log verification results', () => {
            const verification = {
                exists: true,
                executable: true,
                architectures: ['x86_64', 'arm64'],
                supportsCurrentArch: true,
                signed: true,
                signatureType: 'adhoc',
                signatureValid: true,
                errors: [],
                warnings: []
            };
            logger.logVerification(verification, '/path/to/binary');
            expect(consoleLogSpy).toHaveBeenCalled();
            const logCall = consoleLogSpy.mock.calls[0][0];
            expect(logCall).toContain('Binary verification passed');
        });

        it('should log verification failures', () => {
            const verification = {
                exists: false,
                executable: false,
                architectures: [],
                supportsCurrentArch: false,
                signed: false,
                signatureType: 'none',
                signatureValid: false,
                errors: ['Binary does not exist'],
                warnings: []
            };
            logger.logVerification(verification, '/path/to/binary');
            expect(consoleErrorSpy).toHaveBeenCalled();
            const logCall = consoleErrorSpy.mock.calls[0][0];
            expect(logCall).toContain('Binary verification failed');
        });

        it('should log spawn attempts', () => {
            logger.logSpawnAttempt('/path/to/binary', 1, 3);
            expect(consoleLogSpy).toHaveBeenCalled();
            const logCall = consoleLogSpy.mock.calls[0][0];
            expect(logCall).toContain('Attempting to spawn SystemAudioDump');
            expect(logCall).toContain('"attempt": 1');
            expect(logCall).toContain('"maxAttempts": 3');
        });

        it('should log spawn success', () => {
            logger.logSpawnSuccess(12345, '/path/to/binary');
            expect(consoleLogSpy).toHaveBeenCalled();
            const logCall = consoleLogSpy.mock.calls[0][0];
            expect(logCall).toContain('SystemAudioDump spawned successfully');
            expect(logCall).toContain('"pid": 12345');
        });

        it('should log spawn failure', () => {
            const error = new Error('Spawn failed');
            error.code = 'ENOEXEC';
            error.errno = -86;
            logger.logSpawnFailure(error, '/path/to/binary', 1);
            expect(consoleErrorSpy).toHaveBeenCalled();
            const logCall = consoleErrorSpy.mock.calls[0][0];
            expect(logCall).toContain('SystemAudioDump spawn failed');
            expect(logCall).toContain('"errorCode": "ENOEXEC"');
        });

        it('should log fallback attempts', () => {
            logger.logFallbackAttempt('desktop_capturer', 'Electron desktopCapturer API');
            expect(consoleLogSpy).toHaveBeenCalled();
            const logCall = consoleLogSpy.mock.calls[0][0];
            expect(logCall).toContain('Attempting fallback audio capture method');
            expect(logCall).toContain('desktop_capturer');
        });

        it('should log cleanup operations', () => {
            logger.logCleanup({ method: 'native_binary', hadProcess: true });
            expect(consoleLogSpy).toHaveBeenCalled();
            const logCall = consoleLogSpy.mock.calls[0][0];
            expect(logCall).toContain('Cleaning up audio capture resources');
            expect(logCall).toContain('"method": "native_binary"');
        });
    });

    describe('Session Management', () => {
        it('should generate unique session IDs', () => {
            const logger1 = new AudioLogger('[Test1]');
            const logger2 = new AudioLogger('[Test2]');
            expect(logger1.sessionId).not.toBe(logger2.sessionId);
        });

        it('should provide session summary', () => {
            const summary = logger.getSessionSummary();
            expect(summary).toHaveProperty('sessionId');
            expect(summary).toHaveProperty('startTime');
            expect(summary).toHaveProperty('duration');
            expect(summary).toHaveProperty('timestamp');
            expect(summary.sessionId).toBe(logger.sessionId);
        });
    });

    describe('Permission Logging', () => {
        it('should log permission checks', () => {
            const permissionStatus = {
                state: 'granted',
                canRequest: false,
                message: 'Permissions granted'
            };
            logger.logPermissionCheck(permissionStatus);
            expect(consoleLogSpy).toHaveBeenCalled();
            const logCall = consoleLogSpy.mock.calls[0][0];
            expect(logCall).toContain('Audio permission check');
            expect(logCall).toContain('"state": "granted"');
        });

        it('should log permission requests', () => {
            const result = {
                state: 'granted',
                message: 'User granted permissions'
            };
            logger.logPermissionRequest(result);
            expect(consoleLogSpy).toHaveBeenCalled();
            const logCall = consoleLogSpy.mock.calls[0][0];
            expect(logCall).toContain('Audio permissions granted');
        });

        it('should warn when permissions not granted', () => {
            const result = {
                state: 'denied',
                message: 'User denied permissions'
            };
            logger.logPermissionRequest(result);
            expect(consoleWarnSpy).toHaveBeenCalled();
            const logCall = consoleWarnSpy.mock.calls[0][0];
            expect(logCall).toContain('Audio permissions not granted');
        });
    });

    describe('Retry Logging', () => {
        it('should log retry attempts', () => {
            logger.logRetry(2, 3, 2000);
            expect(consoleLogSpy).toHaveBeenCalled();
            const logCall = consoleLogSpy.mock.calls[0][0];
            expect(logCall).toContain('Retrying audio capture');
            expect(logCall).toContain('"attempt": 2');
            expect(logCall).toContain('"maxAttempts": 3');
            expect(logCall).toContain('"delayMs": 2000');
        });
    });

    describe('Process Logging', () => {
        it('should log process close with zero exit code', () => {
            logger.logProcessClose(0, null);
            expect(consoleLogSpy).toHaveBeenCalled();
            const logCall = consoleLogSpy.mock.calls[0][0];
            expect(logCall).toContain('SystemAudioDump process closed normally');
        });

        it('should warn on non-zero exit code', () => {
            logger.logProcessClose(1, 'SIGTERM');
            expect(consoleWarnSpy).toHaveBeenCalled();
            const logCall = consoleWarnSpy.mock.calls[0][0];
            expect(logCall).toContain('SystemAudioDump process closed with non-zero exit code');
            expect(logCall).toContain('"exitCode": 1');
        });
    });
});
