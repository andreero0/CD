const { verifySystemAudioDump } = require('./binaryVerification');
const { getSystemArchitecture } = require('./architectureDetection');
const AudioLogger = require('./audioLogger');

/**
 * @typedef {Object} DiagnosticResult
 * @property {'architecture_mismatch'|'code_signing'|'permissions'|'missing_binary'|'unknown'} cause - Root cause of the error
 * @property {string} userMessage - User-friendly error message
 * @property {string} technicalDetails - Technical details for debugging
 * @property {string} suggestedFix - Suggested steps to resolve the issue
 * @property {boolean} canRetry - Whether retrying might help
 * @property {boolean} fallbackAvailable - Whether fallback methods are available
 */

/**
 * Diagnose spawn error -86
 * @param {Error} error - The spawn error
 * @param {string} binaryPath - Path to the binary that failed to spawn
 * @param {Object} options - Optional dependencies for testing
 * @returns {Promise<DiagnosticResult>} Diagnostic result with cause and suggested fix
 */
async function diagnoseSpawnError86(error, binaryPath, options = {}) {
    // Create logger for diagnostics
    const logger = new AudioLogger('[ErrorDiagnostics]');
    
    const diagnosis = {
        cause: 'unknown',
        userMessage: '',
        technicalDetails: '',
        suggestedFix: '',
        canRetry: false,
        fallbackAvailable: true
    };

    // Log start of diagnosis
    logger.info('Starting error diagnosis', {
        errorMessage: error.message,
        errorCode: error.code,
        errorErrno: error.errno,
        binaryPath
    });

    // Check if this is actually error -86
    const isError86 = error.code === 'ENOEXEC' || 
                      error.errno === -86 || 
                      (error.message && error.message.includes('-86'));

    if (!isError86) {
        logger.warn('Error is not error -86', {
            code: error.code,
            errno: error.errno
        });
        
        diagnosis.cause = 'unknown';
        diagnosis.userMessage = 'An unexpected error occurred while starting audio capture.';
        diagnosis.technicalDetails = `Error: ${error.message}\nCode: ${error.code}\nErrno: ${error.errno}`;
        diagnosis.suggestedFix = 'Please try restarting the application. If the problem persists, check the logs for more details.';
        diagnosis.canRetry = true;
        return diagnosis;
    }

    // Get binary verification status
    logger.info('Verifying binary for diagnosis');
    const verification = await verifySystemAudioDump(binaryPath, options);
    const currentArch = getSystemArchitecture();

    // Log verification results
    logger.info('Binary verification completed', {
        exists: verification.exists,
        executable: verification.executable,
        architectures: verification.architectures,
        supportsCurrentArch: verification.supportsCurrentArch,
        signed: verification.signed,
        signatureType: verification.signatureType,
        signatureValid: verification.signatureValid,
        errors: verification.errors,
        warnings: verification.warnings
    });

    // Store technical details
    diagnosis.technicalDetails = [
        `Error: ${error.message}`,
        `Error code: ${error.code}`,
        `Error errno: ${error.errno}`,
        `Binary path: ${binaryPath}`,
        `Current architecture: ${currentArch}`,
        `Binary exists: ${verification.exists}`,
        `Binary executable: ${verification.executable}`,
        `Binary architectures: ${verification.architectures.join(', ')}`,
        `Supports current arch: ${verification.supportsCurrentArch}`,
        `Signed: ${verification.signed}`,
        `Signature type: ${verification.signatureType}`,
        `Signature valid: ${verification.signatureValid}`,
        `Verification errors: ${verification.errors.join('; ')}`,
        `Verification warnings: ${verification.warnings.join('; ')}`
    ].join('\n');

    // Determine root cause
    if (!verification.exists) {
        diagnosis.cause = 'missing_binary';
        diagnosis.userMessage = 'The audio capture component is missing.';
        diagnosis.suggestedFix = 'Please reinstall the application or rebuild the SystemAudioDump binary.';
        diagnosis.canRetry = false;
        
        logger.error('Diagnosis: Missing binary', {
            binaryPath
        });
    } else if (!verification.executable) {
        diagnosis.cause = 'permissions';
        diagnosis.userMessage = 'The audio capture component does not have execute permissions.';
        diagnosis.suggestedFix = `Run: chmod +x "${binaryPath}" to grant execute permissions.`;
        diagnosis.canRetry = true;
        
        logger.error('Diagnosis: Permission issue', {
            binaryPath
        });
    } else if (!verification.supportsCurrentArch) {
        diagnosis.cause = 'architecture_mismatch';
        diagnosis.userMessage = `The audio capture component is not compatible with your system architecture (${currentArch}).`;
        diagnosis.suggestedFix = verification.architectures.length > 0
            ? `The binary supports: ${verification.architectures.join(', ')}. Please rebuild as a universal binary with both x86_64 and arm64 support.`
            : 'Please rebuild the SystemAudioDump binary as a universal binary with both x86_64 and arm64 support.';
        diagnosis.canRetry = false;
        
        logger.error('Diagnosis: Architecture mismatch', {
            currentArch,
            binaryArchitectures: verification.architectures
        });
    } else if (!verification.signed || !verification.signatureValid) {
        diagnosis.cause = 'code_signing';
        diagnosis.userMessage = 'The audio capture component has code signing issues.';
        diagnosis.suggestedFix = verification.signed && !verification.signatureValid
            ? `The binary signature is invalid. Run: codesign --force --deep --sign - "${binaryPath}" to re-sign it.`
            : `The binary is not signed. Run: codesign --force --deep --sign - "${binaryPath}" to apply adhoc signing.`;
        diagnosis.canRetry = true;
        
        logger.error('Diagnosis: Code signing issue', {
            signed: verification.signed,
            signatureValid: verification.signatureValid,
            signatureType: verification.signatureType
        });
    } else {
        // Binary seems fine, but still getting error -86
        diagnosis.cause = 'unknown';
        diagnosis.userMessage = 'Audio capture failed for an unknown reason.';
        diagnosis.suggestedFix = 'The binary appears to be correctly configured. This may be a macOS Gatekeeper issue. Try removing quarantine attributes: xattr -d com.apple.quarantine "' + binaryPath + '"';
        diagnosis.canRetry = true;
        
        logger.warn('Diagnosis: Unknown cause (binary appears valid)', {
            verification
        });
    }

    // Log final diagnosis
    logger.info('Diagnosis complete', {
        cause: diagnosis.cause,
        canRetry: diagnosis.canRetry,
        fallbackAvailable: diagnosis.fallbackAvailable
    });

    return diagnosis;
}

/**
 * Format a user-friendly error message from diagnostic result
 * @param {DiagnosticResult} diagnosis - The diagnostic result
 * @returns {string} Formatted error message
 */
function formatErrorMessage(diagnosis) {
    const lines = [];
    
    // Add user message
    lines.push('❌ Audio Capture Error');
    lines.push('');
    lines.push(diagnosis.userMessage);
    lines.push('');
    
    // Add suggested fix
    lines.push('💡 Suggested Fix:');
    lines.push(diagnosis.suggestedFix);
    lines.push('');
    
    // Add retry/fallback information
    if (diagnosis.fallbackAvailable) {
        lines.push('ℹ️  The application will attempt to use alternative audio capture methods.');
    }
    
    if (diagnosis.canRetry) {
        lines.push('🔄 You can try restarting audio capture after applying the fix.');
    }
    
    return lines.join('\n');
}

module.exports = {
    diagnoseSpawnError86,
    formatErrorMessage
};
