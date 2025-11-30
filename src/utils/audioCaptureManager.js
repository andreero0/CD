const { spawn } = require('child_process');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const RetryStrategy = require('./retryStrategy');
const { verifySystemAudioDump } = require('./binaryVerification');
const { diagnoseSpawnError86, formatErrorMessage } = require('./errorDiagnostics');
const { tryDesktopCapturer, tryWebAudioCapture } = require('./fallbackAudioCapture');
const { checkAudioPermissions, requestAudioPermissions } = require('./audioPermissions');
const AudioLogger = require('./audioLogger');

/**
 * @typedef {'native_binary'|'web_audio'|'desktop_capturer'|'none'} AudioCaptureMethod
 */

/**
 * @typedef {Object} AudioCaptureStatus
 * @property {boolean} active - Whether audio capture is active
 * @property {AudioCaptureMethod} method - Current capture method
 * @property {number|null} startTime - Timestamp when capture started
 * @property {Error[]} errors - Array of errors encountered
 */

/**
 * Audio Capture Manager
 * Central coordinator for all audio capture operations with automatic method selection,
 * error diagnostics, and fallback mechanisms.
 */
class AudioCaptureManager {
    /**
     * Create a new AudioCaptureManager instance
     * @param {Object} options - Configuration options
     * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
     */
    constructor(options = {}) {
        // Initialize structured logger
        this.logger = new AudioLogger('[AudioCaptureManager]');
        
        // State tracking
        this.currentMethod = 'none';
        this.systemAudioProc = null;
        this.retryCount = 0;
        this.maxRetries = options.maxRetries || 3;
        
        // Retry strategy
        this.retryStrategy = new RetryStrategy({
            maxAttempts: this.maxRetries,
            baseDelay: 1000,
            maxDelay: 10000
        });
        
        // Verification cache
        this.verificationResult = null;
        this.binaryPath = null;
        
        // Permission status cache
        this.permissionStatus = null;
        
        // Audio buffer
        this.audioBuffer = Buffer.alloc(0);
        
        // Event handlers storage for cleanup
        this.eventHandlers = {
            stdout: null,
            stderr: null,
            close: null,
            error: null
        };
        
        // Status
        this.status = {
            active: false,
            method: 'none',
            startTime: null,
            errors: []
        };
        
        // Fallback method array (priority order)
        this.fallbackMethods = [
            {
                name: 'desktop_capturer',
                method: tryDesktopCapturer,
                description: 'Electron desktopCapturer API'
            },
            {
                name: 'web_audio',
                method: tryWebAudioCapture,
                description: 'Web Audio API with getDisplayMedia'
            }
        ];
        
        // Fallback state
        this.fallbackStream = null;
        this.fallbackAudioContext = null;
        this.fallbackProcessor = null;
    }

    /**
     * Get binary path (handle both packaged and development modes)
     * @returns {string} Path to SystemAudioDump binary
     * @private
     */
    _getBinaryPath() {
        if (this.binaryPath) {
            return this.binaryPath;
        }
        
        if (app.isPackaged) {
            this.binaryPath = path.join(process.resourcesPath, 'SystemAudioDump');
        } else {
            this.binaryPath = path.join(__dirname, '../assets', 'SystemAudioDump');
        }
        
        return this.binaryPath;
    }

    /**
     * Verify SystemAudioDump binary is compatible
     * @returns {Promise<Object>} Verification result
     */
    async verifyBinary() {
        const binaryPath = this._getBinaryPath();
        
        // Call verifySystemAudioDump from binaryVerification module
        const result = await verifySystemAudioDump(binaryPath);
        
        // Cache the result
        this.verificationResult = result;
        
        // Log verification results using structured logger
        this.logger.logVerification(result, binaryPath);
        
        return result;
    }

    /**
     * Diagnose error with intelligent diagnostics
     * @param {Error} error - The error to diagnose
     * @returns {Promise<string>} User-friendly error message
     */
    async diagnoseError(error) {
        const binaryPath = this._getBinaryPath();
        
        // Log full error details
        this.logger.error('Diagnosing error', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            stack: error.stack
        });
        
        // Check if this is error -86
        const isError86 = error.code === 'ENOEXEC' || 
                          error.errno === -86 || 
                          (error.message && error.message.includes('-86'));
        
        if (isError86) {
            // Call diagnoseSpawnError86 for error -86
            const diagnosis = await diagnoseSpawnError86(error, binaryPath);
            
            // Log verification results on error
            if (this.verificationResult) {
                this.logger.error('Verification results at time of error', {
                    exists: this.verificationResult.exists,
                    executable: this.verificationResult.executable,
                    architectures: this.verificationResult.architectures,
                    supportsCurrentArch: this.verificationResult.supportsCurrentArch,
                    signed: this.verificationResult.signed,
                    signatureType: this.verificationResult.signatureType
                });
            }
            
            // Log diagnostic results
            this.logger.error('Diagnostic results', {
                cause: diagnosis.cause,
                canRetry: diagnosis.canRetry,
                fallbackAvailable: diagnosis.fallbackAvailable,
                technicalDetails: diagnosis.technicalDetails
            });
            
            // Log suggested fix
            this.logger.info('Suggested fix', {
                fix: diagnosis.suggestedFix
            });
            
            // Format user-friendly message
            const userMessage = formatErrorMessage(diagnosis);
            
            this.logger.info('User-friendly error message generated', {
                messageLength: userMessage.length
            });
            
            return userMessage;
        } else {
            // Other error types - log full details
            this.logger.error('Non-86 error encountered', {
                message: error.message,
                code: error.code,
                errno: error.errno,
                stack: error.stack,
                type: error.constructor.name
            });
            
            return `Audio capture failed: ${error.message}`;
        }
    }

    /**
     * Initialize audio capture with automatic method selection
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        // Log initialization with system info
        this.logger.logInitialization({
            maxRetries: this.maxRetries
        });
        
        // Check audio permissions (only on macOS)
        if (process.platform === 'darwin') {
            const permissionStatus = await checkAudioPermissions();
            this.permissionStatus = permissionStatus;
            
            // Log permission check
            this.logger.logPermissionCheck(permissionStatus);
            
            // If permissions are not determined, request them
            if (permissionStatus.state === 'not-determined') {
                const requestResult = await requestAudioPermissions();
                this.permissionStatus = requestResult;
                
                // Log permission request result
                this.logger.logPermissionRequest(requestResult);
                
                if (requestResult.state !== 'granted') {
                    this.logger.error('Permissions not granted - user must grant manually');
                    return false;
                }
            }
            
            // If permissions are denied, show instructions
            if (permissionStatus.state === 'denied') {
                this.logger.error('Permissions denied - user must grant in System Settings', {
                    message: permissionStatus.message
                });
                return false;
            }
            
            // If permissions are restricted, cannot proceed
            if (permissionStatus.state === 'restricted') {
                this.logger.error('Permissions restricted by system policy', {
                    message: permissionStatus.message
                });
                return false;
            }
            
            this.logger.info('Audio permissions are granted');
        }
        
        // Verify binary compatibility
        const verification = await this.verifyBinary();
        
        if (!verification.exists) {
            this.logger.error('Binary does not exist - preparing fallback methods');
            return false;
        }
        
        if (!verification.executable) {
            this.logger.error('Binary is not executable - preparing fallback methods');
            return false;
        }
        
        if (!verification.supportsCurrentArch) {
            this.logger.error('Binary does not support current architecture - preparing fallback methods');
            return false;
        }
        
        if (verification.errors.length > 0) {
            this.logger.error('Binary verification failed with errors - preparing fallback methods');
            return false;
        }
        
        this.logger.info('Initialization successful - binary is ready');
        return true;
    }

    /**
     * Start audio capture using best available method
     * @param {Object} geminiSessionRef - Reference to Gemini session
     * @param {Function} onAudioData - Callback for audio data
     * @returns {Promise<void>}
     */
    async start(geminiSessionRef, onAudioData) {
        // Check if already running
        if (this.systemAudioProc && this.systemAudioProc.pid) {
            this.logger.warn('Audio capture already running');
            return;
        }
        
        this.logger.info('Starting audio capture...');
        
        // Verify binary if not already verified
        if (!this.verificationResult) {
            await this.verifyBinary();
        }
        
        // Attempt to spawn SystemAudioDump process
        const binaryPath = this._getBinaryPath();
        
        try {
            // Log spawn attempt
            this.logger.logSpawnAttempt(binaryPath, this.retryStrategy.getAttemptCount() + 1, this.maxRetries);
            
            await this._spawnSystemAudioDump(binaryPath, geminiSessionRef, onAudioData);
            
            // Success - reset retry strategy
            this.retryStrategy.reset();
            this.status.active = true;
            this.status.method = 'native_binary';
            this.status.startTime = Date.now();
            
            this.logger.info('Audio capture started successfully', {
                method: 'native_binary'
            });
        } catch (error) {
            // Log spawn failure
            this.logger.logSpawnFailure(error, binaryPath, this.retryStrategy.getAttemptCount() + 1);
            
            // Check if this is error -86
            const isError86 = error.code === 'ENOEXEC' || 
                              error.errno === -86 || 
                              (error.message && error.message.includes('-86'));
            
            if (isError86) {
                // Diagnose error
                const userMessage = await this.diagnoseError(error);
                this.status.errors.push(error);
                
                // Check if should retry
                if (this.retryStrategy.shouldRetry()) {
                    const delay = this.retryStrategy.getNextDelay();
                    
                    // Log retry
                    this.logger.logRetry(this.retryStrategy.getAttemptCount(), this.maxRetries, delay);
                    
                    // Wait for exponential backoff delay
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    // Retry
                    return this.start(geminiSessionRef, onAudioData);
                } else {
                    this.logger.error('Max retries exceeded - attempting fallback methods');
                    
                    // Try fallback methods
                    const fallbackSuccess = await this._tryFallbackMethods(geminiSessionRef, onAudioData);
                    
                    if (!fallbackSuccess) {
                        throw new Error(userMessage);
                    }
                }
            } else {
                // Other error - rethrow
                this.status.errors.push(error);
                throw error;
            }
        }
    }

    /**
     * Spawn SystemAudioDump process
     * @param {string} binaryPath - Path to binary
     * @param {Object} geminiSessionRef - Reference to Gemini session
     * @param {Function} onAudioData - Callback for audio data
     * @returns {Promise<void>}
     * @private
     */
    async _spawnSystemAudioDump(binaryPath, geminiSessionRef, onAudioData) {
        return new Promise((resolve, reject) => {
            const spawnOptions = {
                stdio: ['ignore', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    PROCESS_NAME: 'AudioService',
                    APP_NAME: 'System Audio Service',
                },
            };
            
            if (process.platform === 'darwin') {
                spawnOptions.detached = false;
                spawnOptions.windowsHide = false;
            }
            
            // Spawn the process
            this.systemAudioProc = spawn(binaryPath, [], spawnOptions);
            
            if (!this.systemAudioProc.pid) {
                reject(new Error('Failed to spawn SystemAudioDump process'));
                return;
            }
            
            // Log spawn success
            this.logger.logSpawnSuccess(this.systemAudioProc.pid, binaryPath);
            
            let hasReceivedAudio = false;
            let stderrBuffer = '';
            let startupTimeout = null;
            
            // Set up stdout handler
            this.eventHandlers.stdout = (data) => {
                if (!hasReceivedAudio) {
                    hasReceivedAudio = true;
                    if (startupTimeout) {
                        clearTimeout(startupTimeout);
                        startupTimeout = null;
                    }
                    this.logger.info('Receiving audio data successfully');
                    resolve();
                }
                
                // Log audio data received (debug level)
                this.logger.logAudioDataReceived(data.length);
                
                // Append to audio buffer
                this.audioBuffer = Buffer.concat([this.audioBuffer, data]);
                
                // Call audio data callback
                if (onAudioData) {
                    onAudioData(data);
                }
            };
            
            // Set up stderr handler
            this.eventHandlers.stderr = (data) => {
                const errorText = data.toString();
                stderrBuffer += errorText;
                this.logger.error('SystemAudioDump stderr output', {
                    stderr: errorText
                });
            };
            
            // Set up close handler
            this.eventHandlers.close = (code, signal) => {
                // Log process close
                this.logger.logProcessClose(code, signal);
                
                this.systemAudioProc = null;
                
                if (!hasReceivedAudio) {
                    let errorMessage = 'SystemAudioDump closed unexpectedly';
                    if (stderrBuffer) {
                        errorMessage += ': ' + stderrBuffer.trim();
                    }
                    if (code !== 0) {
                        errorMessage += ' (exit code: ' + code + ')';
                    }
                    reject(new Error(errorMessage));
                }
            };
            
            // Set up error handler
            this.eventHandlers.error = (err) => {
                this.logger.error('SystemAudioDump process error', {
                    error: err.message,
                    code: err.code,
                    errno: err.errno
                });
                this.systemAudioProc = null;
                reject(err);
            };
            
            // Attach event handlers
            this.systemAudioProc.stdout.on('data', this.eventHandlers.stdout);
            this.systemAudioProc.stderr.on('data', this.eventHandlers.stderr);
            this.systemAudioProc.on('close', this.eventHandlers.close);
            this.systemAudioProc.on('error', this.eventHandlers.error);
            
            // Set startup timeout
            startupTimeout = setTimeout(() => {
                if (!hasReceivedAudio) {
                    this.logger.error('Timeout: No audio data received after 5 seconds', {
                        stderr: stderrBuffer || 'No error details available'
                    });
                    
                    let errorMessage = 'SystemAudioDump failed to capture audio. ';
                    if (stderrBuffer) {
                        errorMessage += 'Error: ' + stderrBuffer.trim();
                    } else {
                        errorMessage += 'No error details available.';
                    }
                    
                    if (this.systemAudioProc) {
                        this.systemAudioProc.kill('SIGTERM');
                    }
                    
                    reject(new Error(errorMessage));
                }
            }, 5000);
        });
    }

    /**
     * Try fallback audio capture methods
     * @param {Object} geminiSessionRef - Reference to Gemini session
     * @param {Function} onAudioData - Callback for audio data
     * @returns {Promise<boolean>} Success status
     * @private
     */
    async _tryFallbackMethods(geminiSessionRef, onAudioData) {
        this.logger.info('Attempting fallback methods...');
        
        for (const fallback of this.fallbackMethods) {
            // Log fallback attempt
            this.logger.logFallbackAttempt(fallback.name, fallback.description);
            
            try {
                let result;
                
                // Call the appropriate fallback method
                if (fallback.name === 'desktop_capturer') {
                    result = await fallback.method(onAudioData);
                } else if (fallback.name === 'web_audio') {
                    result = await fallback.method(geminiSessionRef, onAudioData);
                }
                
                if (result && result.success) {
                    // Log fallback success
                    this.logger.logFallbackSuccess(fallback.name);
                    
                    // Store fallback resources for cleanup
                    this.fallbackStream = result.stream;
                    this.fallbackAudioContext = result.audioContext;
                    this.fallbackProcessor = result.processor;
                    
                    // Update status
                    this.status.active = true;
                    this.status.method = fallback.name;
                    this.status.startTime = Date.now();
                    this.currentMethod = fallback.name;
                    
                    return true;
                }
                
                // Log fallback failure
                this.logger.logFallbackFailure(fallback.name, result?.error || 'Unknown error');
                
            } catch (error) {
                // Log fallback failure with exception
                this.logger.logFallbackFailure(fallback.name, error);
            }
        }
        
        this.logger.error('All fallback methods failed');
        return false;
    }

    /**
     * Stop audio capture and cleanup
     */
    stop() {
        // Log cleanup operation
        this.logger.logCleanup({
            method: this.currentMethod,
            hadProcess: !!(this.systemAudioProc && this.systemAudioProc.pid),
            hadFallbackResources: !!(this.fallbackStream || this.fallbackAudioContext || this.fallbackProcessor)
        });
        
        // Kill SystemAudioDump process if running
        if (this.systemAudioProc && this.systemAudioProc.pid) {
            this.logger.info('Killing SystemAudioDump process', {
                pid: this.systemAudioProc.pid
            });
            this.systemAudioProc.kill('SIGTERM');
            this.systemAudioProc = null;
        }
        
        // Remove all event listeners
        if (this.systemAudioProc) {
            if (this.eventHandlers.stdout) {
                this.systemAudioProc.stdout.removeListener('data', this.eventHandlers.stdout);
            }
            if (this.eventHandlers.stderr) {
                this.systemAudioProc.stderr.removeListener('data', this.eventHandlers.stderr);
            }
            if (this.eventHandlers.close) {
                this.systemAudioProc.removeListener('close', this.eventHandlers.close);
            }
            if (this.eventHandlers.error) {
                this.systemAudioProc.removeListener('error', this.eventHandlers.error);
            }
        }
        
        // Clear event handlers
        this.eventHandlers = {
            stdout: null,
            stderr: null,
            close: null,
            error: null
        };
        
        // Cleanup fallback resources
        if (this.fallbackProcessor) {
            this.logger.debug('Disconnecting fallback audio processor');
            this.fallbackProcessor.disconnect();
            this.fallbackProcessor = null;
        }
        
        if (this.fallbackAudioContext) {
            this.logger.debug('Closing fallback audio context');
            this.fallbackAudioContext.close().catch(err => {
                this.logger.error('Error closing audio context', {
                    error: err.message
                });
            });
            this.fallbackAudioContext = null;
        }
        
        if (this.fallbackStream) {
            this.logger.debug('Stopping fallback media stream');
            this.fallbackStream.getTracks().forEach(track => track.stop());
            this.fallbackStream = null;
        }
        
        // Clear audio buffer
        this.audioBuffer = Buffer.alloc(0);
        
        // Reset state variables
        this.status.active = false;
        this.status.method = 'none';
        this.status.startTime = null;
        this.currentMethod = 'none';
        
        this.logger.info('Audio capture stopped and cleaned up successfully');
    }

    /**
     * Get current status
     * @returns {AudioCaptureStatus} Current status
     */
    getStatus() {
        return { ...this.status };
    }

    /**
     * Get current permission status
     * @returns {Object|null} Current permission status or null if not checked
     */
    getPermissionStatus() {
        return this.permissionStatus ? { ...this.permissionStatus } : null;
    }

    /**
     * Check and update permission status
     * @returns {Promise<Object>} Current permission status
     */
    async checkPermissions() {
        if (process.platform !== 'darwin') {
            return {
                state: 'granted',
                canRequest: false,
                message: 'Audio permissions are not required on this platform'
            };
        }
        
        const status = await checkAudioPermissions();
        this.permissionStatus = status;
        return status;
    }
}

module.exports = AudioCaptureManager;
