// renderer.js
// SECURITY FIX: Use the exposed electron API from preload script instead of require
const ipcRenderer = window.electron;

// Initialize random display name for UI components
window.randomDisplayName = null;

// Request random display name from main process
ipcRenderer
    .invoke('get-random-display-name')
    .then(name => {
        window.randomDisplayName = name;
        console.log('Set random display name:', name);
    })
    .catch(err => {
        console.warn('Could not get random display name:', err);
        window.randomDisplayName = 'System Monitor';
    });

let mediaStream = null;
let screenshotInterval = null;
let audioContext = null;
let audioProcessor = null;
let micAudioProcessor = null;
// Removed unused global audioBuffer - each audio processor uses its own local buffer
const SAMPLE_RATE = 24000;
const AUDIO_CHUNK_DURATION = 0.1; // seconds
const BUFFER_SIZE = 4096; // Increased buffer size for smoother audio
const MAX_AUDIO_BUFFER_SIZE = 100; // Maximum buffer size to prevent memory leaks (10 seconds of audio)

let hiddenVideo = null;
let offscreenCanvas = null;
let offscreenContext = null;
let currentImageQuality = 'medium'; // Store current image quality for manual screenshots
let isCapturingScreenshot = false; // Prevent race conditions in screenshot capture
let connectionStatus = 'disconnected'; // Track connection status for UI

// SECURITY FIX: Use platform from exposed API
const isLinux = window.electron.platform === 'linux';
const isMacOS = window.electron.platform === 'darwin';

// Screenshot timing tracker for status bar
window.screenshotTracker = {
    lastScreenshotTime: 0,
    intervalSeconds: 5,
    isManualMode: false,
};

// Token tracking system for rate limiting
window.tokenTracker = {
    tokens: [], // Array of {timestamp, count, type} objects
    audioStartTime: null,

    // Add tokens to the tracker
    addTokens(count, type = 'image') {
        const now = Date.now();
        this.tokens.push({
            timestamp: now,
            count: count,
            type: type,
        });

        // Clean old tokens (older than 1 minute)
        this.cleanOldTokens();
    },

    // Calculate image tokens based on Gemini 2.0 rules
    calculateImageTokens(width, height) {
        // Images ≤384px in both dimensions = 258 tokens
        if (width <= 384 && height <= 384) {
            return 258;
        }

        // Larger images are tiled into 768x768 chunks, each = 258 tokens
        const tilesX = Math.ceil(width / 768);
        const tilesY = Math.ceil(height / 768);
        const totalTiles = tilesX * tilesY;

        return totalTiles * 258;
    },

    // Track audio tokens continuously
    trackAudioTokens() {
        if (!this.audioStartTime) {
            this.audioStartTime = Date.now();
            return;
        }

        const now = Date.now();
        const elapsedSeconds = (now - this.audioStartTime) / 1000;

        // Audio = 32 tokens per second
        const audioTokens = Math.floor(elapsedSeconds * 32);

        if (audioTokens > 0) {
            this.addTokens(audioTokens, 'audio');
            this.audioStartTime = now;
        }
    },

    // Clean tokens older than 1 minute
    cleanOldTokens() {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        this.tokens = this.tokens.filter(token => token.timestamp > oneMinuteAgo);
    },

    // Get total tokens in the last minute
    getTokensInLastMinute() {
        this.cleanOldTokens();
        return this.tokens.reduce((total, token) => total + token.count, 0);
    },

    // Check if we should throttle based on settings
    shouldThrottle() {
        // Get rate limiting settings from localStorage
        const throttleEnabled = localStorage.getItem('throttleTokens') === 'true';
        if (!throttleEnabled) {
            return false;
        }

        const maxTokensPerMin = parseInt(localStorage.getItem('maxTokensPerMin') || '1000000', 10);
        const throttleAtPercent = parseInt(localStorage.getItem('throttleAtPercent') || '75', 10);

        const currentTokens = this.getTokensInLastMinute();
        const throttleThreshold = Math.floor((maxTokensPerMin * throttleAtPercent) / 100);
        const usagePercent = Math.round((currentTokens / maxTokensPerMin) * 100);

        console.log(`Token check: ${currentTokens}/${maxTokensPerMin} (throttle at ${throttleThreshold})`);

        // Send visual warning to UI when approaching or at limit
        if (currentTokens >= throttleThreshold) {
            ipcRenderer.send('rate-limit-warning', {
                current: currentTokens,
                max: maxTokensPerMin,
                percent: usagePercent,
                message: `Approaching rate limit (${usagePercent}%) - slowing down screenshots`,
            });

            // Adaptive quality: reduce screenshot quality when throttling
            if (usagePercent >= 90) {
                currentImageQuality = 'low';
                console.log('ADAPTIVE QUALITY: Reducing to LOW quality due to high token usage');
            } else if (usagePercent >= 80) {
                currentImageQuality = 'medium';
                console.log('ADAPTIVE QUALITY: Reducing to MEDIUM quality due to token usage');
            }
        }

        return currentTokens >= throttleThreshold;
    },

    // Reset the tracker
    reset() {
        this.tokens = [];
        this.audioStartTime = null;
    },
};

// Track audio tokens every few seconds
setInterval(() => {
    window.tokenTracker.trackAudioTokens();
}, 2000);

function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Improved scaling to prevent clipping
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function initializeGemini(profile = 'interview', language = 'en-US') {
    const apiKey = localStorage.getItem('apiKey')?.trim();
    if (apiKey) {
        const success = await ipcRenderer.invoke('initialize-gemini', apiKey, localStorage.getItem('customPrompt') || '', profile, language);
        if (success) {
            cheddar.setStatus('Live');
        } else {
            cheddar.setStatus('error');
        }
    }
}

// Listen for status updates
ipcRenderer.on('update-status', (status) => {
    console.log('Status update:', status);
    cheddar.setStatus(status);

    // Update connection status for UI
    if (status === 'Live' || status === 'listening') {
        connectionStatus = 'connected';
    } else if (status === 'error' || status === 'disconnected') {
        connectionStatus = 'disconnected';
    } else if (status === 'connecting') {
        connectionStatus = 'connecting';
    }

    // Broadcast connection status change
    window.dispatchEvent(new CustomEvent('connection-status-changed', {
        detail: { status: connectionStatus }
    }));
});

// Listen for responses - REMOVED: This is handled in CheatingDaddyApp.js to avoid duplicates
// ipcRenderer.on('update-response', (event, response) => {
//     console.log('Gemini response:', response);
//     cheddar.e().setResponse(response);
//     // You can add UI elements to display the response if needed
// });

async function startCapture(screenshotIntervalSeconds = 5, imageQuality = 'medium', existingScreenStream = null, existingMicStream = null) {
    // Store the image quality for manual screenshots
    currentImageQuality = imageQuality;

    // Reset token tracker when starting new capture session
    window.tokenTracker.reset();
    console.log('Token tracker reset for new capture session');

    const audioMode = localStorage.getItem('audioMode') || 'speaker_only';

    try {
        if (isMacOS) {
            // On macOS, use SystemAudioDump for audio and getDisplayMedia for screen
            console.log('Starting macOS capture with SystemAudioDump...');

            // Start macOS audio capture
            const audioResult = await ipcRenderer.invoke('start-macos-audio');
            if (!audioResult.success) {
                throw new Error('Failed to start macOS audio capture: ' + audioResult.error);
            }

            // Use existing screen stream from wizard, or request new one
            if (existingScreenStream) {
                mediaStream = existingScreenStream;
                console.log('Using pre-approved screen stream from wizard');
            } else {
                // Get screen capture for screenshots
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: false, // Don't use browser audio on macOS
                });
            }

            console.log('macOS screen capture started - audio handled by SystemAudioDump');

            if (audioMode === 'mic_only' || audioMode === 'both') {
                // Use existing microphone stream from wizard, or request new one
                if (existingMicStream) {
                    console.log('Using pre-approved microphone stream from wizard');
                    setupLinuxMicProcessing(existingMicStream);
                } else {
                    let micStream = null;
                    try {
                        micStream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                                sampleRate: SAMPLE_RATE,
                                channelCount: 1,
                                echoCancellation: true,
                                noiseSuppression: true,
                                autoGainControl: true,
                            },
                            video: false,
                        });
                        console.log('macOS microphone capture started');
                        setupLinuxMicProcessing(micStream);
                    } catch (micError) {
                        console.warn('Failed to get microphone access on macOS:', micError);
                    }
                }
            }
        } else if (isLinux) {
            // Linux - use display media for screen capture and try to get system audio
            try {
                // First try to get system audio via getDisplayMedia (works on newer browsers)
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: false, // Don't cancel system audio
                        noiseSuppression: false,
                        autoGainControl: false,
                    },
                });

                console.log('Linux system audio capture via getDisplayMedia succeeded');

                // Setup audio processing for Linux system audio
                setupLinuxSystemAudioProcessing();
            } catch (systemAudioError) {
                console.warn('System audio via getDisplayMedia failed, trying screen-only capture:', systemAudioError);

                // Fallback to screen-only capture
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: false,
                });
            }

            // Additionally get microphone input for Linux based on audio mode
            if (audioMode === 'mic_only' || audioMode === 'both') {
                let micStream = null;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });

                    console.log('Linux microphone capture started');

                    // Setup audio processing for microphone on Linux
                    setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Linux:', micError);
                    // Continue without microphone if permission denied
                }
            }

            console.log('Linux capture started - system audio:', mediaStream.getAudioTracks().length > 0, 'microphone mode:', audioMode);
        } else {
            // Windows - use display media with loopback for system audio
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: {
                    sampleRate: SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            console.log('Windows capture started with loopback audio');

            // Setup audio processing for Windows loopback audio only
            setupWindowsLoopbackProcessing();

            if (audioMode === 'mic_only' || audioMode === 'both') {
                let micStream = null;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });
                    console.log('Windows microphone capture started');
                    setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Windows:', micError);
                }
            }
        }

        console.log('MediaStream obtained:', {
            hasVideo: mediaStream.getVideoTracks().length > 0,
            hasAudio: mediaStream.getAudioTracks().length > 0,
            videoTrack: mediaStream.getVideoTracks()[0]?.getSettings(),
        });

        // Start capturing screenshots - check if manual mode
        if (screenshotIntervalSeconds === 'manual' || screenshotIntervalSeconds === 'Manual') {
            console.log('Manual mode enabled - screenshots will be captured on demand only');
            // Update screenshot tracker for status bar
            window.screenshotTracker.isManualMode = true;
            window.screenshotTracker.intervalSeconds = 0;
            // Don't start automatic capture in manual mode
        } else {
            const intervalMilliseconds = parseInt(screenshotIntervalSeconds) * 1000;
            screenshotInterval = setInterval(() => captureScreenshot(imageQuality), intervalMilliseconds);

            // Update screenshot tracker for status bar
            window.screenshotTracker.isManualMode = false;
            window.screenshotTracker.intervalSeconds = parseInt(screenshotIntervalSeconds);

            // Capture first screenshot immediately
            setTimeout(() => captureScreenshot(imageQuality), 100);
        }
    } catch (err) {
        console.error('Error starting capture:', err);
        cheddar.setStatus('error');

        // Send error notification with recovery steps
        const app = document.querySelector('cheating-daddy-app');
        if (app && app.addErrorNotification) {
            let errorMessage = 'Failed to start capture';
            let recoverySteps = [];

            if (err.message && err.message.includes('Permission denied')) {
                errorMessage = 'Screen capture permission denied';
                recoverySteps = [
                    'Allow screen sharing when prompted',
                    'Restart the application',
                    'Try starting the session again'
                ];
            } else if (err.message && err.message.includes('audio')) {
                errorMessage = 'Audio capture failed';
                recoverySteps = [
                    'Check your audio permissions',
                    'Ensure no other app is using the microphone',
                    'Try restarting the session'
                ];
            } else {
                recoverySteps = [
                    'Check your system permissions',
                    'Restart the application',
                    'Contact support if the issue persists'
                ];
            }

            app.addErrorNotification({
                type: 'error',
                title: 'Capture Failed',
                message: errorMessage,
                recoverySteps: recoverySteps,
                actions: [{
                    label: 'Retry',
                    primary: true,
                    dismissOnClick: true,
                    onClick: () => {
                        // Retry capture with same settings
                        startCapture(screenshotIntervalSeconds, imageQuality);
                    }
                }],
                persistent: true
            });
        }
    }
}

function setupLinuxMicProcessing(micStream) {
    // Setup microphone audio processing for Linux
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Prevent memory leak: if buffer grows too large, remove oldest data
        if (audioBuffer.length > MAX_AUDIO_BUFFER_SIZE * samplesPerChunk) {
            console.warn('Audio buffer overflow detected, removing oldest data');
            audioBuffer.splice(0, samplesPerChunk * 10); // Remove 1 second of old data
        }

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-mic-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    // Store processor reference for cleanup
    micAudioProcessor = micProcessor;
}

function setupLinuxSystemAudioProcessing() {
    // Setup system audio processing for Linux (from getDisplayMedia)
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Prevent memory leak: if buffer grows too large, remove oldest data
        if (audioBuffer.length > MAX_AUDIO_BUFFER_SIZE * samplesPerChunk) {
            console.warn('Audio buffer overflow detected, removing oldest data');
            audioBuffer.splice(0, samplesPerChunk * 10); // Remove 1 second of old data
        }

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
}

function setupWindowsLoopbackProcessing() {
    // Setup audio processing for Windows loopback audio only
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Prevent memory leak: if buffer grows too large, remove oldest data
        if (audioBuffer.length > MAX_AUDIO_BUFFER_SIZE * samplesPerChunk) {
            console.warn('Audio buffer overflow detected, removing oldest data');
            audioBuffer.splice(0, samplesPerChunk * 10); // Remove 1 second of old data
        }

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
}

async function captureScreenshot(imageQuality = 'medium', isManual = false) {
    console.log(`Capturing ${isManual ? 'manual' : 'automated'} screenshot...`);
    if (!mediaStream) return;

    // Prevent race condition: if screenshot is already in progress, skip
    if (isCapturingScreenshot) {
        console.log('WARNING: Screenshot already in progress, skipping to prevent race condition');
        return;
    }

    // Check rate limiting for automated screenshots only
    if (!isManual && window.tokenTracker.shouldThrottle()) {
        console.log('Automated screenshot skipped due to rate limiting');

        // Show rate limiting warning to user (only once per throttle period)
        if (!window._rateLimitWarningShown) {
            window._rateLimitWarningShown = true;
            const app = document.querySelector('cheating-daddy-app');
            if (app && app.addErrorNotification) {
                app.addErrorNotification({
                    type: 'warning',
                    title: 'Rate Limiting Active',
                    message: 'Screenshot capture is being throttled to stay within token limits',
                    recoverySteps: [
                        'Automated screenshots will resume when rate limits allow',
                        'You can still capture manual screenshots',
                        'Adjust rate limit settings in Advanced settings'
                    ]
                });
            }

            // Reset warning flag after 2 minutes
            setTimeout(() => {
                window._rateLimitWarningShown = false;
            }, 120000);
        }

        return;
    }

    // Set flag to prevent concurrent screenshots
    isCapturingScreenshot = true;

    // Lazy init of video element
    if (!hiddenVideo) {
        hiddenVideo = document.createElement('video');
        hiddenVideo.srcObject = mediaStream;
        hiddenVideo.muted = true;
        hiddenVideo.playsInline = true;
        await hiddenVideo.play();

        await new Promise(resolve => {
            if (hiddenVideo.readyState >= 2) return resolve();
            hiddenVideo.onloadedmetadata = () => resolve();
        });

        // Lazy init of canvas based on video dimensions
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = hiddenVideo.videoWidth;
        offscreenCanvas.height = hiddenVideo.videoHeight;
        offscreenContext = offscreenCanvas.getContext('2d');
    }

    // Check if video is ready
    if (hiddenVideo.readyState < 2) {
        console.warn('Video not ready yet, skipping screenshot');
        isCapturingScreenshot = false; // Reset flag before returning
        return;
    }

    try {
        offscreenContext.drawImage(hiddenVideo, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
    } catch (error) {
        console.error('Error drawing image to canvas:', error);
        isCapturingScreenshot = false; // Reset flag before returning
        return;
    }

    // Check if image was drawn properly by sampling a pixel
    const imageData = offscreenContext.getImageData(0, 0, 1, 1);
    const isBlank = imageData.data.every((value, index) => {
        // Check if all pixels are black (0,0,0) or transparent
        return index === 3 ? true : value === 0;
    });

    if (isBlank) {
        console.warn('Screenshot appears to be blank/black');
    }

    let qualityValue;
    switch (imageQuality) {
        case 'high':
            qualityValue = 0.9;
            break;
        case 'medium':
            qualityValue = 0.7;
            break;
        case 'low':
            qualityValue = 0.5;
            break;
        default:
            qualityValue = 0.7; // Default to medium
    }

    offscreenCanvas.toBlob(
        async blob => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                isCapturingScreenshot = false; // Reset flag on error
                return;
            }

            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const base64data = reader.result.split(',')[1];

                    // Validate base64 data
                    if (!base64data || base64data.length < 100) {
                        console.error('Invalid base64 data generated');
                        isCapturingScreenshot = false; // Reset flag on error
                        return;
                    }

                    const result = await ipcRenderer.invoke('send-image-content', {
                        data: base64data,
                    });

                    if (result.success) {
                        // Track image tokens after successful send
                        const imageTokens = window.tokenTracker.calculateImageTokens(offscreenCanvas.width, offscreenCanvas.height);
                        window.tokenTracker.addTokens(imageTokens, 'image');
                        console.log(`Image sent successfully - ${imageTokens} tokens used (${offscreenCanvas.width}x${offscreenCanvas.height})`);

                        // Update screenshot tracker for status bar
                        window.screenshotTracker.lastScreenshotTime = Date.now();

                        // Send screenshot captured event for visual feedback
                        ipcRenderer.send('screenshot-captured', base64data);
                    } else {
                        console.error('Failed to send image:', result.error);
                    }
                } finally {
                    // Always reset the flag when done
                    isCapturingScreenshot = false;
                }
            };
            reader.onerror = () => {
                console.error('Failed to read blob as data URL');
                isCapturingScreenshot = false; // Reset flag on error
            };
            reader.readAsDataURL(blob);
        },
        'image/jpeg',
        qualityValue
    );
}

async function captureManualScreenshot(imageQuality = null) {
    console.log('Manual screenshot triggered');
    const quality = imageQuality || currentImageQuality;
    await captureScreenshot(quality, true); // Pass true for isManual
    await new Promise(resolve => setTimeout(resolve, 2000)); // TODO shitty hack
    await sendTextMessage(`Help me on this page, give me the answer no bs, complete answer.
        So if its a code question, give me the approach in few bullet points, then the entire code. Also if theres anything else i need to know, tell me.
        If its a question about the website, give me the answer no bs, complete answer.
        If its a mcq question, give me the answer no bs, complete answer.
        `);
}

// Expose functions to global scope for external access
window.captureManualScreenshot = captureManualScreenshot;

function stopCapture() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }

    // Clean up microphone audio processor (Linux only)
    if (micAudioProcessor) {
        micAudioProcessor.disconnect();
        micAudioProcessor = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    // Stop macOS audio capture if running
    if (isMacOS) {
        ipcRenderer.invoke('stop-macos-audio').catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }

    // Clean up hidden elements
    if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.srcObject = null;
        hiddenVideo = null;
    }
    offscreenCanvas = null;
    offscreenContext = null;
}

// Send text message to Gemini
async function sendTextMessage(text) {
    if (!text || text.trim().length === 0) {
        console.warn('Cannot send empty text message');
        return { success: false, error: 'Empty message' };
    }

    try {
        const result = await ipcRenderer.invoke('send-text-message', text);
        if (result.success) {
            console.log('Text message sent successfully');
        } else {
            console.error('Failed to send text message:', result.error);
        }
        return result;
    } catch (error) {
        console.error('Error sending text message:', error);
        return { success: false, error: error.message };
    }
}

// Conversation storage functions using IndexedDB
let conversationDB = null;

async function initConversationStorage() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ConversationHistory', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            conversationDB = request.result;
            resolve(conversationDB);
        };

        request.onupgradeneeded = event => {
            const db = event.target.result;

            // Create sessions store
            if (!db.objectStoreNames.contains('sessions')) {
                const sessionStore = db.createObjectStore('sessions', { keyPath: 'sessionId' });
                sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

async function saveConversationSession(sessionId, conversationHistory) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');

    const sessionData = {
        sessionId: sessionId,
        timestamp: parseInt(sessionId),
        conversationHistory: conversationHistory,
        lastUpdated: Date.now(),
    };

    return new Promise((resolve, reject) => {
        const request = store.put(sessionData);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getConversationSession(sessionId) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');

    return new Promise((resolve, reject) => {
        const request = store.get(sessionId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getAllConversationSessions() {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
        const request = index.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            // Sort by timestamp descending (newest first)
            const sessions = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sessions);
        };
    });
}

// Listen for conversation data from main process
ipcRenderer.on('save-conversation-turn', async (data) => {
    // Check if incognito mode is enabled
    const incognitoMode = localStorage.getItem('incognitoMode') === 'true';
    if (incognitoMode) {
        console.log('Incognito mode enabled - not saving conversation');
        return;
    }

    try {
        await saveConversationSession(data.sessionId, data.fullHistory);
        console.log('Conversation session saved:', data.sessionId);
    } catch (error) {
        console.error('Error saving conversation session:', error);

        // Handle specific error types
        if (error.name === 'QuotaExceededError') {
            console.warn('Storage quota exceeded - attempting to clear old sessions');

            // Try to save to localStorage as backup
            try {
                const backupKey = `backup_session_${data.sessionId}`;
                localStorage.setItem(backupKey, JSON.stringify(data));
                console.log('Saved conversation to localStorage backup:', backupKey);

                // Show warning to user
                window.dispatchEvent(new CustomEvent('storage-warning', {
                    detail: {
                        type: 'quota_exceeded',
                        message: 'Storage full! Please clear old conversations in History tab.'
                    }
                }));
            } catch (backupError) {
                console.error('Failed to save backup to localStorage:', backupError);
                // Show critical error to user
                window.dispatchEvent(new CustomEvent('storage-error', {
                    detail: {
                        type: 'critical',
                        message: 'Cannot save conversation - storage full and backup failed!'
                    }
                }));
            }
        } else {
            // Other errors
            window.dispatchEvent(new CustomEvent('storage-error', {
                detail: {
                    type: 'unknown',
                    message: `Failed to save conversation: ${error.message}`
                }
            }));
        }
    }
});

// Initialize conversation storage when renderer loads
initConversationStorage().catch(console.error);

// Listen for emergency erase command from main process
ipcRenderer.on('clear-sensitive-data', () => {
    console.log('Clearing renderer-side sensitive data...');
    localStorage.removeItem('apiKey');
    localStorage.removeItem('customPrompt');
    // Consider clearing IndexedDB as well for full erasure
});

// Handle shortcuts based on current view
function handleShortcut(shortcutKey) {
    const currentView = cheddar.getCurrentView();

    if (shortcutKey === 'ctrl+enter' || shortcutKey === 'cmd+enter') {
        if (currentView === 'main') {
            cheddar.element().handleStart();
        } else {
            captureManualScreenshot();
        }
    }
}

// Create reference to the main app element
const cheatingDaddyApp = document.querySelector('cheating-daddy-app');

// Consolidated cheddar object - all functions in one place
const cheddar = {
    // Element access
    element: () => cheatingDaddyApp,
    e: () => cheatingDaddyApp,

    // App state functions - access properties directly from the app element
    getCurrentView: () => cheatingDaddyApp.currentView,
    getLayoutMode: () => cheatingDaddyApp.layoutMode,

    // Status and response functions
    setStatus: text => cheatingDaddyApp.setStatus(text),
    setResponse: response => cheatingDaddyApp.setResponse(response),

    // Core functionality
    initializeGemini,
    startCapture,
    stopCapture,
    sendTextMessage,
    handleShortcut,

    // Conversation history functions
    getAllConversationSessions,
    getConversationSession,
    initConversationStorage,
    saveConversationSession,

    // Content protection function
    getContentProtection: () => {
        const contentProtection = localStorage.getItem('contentProtection');
        return contentProtection !== null ? contentProtection === 'true' : true;
    },

    // Token tracking functions
    getTokenUsage: () => ({
        current: window.tokenTracker.getTokensInLastMinute(),
        max: parseInt(localStorage.getItem('maxTokensPerMin') || '1000000', 10),
        percent: Math.round((window.tokenTracker.getTokensInLastMinute() / parseInt(localStorage.getItem('maxTokensPerMin') || '1000000', 10)) * 100)
    }),
    resetTokenTracker: () => window.tokenTracker.reset(),

    // Connection status
    getConnectionStatus: () => connectionStatus,

    // Incognito mode
    getIncognitoMode: () => localStorage.getItem('incognitoMode') === 'true',
    setIncognitoMode: (enabled) => localStorage.setItem('incognitoMode', enabled.toString()),

    // Platform detection
    isLinux: isLinux,
    isMacOS: isMacOS,
};

// Make it globally available
window.cheddar = cheddar;
