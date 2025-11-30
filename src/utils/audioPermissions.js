const { systemPreferences } = require('electron');
const { execSync } = require('child_process');

/**
 * @typedef {'granted'|'denied'|'restricted'|'not-determined'} PermissionState
 */

/**
 * @typedef {Object} PermissionStatus
 * @property {PermissionState} state - Current permission state
 * @property {boolean} canRequest - Whether permission can be requested
 * @property {string} message - Human-readable status message
 */

/**
 * Audio Permissions Module
 * Handles checking and requesting macOS audio capture permissions
 */

/**
 * Check macOS audio capture permissions status
 * @returns {Promise<PermissionStatus>} Current permission status
 */
async function checkAudioPermissions() {
    console.log('[AudioPermissions] Checking audio capture permissions...');
    
    // Only applicable on macOS
    if (process.platform !== 'darwin') {
        console.log('[AudioPermissions] Not on macOS, permissions not applicable');
        return {
            state: 'granted',
            canRequest: false,
            message: 'Audio permissions are not required on this platform'
        };
    }
    
    try {
        // Check microphone permission status using Electron's systemPreferences
        // This checks the "Microphone" permission which is required for audio capture
        const micStatus = systemPreferences.getMediaAccessStatus('microphone');
        
        console.log('[AudioPermissions] Microphone permission status:', micStatus);
        
        // Map Electron's status to our PermissionState
        let state;
        let canRequest = false;
        let message = '';
        
        switch (micStatus) {
            case 'granted':
                state = 'granted';
                canRequest = false;
                message = 'Audio capture permissions are granted';
                break;
                
            case 'denied':
                state = 'denied';
                canRequest = false;
                message = 'Audio capture permissions have been denied. Please grant access in System Settings > Privacy & Security > Microphone';
                break;
                
            case 'restricted':
                state = 'restricted';
                canRequest = false;
                message = 'Audio capture permissions are restricted by system policy';
                break;
                
            case 'not-determined':
            default:
                state = 'not-determined';
                canRequest = true;
                message = 'Audio capture permissions have not been requested yet';
                break;
        }
        
        console.log('[AudioPermissions] Permission state:', state);
        console.log('[AudioPermissions] Can request:', canRequest);
        
        return {
            state,
            canRequest,
            message
        };
        
    } catch (error) {
        console.error('[AudioPermissions] Error checking permissions:', error);
        
        // If we can't check permissions, assume they need to be requested
        return {
            state: 'not-determined',
            canRequest: true,
            message: 'Unable to determine permission status: ' + error.message
        };
    }
}

/**
 * Request audio capture permissions from the user
 * Prompts the user to grant microphone access which is required for audio capture
 * @returns {Promise<PermissionStatus>} Updated permission status after request
 */
async function requestAudioPermissions() {
    console.log('[AudioPermissions] Requesting audio capture permissions...');
    
    // Only applicable on macOS
    if (process.platform !== 'darwin') {
        console.log('[AudioPermissions] Not on macOS, permissions not applicable');
        return {
            state: 'granted',
            canRequest: false,
            message: 'Audio permissions are not required on this platform'
        };
    }
    
    try {
        // First check current status
        const currentStatus = await checkAudioPermissions();
        
        // If already granted, no need to request
        if (currentStatus.state === 'granted') {
            console.log('[AudioPermissions] Permissions already granted');
            return currentStatus;
        }
        
        // If denied or restricted, cannot request again programmatically
        if (currentStatus.state === 'denied' || currentStatus.state === 'restricted') {
            console.log('[AudioPermissions] Permissions cannot be requested (state:', currentStatus.state + ')');
            return currentStatus;
        }
        
        // Request microphone access
        // This will trigger the system permission dialog
        console.log('[AudioPermissions] Triggering system permission dialog...');
        
        const granted = await systemPreferences.askForMediaAccess('microphone');
        
        console.log('[AudioPermissions] Permission request result:', granted ? 'granted' : 'denied');
        
        // Return updated status
        if (granted) {
            return {
                state: 'granted',
                canRequest: false,
                message: 'Audio capture permissions have been granted'
            };
        } else {
            return {
                state: 'denied',
                canRequest: false,
                message: 'Audio capture permissions were denied. Please grant access in System Settings > Privacy & Security > Microphone'
            };
        }
        
    } catch (error) {
        console.error('[AudioPermissions] Error requesting permissions:', error);
        
        // Check status again to get current state
        const status = await checkAudioPermissions();
        
        return {
            ...status,
            message: 'Error requesting permissions: ' + error.message
        };
    }
}

module.exports = {
    checkAudioPermissions,
    requestAudioPermissions
};
