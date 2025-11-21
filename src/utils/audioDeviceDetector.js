/**
 * Audio Device Detection Utility
 * Detects BlackHole and other virtual audio devices for system audio capture
 */

/**
 * Detect if BlackHole virtual audio device is installed
 * @returns {Promise<{installed: boolean, deviceId: string|null, deviceLabel: string|null}>}
 */
async function detectBlackHole() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();

        // Look for BlackHole in audio input devices
        const blackHoleDevice = devices.find(device =>
            device.kind === 'audioinput' &&
            (device.label.includes('BlackHole') ||
             device.label.includes('blackhole'))
        );

        if (blackHoleDevice) {
            console.log('BlackHole detected:', blackHoleDevice.label, 'ID:', blackHoleDevice.deviceId);
            return {
                installed: true,
                deviceId: blackHoleDevice.deviceId,
                deviceLabel: blackHoleDevice.label
            };
        }

        console.log('BlackHole not detected in available audio devices');
        return {
            installed: false,
            deviceId: null,
            deviceLabel: null
        };
    } catch (error) {
        console.error('Error detecting audio devices:', error);
        return {
            installed: false,
            deviceId: null,
            deviceLabel: null
        };
    }
}

/**
 * Get all available audio input devices
 * @returns {Promise<Array<{deviceId: string, label: string, kind: string}>>}
 */
async function getAllAudioInputDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices
            .filter(device => device.kind === 'audioinput')
            .map(device => ({
                deviceId: device.deviceId,
                label: device.label || 'Unnamed Device',
                kind: device.kind
            }));
    } catch (error) {
        console.error('Error enumerating audio devices:', error);
        return [];
    }
}

/**
 * Check if a specific device ID is still available
 * @param {string} deviceId - The device ID to check
 * @returns {Promise<boolean>}
 */
async function isDeviceAvailable(deviceId) {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(device => device.deviceId === deviceId);
    } catch (error) {
        console.error('Error checking device availability:', error);
        return false;
    }
}

/**
 * Test if audio capture works from a specific device
 * @param {string} deviceId - The device ID to test
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
async function testAudioCapture(deviceId) {
    let stream = null;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: { exact: deviceId },
                sampleRate: 24000,
                channelCount: 1,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            }
        });

        // Check if we're actually receiving audio data
        const audioContext = new AudioContext({ sampleRate: 24000 });
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);

        // Wait 500ms and check for non-zero audio data
        await new Promise(resolve => setTimeout(resolve, 500));

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(dataArray);

        // Check if we have any non-zero values (indicates audio flow)
        const hasAudio = dataArray.some(value => value !== 128); // 128 is silence in Uint8

        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();

        return {
            success: true,
            hasAudio: hasAudio,
            error: null
        };
    } catch (error) {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        return {
            success: false,
            hasAudio: false,
            error: error.message
        };
    }
}

module.exports = {
    detectBlackHole,
    getAllAudioInputDevices,
    isDeviceAvailable,
    testAudioCapture
};
