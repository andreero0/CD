const childProcess = require('child_process');

/**
 * Detect system architecture
 * Maps Node.js architecture names to macOS architecture names
 * @returns {'x86_64'|'arm64'} Architecture identifier
 */
function getSystemArchitecture() {
    const nodeArch = process.arch;
    
    // Map Node.js arch names to macOS arch names
    const archMap = {
        'x64': 'x86_64',
        'arm64': 'arm64'
    };
    
    return archMap[nodeArch] || nodeArch;
}

/**
 * Get all architectures in a binary using lipo
 * @param {string} binaryPath - Path to the binary file
 * @param {Function} execSyncFn - Optional execSync function for testing
 * @returns {Promise<string[]>} Array of architectures (e.g., ['x86_64', 'arm64'])
 */
async function getBinaryArchitectures(binaryPath, execSyncFn = null) {
    const execSync = execSyncFn || childProcess.execSync;
    
    try {
        // Execute lipo -info command
        const output = execSync(`lipo -info "${binaryPath}"`, { encoding: 'utf8' });
        
        // Parse output
        // Universal binary: "Architectures in the fat file: /path/to/binary are: x86_64 arm64"
        // Single arch: "Non-fat file: /path/to/binary is architecture: arm64"
        
        if (output.includes('Architectures in the fat file')) {
            // Universal binary - extract architectures after "are:"
            const match = output.match(/are:\s*(.+)$/s);
            if (match) {
                return match[1].trim().split(/\s+/);
            }
        } else if (output.includes('is architecture:')) {
            // Single architecture binary
            const match = output.match(/is architecture:\s*(\S+)/);
            if (match) {
                return [match[1]];
            }
        }
        
        // Fallback: couldn't parse output
        console.warn('Could not parse lipo output:', output);
        return [];
    } catch (error) {
        // lipo command failed (binary doesn't exist, not a Mach-O file, etc.)
        console.error('Error getting binary architectures:', error.message);
        return [];
    }
}

/**
 * Check if binary supports required architecture
 * @param {string} binaryPath - Path to the binary file
 * @param {string} requiredArch - Required architecture (e.g., 'x86_64', 'arm64')
 * @param {Function} execSyncFn - Optional execSync function for testing
 * @returns {Promise<boolean>} True if binary supports the architecture
 */
async function binarySupportsArchitecture(binaryPath, requiredArch, execSyncFn = null) {
    const architectures = await getBinaryArchitectures(binaryPath, execSyncFn);
    return architectures.includes(requiredArch);
}

module.exports = {
    getSystemArchitecture,
    getBinaryArchitectures,
    binarySupportsArchitecture
};
