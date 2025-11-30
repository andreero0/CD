const os = require('os');

/**
 * Audio Capture Logger
 * Provides structured logging for audio capture lifecycle and diagnostics
 */
class AudioLogger {
    constructor(prefix = '[AudioCapture]') {
        this.prefix = prefix;
        this.sessionId = this._generateSessionId();
        this.startTime = Date.now();
    }

    /**
     * Generate a unique session ID
     * @returns {string} Session ID
     * @private
     */
    _generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Format timestamp
     * @returns {string} Formatted timestamp
     * @private
     */
    _timestamp() {
        return new Date().toISOString();
    }

    /**
     * Format log message with metadata
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} metadata - Additional metadata
     * @returns {string} Formatted log message
     * @private
     */
    _format(level, message, metadata = {}) {
        const parts = [
            this._timestamp(),
            this.prefix,
            `[${level.toUpperCase()}]`,
            message
        ];

        if (Object.keys(metadata).length > 0) {
            parts.push(JSON.stringify(metadata, null, 2));
        }

        return parts.join(' ');
    }

    /**
     * Log info message
     * @param {string} message - Log message
     * @param {Object} metadata - Additional metadata
     */
    info(message, metadata = {}) {
        console.log(this._format('info', message, metadata));
    }

    /**
     * Log warning message
     * @param {string} message - Log message
     * @param {Object} metadata - Additional metadata
     */
    warn(message, metadata = {}) {
        console.warn(this._format('warn', message, metadata));
    }

    /**
     * Log error message
     * @param {string} message - Log message
     * @param {Object} metadata - Additional metadata
     */
    error(message, metadata = {}) {
        console.error(this._format('error', message, metadata));
    }

    /**
     * Log debug message
     * @param {string} message - Log message
     * @param {Object} metadata - Additional metadata
     */
    debug(message, metadata = {}) {
        if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
            console.log(this._format('debug', message, metadata));
        }
    }

    /**
     * Log initialization with system info
     * @param {Object} options - Initialization options
     */
    logInitialization(options = {}) {
        const systemInfo = {
            sessionId: this.sessionId,
            platform: process.platform,
            arch: process.arch,
            osVersion: os.release(),
            osType: os.type(),
            nodeVersion: process.version,
            electronVersion: process.versions.electron || 'N/A',
            timestamp: this._timestamp(),
            ...options
        };

        this.info('Initializing audio capture', systemInfo);
    }

    /**
     * Log binary verification results
     * @param {Object} verification - Verification result
     * @param {string} binaryPath - Path to binary
     */
    logVerification(verification, binaryPath) {
        const metadata = {
            sessionId: this.sessionId,
            binaryPath,
            exists: verification.exists,
            executable: verification.executable,
            architectures: verification.architectures,
            supportsCurrentArch: verification.supportsCurrentArch,
            signed: verification.signed,
            signatureType: verification.signatureType,
            signatureValid: verification.signatureValid,
            errors: verification.errors,
            warnings: verification.warnings
        };

        if (verification.errors.length > 0) {
            this.error('Binary verification failed', metadata);
        } else if (verification.warnings.length > 0) {
            this.warn('Binary verification completed with warnings', metadata);
        } else {
            this.info('Binary verification passed', metadata);
        }
    }

    /**
     * Log spawn attempt
     * @param {string} binaryPath - Path to binary
     * @param {number} attempt - Attempt number
     * @param {number} maxAttempts - Maximum attempts
     */
    logSpawnAttempt(binaryPath, attempt, maxAttempts) {
        this.info('Attempting to spawn SystemAudioDump', {
            sessionId: this.sessionId,
            binaryPath,
            attempt,
            maxAttempts,
            timestamp: this._timestamp()
        });
    }

    /**
     * Log spawn success
     * @param {number} pid - Process ID
     * @param {string} binaryPath - Path to binary
     */
    logSpawnSuccess(pid, binaryPath) {
        this.info('SystemAudioDump spawned successfully', {
            sessionId: this.sessionId,
            pid,
            binaryPath,
            timestamp: this._timestamp()
        });
    }

    /**
     * Log spawn failure
     * @param {Error} error - Spawn error
     * @param {string} binaryPath - Path to binary
     * @param {number} attempt - Attempt number
     */
    logSpawnFailure(error, binaryPath, attempt) {
        this.error('SystemAudioDump spawn failed', {
            sessionId: this.sessionId,
            binaryPath,
            attempt,
            errorCode: error.code,
            errorErrno: error.errno,
            errorMessage: error.message,
            errorStack: error.stack,
            timestamp: this._timestamp()
        });
    }

    /**
     * Log fallback method attempt
     * @param {string} methodName - Name of fallback method
     * @param {string} description - Description of method
     */
    logFallbackAttempt(methodName, description) {
        this.info('Attempting fallback audio capture method', {
            sessionId: this.sessionId,
            method: methodName,
            description,
            timestamp: this._timestamp()
        });
    }

    /**
     * Log fallback method success
     * @param {string} methodName - Name of fallback method
     */
    logFallbackSuccess(methodName) {
        this.info('Fallback audio capture method succeeded', {
            sessionId: this.sessionId,
            method: methodName,
            timestamp: this._timestamp()
        });
    }

    /**
     * Log fallback method failure
     * @param {string} methodName - Name of fallback method
     * @param {Error|string} error - Error or error message
     */
    logFallbackFailure(methodName, error) {
        this.warn('Fallback audio capture method failed', {
            sessionId: this.sessionId,
            method: methodName,
            error: error instanceof Error ? error.message : error,
            timestamp: this._timestamp()
        });
    }

    /**
     * Log cleanup operation
     * @param {Object} details - Cleanup details
     */
    logCleanup(details = {}) {
        this.info('Cleaning up audio capture resources', {
            sessionId: this.sessionId,
            ...details,
            timestamp: this._timestamp()
        });
    }

    /**
     * Log audio data received
     * @param {number} bytes - Number of bytes received
     */
    logAudioDataReceived(bytes) {
        this.debug('Audio data received', {
            sessionId: this.sessionId,
            bytes,
            timestamp: this._timestamp()
        });
    }

    /**
     * Log process close
     * @param {number} code - Exit code
     * @param {string} signal - Signal that caused close
     */
    logProcessClose(code, signal) {
        const metadata = {
            sessionId: this.sessionId,
            exitCode: code,
            signal,
            timestamp: this._timestamp()
        };

        if (code === 0) {
            this.info('SystemAudioDump process closed normally', metadata);
        } else {
            this.warn('SystemAudioDump process closed with non-zero exit code', metadata);
        }
    }

    /**
     * Log retry attempt
     * @param {number} attempt - Current attempt number
     * @param {number} maxAttempts - Maximum attempts
     * @param {number} delay - Delay before retry (ms)
     */
    logRetry(attempt, maxAttempts, delay) {
        this.info('Retrying audio capture', {
            sessionId: this.sessionId,
            attempt,
            maxAttempts,
            delayMs: delay,
            timestamp: this._timestamp()
        });
    }

    /**
     * Log permission check
     * @param {Object} permissionStatus - Permission status
     */
    logPermissionCheck(permissionStatus) {
        this.info('Audio permission check', {
            sessionId: this.sessionId,
            state: permissionStatus.state,
            canRequest: permissionStatus.canRequest,
            message: permissionStatus.message,
            timestamp: this._timestamp()
        });
    }

    /**
     * Log permission request
     * @param {Object} result - Permission request result
     */
    logPermissionRequest(result) {
        const metadata = {
            sessionId: this.sessionId,
            state: result.state,
            message: result.message,
            timestamp: this._timestamp()
        };

        if (result.state === 'granted') {
            this.info('Audio permissions granted', metadata);
        } else {
            this.warn('Audio permissions not granted', metadata);
        }
    }

    /**
     * Get session summary
     * @returns {Object} Session summary
     */
    getSessionSummary() {
        return {
            sessionId: this.sessionId,
            startTime: this.startTime,
            duration: Date.now() - this.startTime,
            timestamp: this._timestamp()
        };
    }
}

module.exports = AudioLogger;
