const childProcess = require('child_process');
const fs = require('fs');
const { getBinaryArchitectures, getSystemArchitecture } = require('./architectureDetection');
const AudioLogger = require('./audioLogger');

/**
 * @typedef {Object} SignatureInfo
 * @property {boolean} signed - Whether the binary is signed
 * @property {'adhoc'|'developer'|'none'} signatureType - Type of signature
 * @property {string} identifier - Code signing identifier
 * @property {string|null} teamId - Developer team ID (null for adhoc)
 * @property {boolean} valid - Whether the signature is valid
 * @property {string[]} entitlements - List of entitlements
 */

/**
 * Check code signature status of a binary
 * @param {string} binaryPath - Path to the binary file
 * @param {Function} execSyncFn - Optional execSync function for testing
 * @returns {Promise<SignatureInfo>} Signature information
 */
async function checkCodeSignature(binaryPath, execSyncFn = null) {
    const execSync = execSyncFn || childProcess.execSync;
    
    const result = {
        signed: false,
        signatureType: 'none',
        identifier: '',
        teamId: null,
        valid: false,
        entitlements: []
    };
    
    try {
        // Execute codesign -dv command
        // Note: codesign outputs to stderr, not stdout
        const output = execSync(`codesign -dv "${binaryPath}" 2>&1`, { encoding: 'utf8' });
        
        // Parse the output
        result.signed = true;
        
        // Extract identifier
        const identifierMatch = output.match(/Identifier=([^\n]+)/);
        if (identifierMatch) {
            result.identifier = identifierMatch[1].trim();
        }
        
        // Extract team identifier (only present for developer signatures)
        const teamIdMatch = output.match(/TeamIdentifier=([^\n]+)/);
        if (teamIdMatch) {
            result.teamId = teamIdMatch[1].trim();
            result.signatureType = 'developer';
        } else {
            // No team ID means adhoc signature
            result.signatureType = 'adhoc';
        }
        
        // Check if signature is valid
        result.valid = !output.includes('invalid') && !output.includes('not signed');
        
        // Try to extract entitlements (may not always be present)
        try {
            const entitlementsOutput = execSync(`codesign -d --entitlements - "${binaryPath}" 2>&1`, { encoding: 'utf8' });
            
            // Parse entitlements from XML-like output
            const entitlementMatches = entitlementsOutput.matchAll(/<key>([^<]+)<\/key>/g);
            for (const match of entitlementMatches) {
                result.entitlements.push(match[1]);
            }
        } catch (entError) {
            // Entitlements extraction failed, but that's okay
            console.debug('Could not extract entitlements:', entError.message);
        }
        
    } catch (error) {
        // codesign command failed - binary is not signed or doesn't exist
        if (error.message.includes('not signed')) {
            result.signed = false;
            result.signatureType = 'none';
        } else {
            // Other error (file doesn't exist, not a valid binary, etc.)
            console.error('Error checking code signature:', error.message);
        }
    }
    
    return result;
}

/**
 * @typedef {Object} VerificationResult
 * @property {boolean} exists - Whether the binary file exists
 * @property {boolean} executable - Whether the binary has execute permissions
 * @property {string[]} architectures - List of architectures in the binary
 * @property {boolean} supportsCurrentArch - Whether current architecture is supported
 * @property {boolean} signed - Whether the binary is signed
 * @property {boolean} signatureValid - Whether the signature is valid
 * @property {'adhoc'|'developer'|'none'} signatureType - Type of signature
 * @property {string[]} errors - List of error messages
 * @property {string[]} warnings - List of warning messages
 */

/**
 * Comprehensive verification of SystemAudioDump binary
 * @param {string} binaryPath - Path to the binary file
 * @param {Object} options - Optional dependencies for testing
 * @param {Function} options.execSyncFn - Optional execSync function
 * @param {Function} options.existsSyncFn - Optional fs.existsSync function
 * @param {Function} options.accessSyncFn - Optional fs.accessSync function
 * @returns {Promise<VerificationResult>} Comprehensive verification result
 */
async function verifySystemAudioDump(binaryPath, options = {}) {
    // Create logger for verification
    const logger = new AudioLogger('[BinaryVerification]');
    
    const { execSyncFn, existsSyncFn, accessSyncFn } = options;
    const existsSync = existsSyncFn || fs.existsSync;
    const accessSync = accessSyncFn || fs.accessSync;
    
    logger.info('Starting binary verification', {
        binaryPath
    });
    
    const result = {
        exists: false,
        executable: false,
        architectures: [],
        supportsCurrentArch: false,
        signed: false,
        signatureValid: false,
        signatureType: 'none',
        errors: [],
        warnings: []
    };
    
    // Check if binary file exists
    try {
        result.exists = existsSync(binaryPath);
        if (!result.exists) {
            const errorMsg = `Binary file does not exist at path: ${binaryPath}`;
            result.errors.push(errorMsg);
            logger.error('Binary file does not exist', { binaryPath });
            return result;
        }
        logger.debug('Binary file exists');
    } catch (error) {
        const errorMsg = `Error checking file existence: ${error.message}`;
        result.errors.push(errorMsg);
        logger.error('Error checking file existence', {
            error: error.message,
            stack: error.stack
        });
        return result;
    }
    
    // Check if binary has execute permissions
    try {
        accessSync(binaryPath, fs.constants.X_OK);
        result.executable = true;
        logger.debug('Binary has execute permissions');
    } catch (error) {
        result.executable = false;
        result.errors.push('Binary does not have execute permissions');
        logger.error('Binary does not have execute permissions', {
            error: error.message
        });
    }
    
    // Get supported architectures
    try {
        result.architectures = await getBinaryArchitectures(binaryPath, execSyncFn);
        if (result.architectures.length === 0) {
            result.warnings.push('Could not determine binary architectures');
            logger.warn('Could not determine binary architectures');
        } else {
            logger.info('Binary architectures detected', {
                architectures: result.architectures
            });
        }
    } catch (error) {
        const errorMsg = `Error getting binary architectures: ${error.message}`;
        result.errors.push(errorMsg);
        logger.error('Error getting binary architectures', {
            error: error.message,
            stack: error.stack
        });
    }
    
    // Check if current architecture is supported
    try {
        const currentArch = getSystemArchitecture();
        result.supportsCurrentArch = result.architectures.includes(currentArch);
        
        if (!result.supportsCurrentArch && result.architectures.length > 0) {
            const errorMsg = `Binary does not support current architecture (${currentArch}). ` +
                `Available: ${result.architectures.join(', ')}`;
            result.errors.push(errorMsg);
            logger.error('Architecture mismatch', {
                currentArch,
                binaryArchitectures: result.architectures
            });
        } else if (result.supportsCurrentArch) {
            logger.info('Binary supports current architecture', {
                currentArch
            });
        }
    } catch (error) {
        const errorMsg = `Error checking architecture compatibility: ${error.message}`;
        result.errors.push(errorMsg);
        logger.error('Error checking architecture compatibility', {
            error: error.message,
            stack: error.stack
        });
    }
    
    // Check code signature
    try {
        const signatureInfo = await checkCodeSignature(binaryPath, execSyncFn);
        result.signed = signatureInfo.signed;
        result.signatureValid = signatureInfo.valid;
        result.signatureType = signatureInfo.signatureType;
        
        logger.info('Code signature check completed', {
            signed: result.signed,
            signatureType: result.signatureType,
            signatureValid: result.signatureValid
        });
        
        if (!result.signed) {
            result.warnings.push('Binary is not code-signed');
            logger.warn('Binary is not code-signed');
        } else if (!result.signatureValid) {
            result.errors.push('Binary has an invalid code signature');
            logger.error('Binary has an invalid code signature');
        } else if (result.signatureType === 'adhoc') {
            result.warnings.push('Binary uses adhoc signing (development only)');
            logger.warn('Binary uses adhoc signing (development only)');
        }
    } catch (error) {
        const errorMsg = `Error checking code signature: ${error.message}`;
        result.errors.push(errorMsg);
        logger.error('Error checking code signature', {
            error: error.message,
            stack: error.stack
        });
    }
    
    // Log final verification result
    if (result.errors.length > 0) {
        logger.error('Binary verification failed', {
            errorCount: result.errors.length,
            warningCount: result.warnings.length,
            errors: result.errors,
            warnings: result.warnings
        });
    } else if (result.warnings.length > 0) {
        logger.warn('Binary verification completed with warnings', {
            warningCount: result.warnings.length,
            warnings: result.warnings
        });
    } else {
        logger.info('Binary verification passed successfully');
    }
    
    return result;
}

module.exports = {
    checkCodeSignature,
    verifySystemAudioDump
};
