const { desktopCapturer } = require('electron');

/**
 * Fallback Audio Capture Methods
 * Provides alternative audio capture methods when native SystemAudioDump fails
 */

/**
 * Attempt audio capture using Electron's desktopCapturer API
 * @param {Function} onAudioData - Callback for audio data chunks
 * @returns {Promise<{success: boolean, stream: MediaStream|null, error: Error|null}>}
 */
async function tryDesktopCapturer(onAudioData) {
    console.log('[Fallback] Attempting desktopCapturer audio capture...');
    
    try {
        // Get available audio sources
        const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            fetchWindowIcons: false
        });
        
        console.log(`[Fallback] Found ${sources.length} desktop sources`);
        
        // Filter for audio-capable sources
        // Note: desktopCapturer doesn't directly provide audio-only sources,
        // but we can request audio from screen/window capture
        const audioSources = sources.filter(source => {
            // Prefer screen sources as they typically have system audio
            return source.id.startsWith('screen');
        });
        
        if (audioSources.length === 0) {
            console.warn('[Fallback] No audio-capable sources found');
            return {
                success: false,
                stream: null,
                error: new Error('No audio-capable sources available')
            };
        }
        
        // Use the first available audio source (typically the primary screen)
        const primarySource = audioSources[0];
        console.log(`[Fallback] Using source: ${primarySource.name} (${primarySource.id})`);
        
        // Set up MediaStream with audio constraints
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: primarySource.id
                }
            },
            video: false
        });
        
        console.log('[Fallback] MediaStream created successfully');
        
        // Connect to audio processing pipeline
        const audioContext = new AudioContext({
            sampleRate: 16000 // Match expected sample rate for Gemini
        });
        
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Convert Float32Array to Int16Array (PCM format)
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                // Clamp to [-1, 1] and convert to 16-bit PCM
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Convert to Buffer for compatibility with existing pipeline
            const buffer = Buffer.from(pcmData.buffer);
            
            // Call audio data callback
            if (onAudioData) {
                onAudioData(buffer);
            }
        };
        
        // Connect audio nodes
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        console.log('[Fallback] Audio processing pipeline connected');
        
        return {
            success: true,
            stream: stream,
            audioContext: audioContext,
            processor: processor,
            error: null
        };
        
    } catch (error) {
        console.error('[Fallback] desktopCapturer failed:', error);
        return {
            success: false,
            stream: null,
            error: error
        };
    }
}

/**
 * Attempt audio capture using Web Audio API with getDisplayMedia
 * @param {Object} geminiSessionRef - Reference to Gemini session for direct connection
 * @param {Function} onAudioData - Callback for audio data chunks
 * @returns {Promise<{success: boolean, stream: MediaStream|null, error: Error|null}>}
 */
async function tryWebAudioCapture(geminiSessionRef, onAudioData) {
    console.log('[Fallback] Attempting Web Audio API capture...');
    
    try {
        // Use getDisplayMedia to capture system audio
        // This requires user permission and interaction
        const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 16000
            },
            video: false
        });
        
        console.log('[Fallback] getDisplayMedia stream created successfully');
        
        // Set up Web Audio API processing
        const audioContext = new AudioContext({
            sampleRate: 16000 // Match expected sample rate for Gemini
        });
        
        const source = audioContext.createMediaStreamSource(stream);
        
        // Create processor for audio data extraction
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Convert Float32Array to Int16Array (PCM format)
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                // Clamp to [-1, 1] and convert to 16-bit PCM
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Convert to Buffer for compatibility
            const buffer = Buffer.from(pcmData.buffer);
            
            // Call audio data callback
            if (onAudioData) {
                onAudioData(buffer);
            }
            
            // Connect to Gemini session if available
            if (geminiSessionRef && geminiSessionRef.current) {
                try {
                    // Send audio data to Gemini session
                    // Note: This assumes the Gemini session has a method to accept raw audio
                    if (typeof geminiSessionRef.current.sendRealtimeInput === 'function') {
                        geminiSessionRef.current.sendRealtimeInput({
                            audio: buffer
                        }).catch(err => {
                            console.error('[Fallback] Failed to send audio to Gemini:', err);
                        });
                    }
                } catch (error) {
                    console.error('[Fallback] Error sending audio to Gemini:', error);
                }
            }
        };
        
        // Connect audio nodes
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        console.log('[Fallback] Web Audio API processing pipeline connected');
        
        return {
            success: true,
            stream: stream,
            audioContext: audioContext,
            processor: processor,
            error: null
        };
        
    } catch (error) {
        console.error('[Fallback] Web Audio API capture failed:', error);
        return {
            success: false,
            stream: null,
            error: error
        };
    }
}

module.exports = {
    tryDesktopCapturer,
    tryWebAudioCapture
};
