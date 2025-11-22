/**
 * Audio Device Detection Utility
 * Detects BlackHole and other virtual audio devices for system audio capture
 * Browser-compatible module - uses only Web APIs
 */

/**
 * Enumerate and identify available audio input devices
 * Separates microphone from system audio (BlackHole) devices
 * @returns {Promise<{microphone: object|null, systemAudio: object|null, allDevices: Array}>}
 */
window.getAudioDevices = async function getAudioDevices() {
    try {
        // Request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                // Stop the temporary stream immediately
                stream.getTracks().forEach(track => track.stop());
            });

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');

        console.log('[Audio Setup] Available audio inputs:', audioInputs.map(d =>
            `${d.label} (${d.deviceId.substring(0, 8)}...)`
        ));

        // Find microphone (usually contains "MacBook", "Built-in", or "Microphone")
        const microphone = audioInputs.find(d =>
            d.label.toLowerCase().includes('macbook') ||
            d.label.toLowerCase().includes('built-in') ||
            d.label.toLowerCase().includes('microphone') ||
            d.label.toLowerCase().includes('internal')
        );

        // Find BlackHole (system audio capture)
        const systemAudio = audioInputs.find(d =>
            d.label.toLowerCase().includes('blackhole')
        );

        if (!microphone || !systemAudio) {
            console.warn('[Audio Setup] Missing required devices', {
                hasMicrophone: !!microphone,
                hasSystemAudio: !!systemAudio
            });
            console.log('[Audio Setup] Available devices:', audioInputs.map(d => d.label));
        }

        // Debug output if enabled
        if (process.env.DEBUG_DEVICE_SELECTION || localStorage.getItem('debugDeviceSelection') === 'true') {
            console.log('[Debug] Available audio devices:');
            audioInputs.forEach((device, index) => {
                console.log(`  ${index + 1}. ${device.label} (${device.deviceId})`);
            });
            console.log(`[Debug] Selected microphone: ${microphone?.label || 'NONE'}`);
            console.log(`[Debug] Selected system audio: ${systemAudio?.label || 'NONE'}`);
        }

        return {
            microphone: microphone || audioInputs[0] || null, // Fallback to first device
            systemAudio: systemAudio || null,
            allDevices: audioInputs
        };
    } catch (error) {
        console.error('[Audio Setup] Device enumeration failed:', error);

        // Return minimal fallback
        return {
            microphone: null,
            systemAudio: null,
            allDevices: [],
            error: error.message
        };
    }
};

/**
 * Detect if BlackHole virtual audio device is installed
 * @returns {Promise<{installed: boolean, deviceId: string|null, deviceLabel: string|null}>}
 */
window.detectBlackHole = async function detectBlackHole() {
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
window.getAllAudioInputDevices = async function getAllAudioInputDevices() {
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
window.isDeviceAvailable = async function isDeviceAvailable(deviceId) {
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
window.testAudioCapture = async function testAudioCapture(deviceId) {
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
};

/**
 * Setup separate audio streams for microphone and system audio (BlackHole)
 * Creates two independent getUserMedia() calls with appropriate constraints
 * @returns {Promise<{micStream: MediaStream|null, systemStream: MediaStream|null}>}
 */
window.setupAudioStreams = async function setupAudioStreams() {
    const devices = await window.getAudioDevices();

    let micStreamRef = null;
    let systemStreamRef = null;

    // Capture microphone stream
    if (devices.microphone) {
        try {
            micStreamRef = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: { exact: devices.microphone.deviceId },
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: true,    // Enable for user mic
                    noiseSuppression: true,    // Enable for user mic
                    autoGainControl: true      // Enable for user mic
                }
            });
            console.log(`[Audio Setup] Microphone stream: ${devices.microphone.label}`);
        } catch (error) {
            console.error('[Audio Setup] Failed to capture microphone:', error);
            micStreamRef = null;
        }
    } else {
        console.warn('[Audio Setup] No microphone device found');
    }

    // Capture system audio stream (BlackHole)
    if (devices.systemAudio) {
        try {
            systemStreamRef = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: { exact: devices.systemAudio.deviceId },
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: false,   // Disable for interviewer audio
                    noiseSuppression: false,   // Disable for interviewer audio
                    autoGainControl: false     // Disable for interviewer audio
                }
            });
            console.log(`[Audio Setup] System audio stream: ${devices.systemAudio.label}`);
        } catch (error) {
            console.error('[Audio Setup] Failed to capture system audio:', error);
            systemStreamRef = null;
        }
    } else {
        console.warn('[Audio Setup] No BlackHole device found - system audio capture unavailable');
    }

    return {
        micStream: micStreamRef,
        systemStream: systemStreamRef,
        devices: devices
    };
};

/**
 * Stop audio streams gracefully
 * @param {MediaStream|null} micStream - Microphone stream to stop
 * @param {MediaStream|null} systemStream - System audio stream to stop
 */
window.stopAudioStreams = function stopAudioStreams(micStream, systemStream) {
    if (micStream) {
        micStream.getTracks().forEach(track => {
            track.stop();
            console.log('[Audio Cleanup] Stopped microphone track');
        });
    }

    if (systemStream) {
        systemStream.getTracks().forEach(track => {
            track.stop();
            console.log('[Audio Cleanup] Stopped system audio track');
        });
    }
};

// Expose functions globally for browser context
console.log('Audio device detector loaded - functions available on window object');
