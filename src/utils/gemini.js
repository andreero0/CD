const { GoogleGenAI } = require('@google/genai');
const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');
const { processNewTurn, initializeRAG, retrieveContext } = require('./ragController');
const { conversationState, STATES } = require('./conversationState');
const { formatAllDocuments, clearDocumentCache } = require('./documentRetriever');
const { generateCorrelationId, trackAudioChunk, resolveCorrelationId, clearAll: clearCorrelationData } = require('./audioCorrelation');
const AudioCaptureManager = require('./audioCaptureManager');

// Conversation tracking variables
let currentSessionId = null;
let currentTranscription = '';
let conversationHistory = [];
let isInitializingSession = false;

// ============================================================================
// DUAL SESSION ARCHITECTURE FOR GUARANTEED SPEAKER ATTRIBUTION
// ============================================================================
// Dual Gemini Live session references
let geminiMicSessionRef = { current: null };      // User microphone - coaching + transcription
let geminiInterviewerSessionRef = { current: null }; // Interviewer audio - transcription only

/**
 * CONTEXT BRIDGE: Sends interviewer transcripts to mic session for conversation awareness
 * @param {string} transcript - Interviewer transcript from Session #1
 */
async function bridgeInterviewerTranscript(transcript) {
    if (!geminiMicSessionRef.current) {
        console.warn('[Context Bridge] Mic session not ready, skipping bridge');
        return;
    }

    if (!transcript || transcript.trim().length === 0) {
        return;
    }

    try {
        const contextMessage = `<context>[Interviewer]: ${transcript.trim()}</context>`;

        if (process.env.DEBUG_DUAL_SESSION) {
            console.log(`[Context Bridge] Sending interviewer transcript to mic session`);
        }

        const promise = geminiMicSessionRef.current.sendRealtimeInput({
            text: contextMessage
        });

        if (promise && typeof promise.catch === 'function') {
            promise.catch(err => {
                console.error('[Context Bridge] Failed to send interviewer context:', err);
            });
        }
    } catch (error) {
        console.error('[Context Bridge] Error:', error);
    }
}

/**
 * Normalizes text by removing excessive whitespace
 * Handles: multiple spaces, tabs, Unicode spaces, space before punctuation, spaces around newlines
 * Preserves: punctuation, speaker labels, single newlines
 * @param {string} text - Raw text from Gemini
 * @returns {string} - Normalized text
 */
function normalizeText(text) {
    return text
        .replace(/[\u2000-\u200B\u202F\u205F\u3000]/g, ' ')  // Unicode → ASCII
        .replace(/\t/g, ' ')                                  // Tabs → space
        .replace(/ +/g, ' ')                                  // Multiple → single
        .replace(/ ([.,!?])/g, '$1')                         // Space before punct
        .replace(/ *\n */g, '\n')                            // Clean spaces around newlines
        .replace(/\n{3,}/g, '\n\n')                          // Multiple newlines
        .trim();
}

// Speaker label mappings for different profiles
const speakerLabelMaps = {
    interview: ['Interviewer 1', 'You', 'Interviewer 2', 'Interviewer 3', 'Interviewer 4', 'Interviewer 5'],
    sales: ['Prospect', 'You', 'Decision Maker', 'Stakeholder', 'Client', 'Executive'],
    meeting: ['Manager', 'You', 'Colleague', 'Stakeholder', 'Team Lead', 'Director'],
    presentation: ['Audience Member', 'You', 'Questioner', 'Attendee', 'Executive', 'Participant'],
    negotiation: ['Counterparty', 'You', 'Mediator', 'Legal', 'Decision Maker', 'Advisor'],
    exam: ['Proctor', 'You', 'Student 2', 'Student 3', 'Student 4', 'Student 5'],
};

// Track the current profile for speaker labeling
let currentProfile = 'interview';

// Context injection constants
const CONTEXT_DEBOUNCE_DELAY = 500;        // 500ms debounce
const CONTEXT_FALLBACK_TIMEOUT = 3000;     // 3s fallback
const CONTEXT_MAX_SIZE = 1000;             // 1000 chars immediate send
const CONTEXT_HARD_LIMIT = 2000;           // 2000 chars truncate
const CONTEXT_TURN_HISTORY = 3;            // Last 3 turns

// CORRELATION-BASED SPEAKER TRACKING SYSTEM
// Queue to track audio chunks in order for correlation-based speaker attribution
const audioChunkQueue = [];
const MAX_QUEUE_SIZE = 50; // Keep last 50 chunks (prevents memory leak)

// Track recent speaker attributions for continuity detection
const lastSpeakers = [];

// Track queue size over time for stability analysis
const queueSizeHistory = [];
const MAX_HISTORY_SIZE = 20;

// Validation metrics tracking
const validationMetrics = {
    totalAttributions: 0,
    lowConfidenceCount: 0,
    warningsByType: {},
    averageConfidence: 0,
    confidenceSum: 0
};

// Event-driven context injection tracking
let previousSpeaker = null; // Track previous speaker for turn detection
let speakerContextBuffer = '';
const CONTEXT_SEND_FALLBACK_TIMEOUT = 3000; // 3s fallback if no speaker change
let lastContextSentTime = Date.now();

// Context injection state
let debounceTimer = null;
let pendingContextSend = false;
let turnHistory = [];  // Array of { speaker, text, timestamp }

// TRANSCRIPT BUFFERING: Prevent word-by-word fragmentation
let userSpeechBuffer = ''; // Buffer to accumulate user speech
let lastUserSpeechTime = Date.now(); // Track when last user speech arrived
let bufferStartTime = Date.now(); // Track when buffer started accumulating
const USER_SPEECH_TIMEOUT = 4000; // 4 seconds of silence = sentence complete (increased to allow natural pauses)
const MIN_BUFFER_DURATION = 3000; // Minimum 3 seconds before allowing punctuation flush

// Adaptive timeout constants
const IDLE_TIMEOUT = 2000;          // 2s when no active coaching
const MONITORING_TIMEOUT = 3000;    // 3s when user is answering
const SLOW_START_TIMEOUT = 3000;    // 3s for first few words
const MIN_WORD_THRESHOLD = 5;       // Minimum words before sending to UI

function setCurrentProfile(profile) {
    currentProfile = profile || 'interview';
}

/**
 * Determines appropriate timeout based on conversation state and buffer state
 * Priority: 1) wordCount < 3 → 3s, 2) MONITORING state → 3s, 3) else → 2s
 * @param {string} conversationState - Current state (IDLE/MONITORING/etc)
 * @param {number} wordCount - Current buffer word count
 * @returns {number} - Timeout in milliseconds
 */
function getAdaptiveTimeout(conversationState, wordCount) {
    // Priority order matters!
    if (wordCount < 3) return SLOW_START_TIMEOUT;
    if (conversationState === 'MONITORING') return MONITORING_TIMEOUT;
    return IDLE_TIMEOUT;
}

/**
 * Counts words in text
 * @param {string} text - Text to count
 * @returns {number} - Word count
 */
function countWords(text) {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Determines if buffer should flush based on content and timing
 * @param {string} buffer - Current buffer content
 * @param {number} lastUpdateTime - Timestamp of last update
 * @param {string} conversationState - Current conversation state
 * @returns {boolean} - True if should flush
 */
function shouldFlushBuffer(buffer, lastUpdateTime, conversationState) {
    const wordCount = countWords(buffer);
    const hasSentenceEnding = /[.!?]$/.test(buffer.trim());

    // Always flush if sentence-ending punctuation
    if (hasSentenceEnding) return true;

    // Check timeout
    const timeout = getAdaptiveTimeout(conversationState, wordCount);
    const timeSinceLastUpdate = Date.now() - lastUpdateTime;
    const timeoutReached = timeSinceLastUpdate >= timeout;

    // Only flush on timeout if word count meets threshold
    if (timeoutReached && wordCount >= MIN_WORD_THRESHOLD) return true;

    return false;
}

/**
 * Handles speaker change logic
 * @param {string} currentBuffer - Current buffer content
 * @param {string} previousSpeaker - Previous speaker
 * @param {string} newSpeaker - New speaker
 * @returns {object} - { shouldFlush: boolean, shouldDiscard: boolean }
 */
function handleSpeakerChange(currentBuffer, previousSpeaker, newSpeaker) {
    // No speaker change, no action
    if (previousSpeaker === newSpeaker) {
        return { shouldFlush: false, shouldDiscard: false };
    }

    const wordCount = countWords(currentBuffer);

    // Speaker changed
    if (wordCount >= MIN_WORD_THRESHOLD) {
        // Flush buffer with >= 5 words
        return { shouldFlush: true, shouldDiscard: false };
    } else {
        // Discard buffer with < 5 words
        return { shouldFlush: false, shouldDiscard: true };
    }
}

/**
 * Cancels active debounce timer
 * Called when: context exceeds 1000 chars, session ends, system shutdown
 */
function cancelDebounce() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        pendingContextSend = false;
        const { sessionLogger } = require('./sessionLogger');
        sessionLogger.logDebounce('cancelled', 0);
    }
}

/**
 * Schedules context injection with debouncing
 * @param {string} trigger - Trigger reason (speaker_turn/timeout/size_limit)
 */
function scheduleContextInjection(trigger) {
    const { sessionLogger } = require('./sessionLogger');

    // Check size limits first
    if (speakerContextBuffer.length > CONTEXT_MAX_SIZE) {
        // Immediate send for large buffers
        cancelDebounce();
        sendContextToAI(speakerContextBuffer, 'size_limit');
        return;
    }

    // Cancel existing timer
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        sessionLogger.logDebounce('cancelled', CONTEXT_DEBOUNCE_DELAY);
    }

    // Schedule new debounce
    pendingContextSend = true;
    sessionLogger.logDebounce('scheduled', CONTEXT_DEBOUNCE_DELAY);

    debounceTimer = setTimeout(() => {
        sessionLogger.logDebounce('executed', CONTEXT_DEBOUNCE_DELAY);
        sendContextToAI(speakerContextBuffer, trigger);
        pendingContextSend = false;
        debounceTimer = null;
    }, CONTEXT_DEBOUNCE_DELAY);
}

/**
 * Builds context message with turn history and last suggestion
 * Format:
 *   <context>[Interviewer]: question\n[You]: answer</context>
 *   <lastSuggestion>Text... Turn ID: 3</lastSuggestion>
 * @param {string} currentSuggestion - Current suggestion object
 * @returns {string} - Formatted context message
 */
function buildContextMessage(currentSuggestion = null) {
    // Get last N turns from turn history
    const recentTurns = turnHistory.slice(-CONTEXT_TURN_HISTORY);
    const contextText = recentTurns.map(turn =>
        `[${turn.speaker}]: ${turn.text}`
    ).join('\n');

    let message = `<context>\n${contextText}\n</context>`;

    // Add last suggestion if exists
    if (currentSuggestion && currentSuggestion.text) {
        message += `\n<lastSuggestion>${currentSuggestion.text} Turn ID: ${currentSuggestion.turnId}</lastSuggestion>`;
    }

    return message;
}

/**
 * Sends context to Gemini with retry logic
 * @param {string} context - Context text
 * @param {string} trigger - Trigger reason
 * @param {boolean} isRetry - Whether this is a retry attempt
 */
async function sendContextToAI(context, trigger, isRetry = false) {
    const { sessionLogger } = require('./sessionLogger');

    try {
        // Check size and truncate if needed
        if (context.length > CONTEXT_HARD_LIMIT) {
            sessionLogger.logContextTruncation(context.length, CONTEXT_HARD_LIMIT);
            context = context.slice(-CONTEXT_HARD_LIMIT);  // Keep most recent
        }

        // Log the send
        sessionLogger.log('ContextInjection', `Trigger: ${trigger}, Size: ${context.length} chars`);

        // Send to Gemini (assuming geminiSessionRef exists)
        if (global.geminiSessionRef && global.geminiSessionRef.current) {
            await global.geminiSessionRef.current.sendRealtimeInput({ text: context });
            lastContextSentTime = Date.now();
            speakerContextBuffer = '';  // Clear buffer after successful send
        }
    } catch (error) {
        console.error('[Context Injection] Failed:', error);
        sessionLogger.log('ContextInjection', `Error: ${error.message}`);

        // Retry once after 1 second
        if (!isRetry) {
            setTimeout(() => {
                sendContextToAI(context, `${trigger}_retry`, true);
            }, 1000);
        }
    }
}

function formatSpeakerResults(results, profile = null) {
    const activeProfile = profile || currentProfile;
    const labelMap = speakerLabelMaps[activeProfile] || speakerLabelMaps.interview;

    let text = '';
    for (const result of results) {
        if (result.transcript && result.speakerId) {
            // speakerId starts at 1, array indices start at 0
            const labelIndex = result.speakerId - 1;
            const speakerLabel = labelMap[labelIndex] || `Speaker ${result.speakerId}`;
            text += `[${speakerLabel}]: ${result.transcript}\n`;
        }
    }
    return text;
}

module.exports.formatSpeakerResults = formatSpeakerResults;
module.exports.setCurrentProfile = setCurrentProfile;

/**
 * Removes stale chunks from the audio correlation queue
 * Stale chunks are older than 2 seconds and likely represent drift
 * Also enforces maximum queue size of 10 chunks to prevent overflow
 */
function removeStaleChunks() {
    const now = Date.now();
    const MAX_AGE_MS = 2000; // 2 seconds (reduced from 5s to prevent drift)
    const MAX_QUEUE_SIZE = 10; // Maximum queue size before forcible drain

    const initialLength = audioChunkQueue.length;

    // First, remove stale chunks based on age
    audioChunkQueue.splice(0, audioChunkQueue.length, ...audioChunkQueue.filter(chunk => {
        const age = now - chunk.timestamp;
        return age < MAX_AGE_MS;
    }));

    // Second, forcibly drain queue if it exceeds max size (queue drift protection)
    if (audioChunkQueue.length > MAX_QUEUE_SIZE) {
        const excessChunks = audioChunkQueue.length - MAX_QUEUE_SIZE;
        audioChunkQueue.splice(0, excessChunks); // Remove oldest chunks
        if (process.env.DEBUG_CORRELATION) {
            console.log(`[Correlation] Forcibly drained ${excessChunks} chunks to prevent queue overflow (queue was ${initialLength}, now ${audioChunkQueue.length})`);
        }
    }

    if (audioChunkQueue.length < initialLength && process.env.DEBUG_CORRELATION) {
        console.log(`[Correlation] Removed ${initialLength - audioChunkQueue.length} stale chunks (>${MAX_AGE_MS}ms old)`);
    }

    // Track queue size for stability analysis
    queueSizeHistory.push(audioChunkQueue.length);
    if (queueSizeHistory.length > MAX_HISTORY_SIZE) {
        queueSizeHistory.shift(); // Keep last 20 samples
    }
}

/**
 * Determines speaker from audio correlation queue
 * Uses FIFO matching: first transcription matches first unresolved audio chunk
 * Enhanced with timestamp validation, queue size monitoring, and speaker continuity
 */
function determineSpeakerFromCorrelation() {
    // Remove stale chunks first
    removeStaleChunks();

    // Warn if queue is growing too large (drift indicator)
    if (audioChunkQueue.length > 10 && process.env.DEBUG_CORRELATION) {
        console.warn(`[Correlation] Large queue size detected: ${audioChunkQueue.length} chunks. Possible desynchronization.`);
    }

    // Try to match with oldest untracked chunk in queue
    if (audioChunkQueue.length > 0) {
        const oldestChunk = audioChunkQueue.shift();
        const speaker = oldestChunk.source === 'system' ? 'Interviewer' : 'You';

        if (process.env.DEBUG_CORRELATION) {
            const age = Date.now() - oldestChunk.timestamp;
            console.log(`[Speaker Attribution] Matched transcription to ${oldestChunk.source} audio (age: ${age}ms, queue: ${audioChunkQueue.length})`);
        }

        // Track for continuity detection
        lastSpeakers.push(speaker);
        if (lastSpeakers.length > 5) lastSpeakers.shift();

        return speaker;
    }

    // Improved fallback: use most recent speaker if available
    if (lastSpeakers.length > 0) {
        const fallbackSpeaker = lastSpeakers[lastSpeakers.length - 1];
        if (process.env.DEBUG_CORRELATION) {
            console.log(`[Speaker Attribution] Queue empty, using last speaker: ${fallbackSpeaker}`);
        }
        return fallbackSpeaker;
    }

    // Final fallback
    if (process.env.DEBUG_CORRELATION) {
        console.log('[Speaker Attribution] Queue empty, no history, defaulting to "You"');
    }
    return 'You';
}

/**
 * Calculate confidence score for correlation-based speaker attribution
 * Returns 0.0 (no confidence) to 1.0 (high confidence)
 */
function calculateCorrelationConfidence() {
    let score = 0.5; // Start with neutral confidence

    // Factor 1: Queue size (larger queue = lower confidence due to potential drift)
    if (audioChunkQueue.length === 0) {
        score -= 0.3; // No queue = fallback mode = low confidence
    } else if (audioChunkQueue.length > 10) {
        score -= 0.2; // Large queue suggests desynchronization
    } else if (audioChunkQueue.length < 3) {
        score += 0.2; // Small queue = recent chunks = higher accuracy
    }

    // Factor 2: Chunk age (older chunks = lower confidence)
    if (audioChunkQueue.length > 0) {
        const oldestChunkAge = Date.now() - audioChunkQueue[0].timestamp;
        if (oldestChunkAge > 3000) {
            score -= 0.2; // Chunks older than 3s likely stale
        } else if (oldestChunkAge < 500) {
            score += 0.1; // Very recent = more reliable
        }
    }

    // Factor 3: Speaker continuity (same speaker multiple times = higher confidence)
    if (lastSpeakers.length >= 3) {
        const recentSpeakers = lastSpeakers.slice(-3);
        const allSame = recentSpeakers.every(s => s === recentSpeakers[0]);
        if (allSame) {
            score += 0.2; // Speaker continuity suggests stability
        }
    }

    // Factor 4: Queue stability (consistent size = higher confidence)
    if (queueSizeHistory.length >= 5) {
        const avgSize = queueSizeHistory.reduce((a, b) => a + b, 0) / queueSizeHistory.length;
        const variance = queueSizeHistory.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / queueSizeHistory.length;
        if (variance < 2) {
            score += 0.1; // Stable queue = predictable correlation
        }
    }

    // Clamp score to [0.0, 1.0]
    return Math.max(0.0, Math.min(1.0, score));
}

/**
 * Validate speaker attribution decision
 * @param {string} attributedSpeaker - The speaker determined by correlation
 * @param {string} transcript - The transcribed text
 * @returns {object} Validation result with confidence and warnings
 */
function validateSpeakerAttribution(attributedSpeaker, transcript) {
    const confidence = calculateCorrelationConfidence();
    const warnings = [];

    // Warning: Low confidence score
    if (confidence < 0.3) {
        warnings.push('LOW_CONFIDENCE: Correlation reliability is low');
    }

    // Warning: Queue drift detected
    if (audioChunkQueue.length > 15) {
        warnings.push('QUEUE_DRIFT: Audio chunk queue is unusually large');
    }

    // Warning: Rapid speaker changes (possible misattribution)
    if (lastSpeakers.length >= 5) {
        const recentChanges = lastSpeakers.slice(-5).reduce((changes, speaker, i, arr) => {
            return i > 0 && speaker !== arr[i - 1] ? changes + 1 : changes;
        }, 0);
        if (recentChanges >= 3) {
            warnings.push('RAPID_CHANGES: Frequent speaker switches detected (possible correlation error)');
        }
    }

    // Warning: Empty queue fallback
    if (audioChunkQueue.length === 0) {
        warnings.push('FALLBACK_MODE: Using previous speaker (no audio chunks available)');
    }

    // Update metrics
    validationMetrics.totalAttributions++;
    validationMetrics.confidenceSum += confidence;
    validationMetrics.averageConfidence = validationMetrics.confidenceSum / validationMetrics.totalAttributions;

    if (confidence < 0.3) {
        validationMetrics.lowConfidenceCount++;
    }

    // Track warnings by type
    warnings.forEach(warning => {
        const warningType = warning.split(':')[0];
        validationMetrics.warningsByType[warningType] = (validationMetrics.warningsByType[warningType] || 0) + 1;
    });

    return {
        attributedSpeaker,
        confidence,
        warnings,
        timestamp: new Date().toISOString(),
        queueSize: audioChunkQueue.length,
        queueAge: audioChunkQueue.length > 0 ? Date.now() - audioChunkQueue[0].timestamp : null
    };
}

/**
 * Log validation metrics summary
 */
function logValidationMetrics() {
    if (process.env.DEBUG_SPEAKER_ATTRIBUTION && validationMetrics.totalAttributions > 0) {
        const { sessionLogger } = require('./sessionLogger');
        const metrics = {
            total: validationMetrics.totalAttributions,
            lowConfidence: validationMetrics.lowConfidenceCount,
            lowConfidenceRate: (validationMetrics.lowConfidenceCount / validationMetrics.totalAttributions * 100).toFixed(1) + '%',
            avgConfidence: validationMetrics.averageConfidence.toFixed(2),
            warnings: validationMetrics.warningsByType
        };

        // Log to both console and file
        console.log('[Validation Metrics]', metrics);
        sessionLogger.log('ValidationMetrics', JSON.stringify(metrics, null, 2));
    }
}

/**
 * Sends speaker context on turn boundaries (event-driven)
 * Primary trigger: speaker change
 * Fallback: 3s timeout
 */
function sendSpeakerContextIfNeeded(currentSpeaker, geminiSessionRef, force = false) {
    const now = Date.now();
    const timeSinceLastContext = now - lastContextSentTime;

    // Trigger 1: Speaker turn boundary (speaker changed)
    const speakerChanged = previousSpeaker !== null && previousSpeaker !== currentSpeaker;

    // Trigger 2: Fallback timeout (3 seconds)
    const timeoutReached = timeSinceLastContext >= CONTEXT_SEND_FALLBACK_TIMEOUT;

    const shouldSend = force || speakerChanged || timeoutReached;

    if (shouldSend && speakerContextBuffer.trim()) {
        try {
            const triggerReason = speakerChanged ? 'speaker_turn' : 'timeout_fallback';

            if (process.env.DEBUG_CONTEXT) {
                console.log(`[Context Injection] Triggering send (reason: ${triggerReason}, buffer length: ${speakerContextBuffer.length})`);
            }

            if (geminiSessionRef.current && typeof geminiSessionRef.current.sendRealtimeInput === 'function') {
                const promise = geminiSessionRef.current.sendRealtimeInput({
                    text: `<context>\n${speakerContextBuffer.trim()}\n</context>`
                });

                if (promise && typeof promise.catch === 'function') {
                    promise.catch(err => {
                        console.error('[Context Injection] Failed to send speaker context:', err);
                    });
                }
                // Silently skip if sendRealtimeInput returns undefined - normal during certain states
            }

            // Reset buffer and timer
            speakerContextBuffer = '';
            lastContextSentTime = now;

            console.log(`[Context Injection] Sent to AI (trigger: ${triggerReason})`);
        } catch (err) {
            console.error('[Context Injection] Error calling sendRealtimeInput:', err);
        }
    }

    // Update previous speaker for next comparison
    previousSpeaker = currentSpeaker;
}

// Audio capture variables
let systemAudioProc = null;
let audioCaptureManager = null;

// AI response handling
let messageBuffer = '';
let isGenerationComplete = true; // Track if previous AI response is complete
let isResponseInterrupted = false;

// Reconnection tracking variables
let reconnectionAttempts = 0;
let maxReconnectionAttempts = 3;
let reconnectionDelay = 2000; // 2 seconds between attempts
let lastSessionParams = null;

// SECURITY FIX: Session initialization lock to prevent race conditions
let initializationPromise = null;

function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

// Conversation management functions
async function initializeNewSession() {
    currentSessionId = Date.now().toString();
    currentTranscription = '';
    conversationHistory = [];
    speakerContextBuffer = '';
    lastContextSentTime = Date.now();
    userSpeechBuffer = '';
    lastUserSpeechTime = Date.now();
    clearCorrelationData();
    audioChunkQueue.length = 0;
    previousSpeaker = null;
    console.log('New conversation session started:', currentSessionId);

    // Reset conversation state machine for new session
    conversationState.reset();

    // Initialize RAG system (async, non-blocking)
    initializeRAG().catch(error => {
        console.error('Error initializing RAG system:', error);
    });
}

async function saveConversationTurn(transcription, aiResponse) {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const conversationTurn = {
        timestamp: Date.now(),
        transcription: transcription.trim(),
        ai_response: aiResponse.trim(),
    };

    conversationHistory.push(conversationTurn);
    console.log('Saved conversation turn:', conversationTurn);

    // Send to renderer to save in IndexedDB
    sendToRenderer('save-conversation-turn', {
        sessionId: currentSessionId,
        turn: conversationTurn,
        fullHistory: conversationHistory,
    });

    // Process turn with RAG system (async, non-blocking)
    processNewTurn(currentSessionId, conversationTurn).catch(error => {
        console.error('Error processing turn with RAG:', error);
    });
}

function getCurrentSessionData() {
    return {
        sessionId: currentSessionId,
        history: conversationHistory,
    };
}

async function sendReconnectionContext() {
    if (!global.geminiSessionRef?.current || conversationHistory.length === 0) {
        return;
    }

    try {
        // Gather transcriptions from recent conversation history (last 3 turns to save tokens)
        const recentTranscriptions = conversationHistory
            .slice(-3) // Only get last 3 conversations
            .map(turn => turn.transcription)
            .filter(transcription => transcription && transcription.trim().length > 0);

        if (recentTranscriptions.length === 0) {
            return;
        }

        // Create a clearer context message with numbered questions
        const numberedQuestions = recentTranscriptions
            .map((q, index) => `${index + 1}. ${q}`)
            .join('\n');

        const contextMessage = `[Connection restored - Recent context]\n${numberedQuestions}\n\nPlease continue providing assistance based on the above context.`;

        console.log(`Sending reconnection context with ${recentTranscriptions.length} recent questions (of ${conversationHistory.length} total)`);

        // Send the context message to the new session
        await global.geminiSessionRef.current.sendRealtimeInput({
            text: contextMessage,
        });

        // Notify user that reconnection happened with context
        sendToRenderer('update-status', 'reconnected');
        setTimeout(() => {
            sendToRenderer('update-status', 'Live');
        }, 2000);
    } catch (error) {
        console.error('Error sending reconnection context:', error);
    }
}

async function getEnabledTools() {
    const tools = [];

    // Check if Google Search is enabled (default: true)
    const googleSearchEnabled = await getStoredSetting('googleSearchEnabled', 'true');
    console.log('Google Search enabled:', googleSearchEnabled);

    if (googleSearchEnabled === 'true') {
        tools.push({ googleSearch: {} });
        console.log('Added Google Search tool');
    } else {
        console.log('Google Search tool disabled');
    }

    return tools;
}

async function getStoredSetting(key, defaultValue) {
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            // Wait a bit for the renderer to be ready
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try to get setting from renderer process localStorage
            const value = await windows[0].webContents.executeJavaScript(`
                (function() {
                    try {
                        if (typeof localStorage === 'undefined') {
                            console.log('localStorage not available yet for ${key}');
                            return '${defaultValue}';
                        }
                        const stored = localStorage.getItem('${key}');
                        console.log('Retrieved setting ${key}:', stored);
                        return stored || '${defaultValue}';
                    } catch (e) {
                        console.error('Error accessing localStorage for ${key}:', e);
                        return '${defaultValue}';
                    }
                })()
            `);
            return value;
        }
    } catch (error) {
        console.error('Error getting stored setting for', key, ':', error.message);
    }
    console.log('Using default value for', key, ':', defaultValue);
    return defaultValue;
}

async function attemptReconnection() {
    if (!lastSessionParams || reconnectionAttempts >= maxReconnectionAttempts) {
        console.log('Max reconnection attempts reached or no session params stored');
        sendToRenderer('reconnection-failed', {
            reason: 'max_attempts',
            message: 'Unable to reconnect after multiple attempts'
        });
        sendToRenderer('update-status', 'Session closed');
        return false;
    }

    reconnectionAttempts++;
    console.log(`Attempting reconnection ${reconnectionAttempts}/${maxReconnectionAttempts}...`);

    // Calculate delay with exponential backoff
    const currentDelay = reconnectionDelay * Math.pow(2, reconnectionAttempts - 1);

    // Send reconnection status to UI
    sendToRenderer('reconnection-status', {
        attempt: reconnectionAttempts,
        maxAttempts: maxReconnectionAttempts,
        secondsUntilRetry: Math.ceil(currentDelay / 1000),
        isRetrying: true
    });

    // Wait before attempting reconnection
    await new Promise(resolve => setTimeout(resolve, currentDelay));

    try {
        const session = await initializeGeminiSession(
            lastSessionParams.apiKey,
            lastSessionParams.customPrompt,
            lastSessionParams.profile,
            lastSessionParams.language,
            true // isReconnection flag
        );

        if (session && global.geminiSessionRef) {
            global.geminiSessionRef.current = session;
            reconnectionAttempts = 0; // Reset counter on successful reconnection
            console.log('Live session reconnected');

            // Send success status
            sendToRenderer('reconnection-success', {
                message: 'Session restored successfully'
            });

            // Send context message with previous transcriptions
            await sendReconnectionContext();

            return true;
        }
    } catch (error) {
        console.error(`Reconnection attempt ${reconnectionAttempts} failed:`, error);

        // Send error status
        sendToRenderer('reconnection-error', {
            attempt: reconnectionAttempts,
            maxAttempts: maxReconnectionAttempts,
            error: error.message
        });
    }

    // If this attempt failed, try again
    if (reconnectionAttempts < maxReconnectionAttempts) {
        return attemptReconnection();
    } else {
        console.log('All reconnection attempts failed');
        sendToRenderer('reconnection-failed', {
            reason: 'max_attempts',
            message: 'Unable to reconnect after multiple attempts'
        });
        sendToRenderer('update-status', 'Session closed');
        return false;
    }
}

/**
 * ============================================================================
 * DUAL SESSION MESSAGE HANDLERS
 * ============================================================================
 * Creates separate message handlers for interviewer (transcription-only) and
 * mic (coaching + transcription) sessions
 */

/**
 * Creates message handler for INTERVIEWER session (transcription-only)
 */
function createInterviewerMessageHandler() {
    return function(message) {
        if (process.env.DEBUG_DUAL_SESSION) {
            console.log('[Interviewer Session] Message:', message);
        }

        // Handle transcription from interviewer audio
        if (message.serverContent?.inputTranscription) {
            let transcript = '';

            if (message.serverContent.inputTranscription.results) {
                transcript = formatSpeakerResults(message.serverContent.inputTranscription.results);
            } else if (message.serverContent.inputTranscription.text) {
                transcript = message.serverContent.inputTranscription.text;
            }

            if (transcript && transcript.trim()) {
                const trimmedTranscript = transcript.trim();
                console.log(`[Interviewer Session] Transcript: "${trimmedTranscript.substring(0, 50)}..."`);

                // 1. Bridge to mic session for context
                bridgeInterviewerTranscript(trimmedTranscript);

                // 2. Send to UI with "Interviewer" tag
                sendToRenderer('transcript-update', {
                    text: trimmedTranscript,
                    speaker: 'Interviewer'
                });

                // 3. Add to conversation history
                currentTranscription += `[Interviewer]: ${trimmedTranscript} `;
                speakerContextBuffer += `[Interviewer]: ${trimmedTranscript} `;

                // 4. Track metrics
                validationMetrics.totalAttributions++;
                validationMetrics.systemAudioAttributions++;
            }
        }

        if (message.serverContent?.turnComplete) {
            console.log('[Interviewer Session] Turn complete');
        }
    };
}

/**
 * Creates message handler for MIC session (coaching + transcription)
 */
function createMicMessageHandler() {
    return function(message) {
        if (process.env.DEBUG_DUAL_SESSION) {
            console.log('[Mic Session] Message:', message);
        }

        // Handle transcription from user mic
        if (message.serverContent?.inputTranscription) {
            let transcript = '';

            if (message.serverContent.inputTranscription.results) {
                transcript = formatSpeakerResults(message.serverContent.inputTranscription.results);
            } else if (message.serverContent.inputTranscription.text) {
                transcript = message.serverContent.inputTranscription.text;
            }

            if (transcript && transcript.trim()) {
                const trimmedTranscript = transcript.trim();
                console.log(`[Mic Session] Transcript: "${trimmedTranscript.substring(0, 50)}..."`);

                // 1. Send to UI with "You" tag
                sendToRenderer('transcript-update', {
                    text: trimmedTranscript,
                    speaker: 'You'
                });

                // 2. Add to conversation history
                currentTranscription += `[You]: ${trimmedTranscript} `;
                speakerContextBuffer += `[You]: ${trimmedTranscript} `;

                // 3. Track for coaching feedback
                const comparison = conversationState.compareResponse(trimmedTranscript);
                if (comparison && comparison.hasSuggestion) {
                    console.log(`[Coaching] User adherence: ${comparison.adherence}% - ${comparison.analysis}`);
                }

                // 4. Track metrics
                validationMetrics.totalAttributions++;
                validationMetrics.micSessionAttributions++;
            }
        }

        // Handle AI coaching responses
        if (message.serverContent?.modelTurn?.parts) {
            if (isGenerationComplete) {
                console.log('[Mic Session] Starting new coaching response');
                messageBuffer = '';
                isGenerationComplete = false;
            }

            for (const part of message.serverContent.modelTurn.parts) {
                if (part.text) {
                    messageBuffer += part.text;
                    sendToRenderer('update-response', messageBuffer);
                }
            }
        }

        if (message.serverContent?.interrupted) {
            console.log('[Mic Session] Response interrupted');
            messageBuffer = '';
            isGenerationComplete = true;
        }

        if (message.serverContent?.generationComplete) {
            console.log('[Mic Session] Coaching response complete');
            sendToRenderer('update-response', messageBuffer);
            sendToRenderer('generation-complete');

            if (messageBuffer && messageBuffer.trim().length > 0) {
                conversationState.trackSuggestion(messageBuffer.trim(), 'AI Coach');
            }

            if (currentTranscription && messageBuffer) {
                saveConversationTurn(currentTranscription, messageBuffer);
                currentTranscription = '';
            }

            messageBuffer = '';
            isGenerationComplete = true;
        }

        if (message.serverContent?.turnComplete) {
            sendToRenderer('update-status', 'Listening...');
        }
    };
}

/**
 * Creates error handler for a session
 */
function createErrorHandler(sessionType) {
    return function(e) {
        console.error(`[${sessionType} Session] Error:`, e.message);

        const isApiKeyError =
            e.message &&
            (e.message.includes('API key not valid') ||
                e.message.includes('invalid API key') ||
                e.message.includes('authentication failed') ||
                e.message.includes('unauthorized'));

        if (isApiKeyError) {
            console.log(`[${sessionType} Session] API key error`);
            lastSessionParams = null;
            reconnectionAttempts = maxReconnectionAttempts;
            sendToRenderer('update-status', `Error: Invalid API key (${sessionType})`);
            return;
        }

        sendToRenderer('update-status', `Warning: ${sessionType} session error - ${e.message}`);
    };
}

/**
 * Creates close handler for a session
 */
function createCloseHandler(sessionType) {
    return function(e) {
        console.log(`[${sessionType} Session] Closed:`, e.reason);

        const isApiKeyError =
            e.reason &&
            (e.reason.includes('API key not valid') ||
                e.reason.includes('invalid API key') ||
                e.reason.includes('authentication failed') ||
                e.reason.includes('unauthorized'));

        if (isApiKeyError) {
            console.log(`[${sessionType} Session] Closed due to API key error`);
            lastSessionParams = null;
            reconnectionAttempts = maxReconnectionAttempts;
            sendToRenderer('update-status', `Session closed: Invalid API key (${sessionType})`);
            return;
        }

        if (lastSessionParams && reconnectionAttempts < maxReconnectionAttempts) {
            console.log(`[${sessionType} Session] Attempting reconnection...`);
            attemptReconnection();
        } else {
            sendToRenderer('update-status', `${sessionType} session closed`);
        }
    };
}

async function initializeGeminiSession(apiKey, customPrompt = '', profile = 'interview', language = 'en-US', isReconnection = false) {
    // SECURITY FIX: If already initializing, wait for that promise to complete
    if (initializationPromise) {
        console.log('Session initialization already in progress, waiting...');
        return await initializationPromise;
    }

    // SECURITY FIX: Validate API key
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        console.error('Invalid API key provided');
        return null;
    }

    // SECURITY FIX: Validate other inputs
    if (customPrompt && typeof customPrompt !== 'string') {
        console.error('Invalid custom prompt type');
        customPrompt = '';
    }

    if (customPrompt && customPrompt.length > 10000) {
        console.warn('Custom prompt too long, truncating to 10000 characters');
        customPrompt = customPrompt.substring(0, 10000);
    }

    const validProfiles = ['interview', 'sales', 'meeting', 'presentation', 'negotiation', 'exam'];
    if (!validProfiles.includes(profile)) {
        console.warn(`Invalid profile ${profile}, defaulting to interview`);
        profile = 'interview';
    }

    isInitializingSession = true;
    sendToRenderer('session-initializing', true);

    // Reset response buffer state for new session
    messageBuffer = '';
    isGenerationComplete = true;

    // SECURITY FIX: Create the initialization promise
    initializationPromise = (async () => {
        try {
            // Store session parameters for reconnection (only if not already reconnecting)
            if (!isReconnection) {
                lastSessionParams = {
                    apiKey,
                    customPrompt,
                    profile,
                    language,
                };
                reconnectionAttempts = 0; // Reset counter for new session
            }

    // Set current profile for speaker labeling
    setCurrentProfile(profile);
    console.log(`Speaker diarization configured for profile: ${profile}`);

    const client = new GoogleGenAI({
        vertexai: false,
        apiKey: apiKey,
    });

    // Get enabled tools first to determine Google Search status
    const enabledTools = await getEnabledTools();
    const googleSearchEnabled = enabledTools.some(tool => tool.googleSearch);

    // Load documents and format for AI context (only if not reconnecting)
    let documentsContext = '';
    if (!isReconnection) {
        try {
            console.log('Loading documents for AI context...');
            documentsContext = await formatAllDocuments({
                maxTotalTokens: 8000,   // Reserve ~8k tokens for documents
                maxTokensPerDoc: 3000,  // Max 3k tokens per document
                forceRefresh: true,     // Force fresh load on new session
            });

            if (documentsContext) {
                console.log('Documents loaded successfully for AI context');
            } else {
                console.log('No documents available');
            }
        } catch (error) {
            console.error('Error loading documents:', error);
            documentsContext = '';
        }
    }

    // Build system prompt with documents
    const systemPrompt = getSystemPrompt(profile, customPrompt, googleSearchEnabled, documentsContext);

    // Initialize new conversation session (only if not reconnecting)
    if (!isReconnection) {
        initializeNewSession();

        // Start session logger for diagnostics
        const { sessionLogger } = require('./sessionLogger');
        sessionLogger.startSession();
        console.log('[SessionLogger] Session logging initialized');
    }

        // ============================================================================
        // DUAL SESSION INITIALIZATION
        // Create TWO separate Gemini sessions for guaranteed speaker attribution
        // ============================================================================

        console.log('[Dual Session] Initializing two separate Gemini sessions...');

        // System prompt for INTERVIEWER session (transcription-only)
        const interviewerSystemPrompt = "You are a transcription service. Only transcribe audio accurately. Do not generate responses or coaching suggestions.";

        // System prompt for MIC session (full coaching)
        const micSystemPrompt = systemPrompt; // Use the full coaching prompt built earlier

        try {
            // ========================================================================
            // SESSION #1: INTERVIEWER (Transcription-Only)
            // ========================================================================
            console.log('[Dual Session] Creating interviewer session (transcription-only)...');

            const interviewerSession = await client.live.connect({
                model: 'gemini-live-2.5-flash-preview',
                callbacks: {
                    onopen: function() {
                        console.log('[Interviewer Session] Connected');
                        sendToRenderer('update-status', 'Interviewer session connected');
                    },
                    onmessage: createInterviewerMessageHandler(),
                    onerror: createErrorHandler('Interviewer'),
                    onclose: createCloseHandler('Interviewer'),
                },
                config: {
                    responseModalities: [], // No responses needed - transcription only
                    tools: [], // No tools for transcription-only session
                    inputAudioTranscription: {
                        enableSpeakerDiarization: false, // Single speaker expected
                        languageCode: language,
                    },
                    contextWindowCompression: { slidingWindow: {} },
                    speechConfig: { languageCode: language },
                    systemInstruction: {
                        parts: [{ text: interviewerSystemPrompt }],
                    },
                },
            });

            geminiInterviewerSessionRef.current = interviewerSession;
            console.log('[Interviewer Session] Initialized successfully');

            // ========================================================================
            // SESSION #2: MIC (Coaching + Transcription)
            // ========================================================================
            console.log('[Dual Session] Creating mic session (coaching + transcription)...');

            const micSession = await client.live.connect({
                model: 'gemini-live-2.5-flash-preview',
                callbacks: {
                    onopen: function() {
                        console.log('[Mic Session] Connected');
                        sendToRenderer('update-status', 'Live session connected (dual mode)');
                    },
                    onmessage: createMicMessageHandler(),
                    onerror: createErrorHandler('Mic'),
                    onclose: createCloseHandler('Mic'),
                },
                config: {
                    responseModalities: ['TEXT'], // Enable AI coaching responses
                    tools: enabledTools, // Full tools for coaching session
                    inputAudioTranscription: {
                        enableSpeakerDiarization: false, // Single speaker expected (user mic)
                        languageCode: language,
                    },
                    contextWindowCompression: { slidingWindow: {} },
                    speechConfig: { languageCode: language },
                    systemInstruction: {
                        parts: [{ text: micSystemPrompt }],
                    },
                },
            });

            geminiMicSessionRef.current = micSession;
            console.log('[Mic Session] Initialized successfully');

            // Store both sessions globally for IPC handlers
            global.geminiMicSessionRef = geminiMicSessionRef;
            global.geminiInterviewerSessionRef = geminiInterviewerSessionRef;

            console.log('[Dual Session] Both sessions initialized successfully');
            sendToRenderer('update-status', 'Dual session mode active');

        } catch (error) {
            console.error('[Dual Session] Failed to initialize sessions:', error);

            // Cleanup partial initialization
            if (geminiInterviewerSessionRef.current) {
                try {
                    await geminiInterviewerSessionRef.current.close();
                } catch (e) {
                    console.error('[Dual Session] Error closing interviewer session during cleanup:', e);
                }
                geminiInterviewerSessionRef.current = null;
            }

            if (geminiMicSessionRef.current) {
                try {
                    await geminiMicSessionRef.current.close();
                } catch (e) {
                    console.error('[Dual Session] Error closing mic session during cleanup:', e);
                }
                geminiMicSessionRef.current = null;
            }

            isInitializingSession = false;
            sendToRenderer('session-initializing', false);
            sendToRenderer('update-status', 'Error: Failed to initialize dual sessions');
            return null;
        }

        isInitializingSession = false;
        sendToRenderer('session-initializing', false);

        // Return mic session as the "primary" session for backward compatibility
        return geminiMicSessionRef.current;
    } catch (error) {
        console.error('Failed to initialize Gemini session:', error);
        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        return null;
    } finally {
        // SECURITY FIX: Clean up the initialization promise
        initializationPromise = null;
    }
    })();

    return await initializationPromise;
}

function killExistingSystemAudioDump() {
    return new Promise(resolve => {
        console.log('Checking for existing SystemAudioDump processes (architecture-aware)...');

        // Get current system architecture
        const { getSystemArchitecture } = require('./architectureDetection');
        const currentArch = getSystemArchitecture();
        
        console.log(`Current architecture: ${currentArch}`);

        // Kill any existing SystemAudioDump processes
        // The -f flag matches the full command line, so it will find processes
        // regardless of architecture (both x86_64 and arm64)
        const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
            stdio: 'ignore',
        });

        killProc.on('close', code => {
            if (code === 0) {
                console.log('Killed existing SystemAudioDump processes (all architectures)');
            } else {
                console.log('No existing SystemAudioDump processes found');
            }
            resolve();
        });

        killProc.on('error', err => {
            console.log('Error checking for existing processes (this is normal):', err.message);
            resolve();
        });

        // Timeout after 2 seconds
        setTimeout(() => {
            killProc.kill();
            resolve();
        }, 2000);
    });
}

async function startMacOSAudioCapture(geminiSessionRef) {
    if (process.platform !== 'darwin') {
        throw new Error('macOS audio capture only available on macOS');
    }

    // Kill any existing SystemAudioDump processes first
    await killExistingSystemAudioDump();

    console.log('Starting macOS audio capture with AudioCaptureManager...');

    // Create AudioCaptureManager instance if not already created
    if (!audioCaptureManager) {
        audioCaptureManager = new AudioCaptureManager({
            maxRetries: 3
        });
    }

    // Initialize the manager
    const initialized = await audioCaptureManager.initialize();
    
    if (!initialized) {
        console.warn('AudioCaptureManager initialization failed, will attempt fallback methods');
    }

    // Audio processing constants
    const CHUNK_DURATION = 0.1;
    const SAMPLE_RATE = 24000;
    const BYTES_PER_SAMPLE = 2;
    const CHANNELS = 2;
    const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

    let audioBuffer = Buffer.alloc(0);

    // Define audio data callback
    const onAudioData = (data) => {
        audioBuffer = Buffer.concat([audioBuffer, data]);

        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);

            const monoChunk = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;
            const base64Data = monoChunk.toString('base64');
            sendAudioToGemini(base64Data, geminiSessionRef);

            if (process.env.DEBUG_AUDIO) {
                console.log(`Processed audio chunk: ${chunk.length} bytes`);
                saveDebugAudio(monoChunk, 'system_audio');
            }
        }

        const maxBufferSize = SAMPLE_RATE * BYTES_PER_SAMPLE * 1;
        if (audioBuffer.length > maxBufferSize) {
            audioBuffer = audioBuffer.slice(-maxBufferSize);
        }
    };

    try {
        // Start audio capture with AudioCaptureManager
        await audioCaptureManager.start(geminiSessionRef, onAudioData);
        
        // Keep reference to systemAudioProc for backward compatibility
        systemAudioProc = audioCaptureManager.systemAudioProc;
        
        console.log('AudioCaptureManager: Audio capture started successfully');
        return true;
    } catch (error) {
        console.error('AudioCaptureManager: Failed to start audio capture:', error.message);
        
        // Get diagnostic information from AudioCaptureManager
        const { diagnoseSpawnError86 } = require('./errorDiagnostics');
        const binaryPath = audioCaptureManager._getBinaryPath();
        
        // Check if this is error -86
        const isError86 = error.code === 'ENOEXEC' || 
                          error.errno === -86 || 
                          (error.message && error.message.includes('-86'));
        
        let diagnosis;
        if (isError86) {
            // Get detailed diagnosis for error -86
            diagnosis = await diagnoseSpawnError86(error, binaryPath);
        } else {
            // Generic error diagnosis
            diagnosis = {
                cause: 'unknown',
                userMessage: error.message,
                technicalDetails: `Error code: ${error.code}, errno: ${error.errno}`,
                suggestedFix: 'Try restarting the application or check system logs for more details.',
                canRetry: true,
                fallbackAvailable: true
            };
        }
        
        // Send structured error data to renderer via IPC
        sendToRenderer('audio-capture-error', {
            title: 'Audio Capture Failed',
            message: diagnosis.userMessage,
            cause: diagnosis.cause,
            technicalDetails: diagnosis.technicalDetails,
            suggestedFix: diagnosis.suggestedFix,
            canRetry: diagnosis.canRetry,
            fallbackAvailable: diagnosis.fallbackAvailable
        });
        
        // Also update status for backward compatibility
        sendToRenderer('update-status', 'Error: Audio capture failed');
        
        throw new Error(diagnosis.userMessage);
    }
}

function convertStereoToMono(stereoBuffer) {
    const samples = stereoBuffer.length / 4;
    const monoBuffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const leftSample = stereoBuffer.readInt16LE(i * 4);
        monoBuffer.writeInt16LE(leftSample, i * 2);
    }

    return monoBuffer;
}

function stopMacOSAudioCapture() {
    console.log('Stopping macOS audio capture...');
    
    // Use AudioCaptureManager.stop() if available
    if (audioCaptureManager) {
        audioCaptureManager.stop();
        systemAudioProc = null;
    } else if (systemAudioProc) {
        // Fallback to direct process.kill() for backward compatibility
        console.log('Stopping SystemAudioDump directly (no AudioCaptureManager)...');
        systemAudioProc.kill('SIGTERM');
        systemAudioProc = null;
    }
}

async function sendAudioToGemini(base64Data, geminiSessionRef) {
    if (!geminiSessionRef.current) return;

    try {
        // Generate correlation ID and track this audio chunk
        const correlationId = generateCorrelationId();
        trackAudioChunk(correlationId, 'system', Date.now());

        // Add to FIFO queue for speaker matching
        audioChunkQueue.push({ source: 'system', timestamp: Date.now(), correlationId });

        // Limit queue size to prevent memory leaks
        if (audioChunkQueue.length > MAX_QUEUE_SIZE) {
            audioChunkQueue.shift(); // Remove oldest
        }

        // Queue overflow detection
        if (audioChunkQueue.length > 100) {
            const { sessionLogger } = require('./sessionLogger');
            sessionLogger.log('AudioCorrelation', `Warning: Queue size ${audioChunkQueue.length} exceeds 100 - possible correlation drift`);
        }

        process.stdout.write('.');
        await geminiSessionRef.current.sendRealtimeInput({
            audio: {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            },
        });
    } catch (error) {
        console.error('Error sending audio to Gemini:', error);
    }
}

// SECURITY FIX: Helper function to clear sensitive data from memory
function clearSensitiveData() {
    console.log('Clearing sensitive data from memory...');
    if (lastSessionParams && lastSessionParams.apiKey) {
        // Overwrite API key in memory
        lastSessionParams.apiKey = null;
    }
    lastSessionParams = null;
    currentTranscription = '';
    messageBuffer = '';
    isGenerationComplete = true; // Reset generation tracking flag
    speakerContextBuffer = '';

    // Clear correlation data and queue
    clearCorrelationData();
    audioChunkQueue.length = 0;
    previousSpeaker = null;

    // Clear document cache
    clearDocumentCache();
}

function setupGeminiIpcHandlers(geminiSessionRef) {
    // Store the geminiSessionRef globally for reconnection access
    global.geminiSessionRef = geminiSessionRef;

    ipcMain.handle('initialize-gemini', async (event, apiKey, customPrompt, profile = 'interview', language = 'en-US') => {
        const session = await initializeGeminiSession(apiKey, customPrompt, profile, language);
        if (session) {
            geminiSessionRef.current = session;
            return true;
        }
        return false;
    });

    ipcMain.handle('send-audio-content', async (event, { data, mimeType }) => {
        if (!geminiInterviewerSessionRef.current) return { success: false, error: 'No active interviewer session' };

        // SECURITY FIX: Validate audio data
        if (!data || typeof data !== 'string') {
            return { success: false, error: 'Invalid audio data: must be a base64 string' };
        }

        // SECURITY FIX: Limit audio chunk size (10MB base64 max)
        if (data.length > 10 * 1024 * 1024) {
            return { success: false, error: 'Audio chunk too large' };
        }

        // SECURITY FIX: Validate mimeType
        const validMimeTypes = ['audio/pcm;rate=24000', 'audio/webm', 'audio/wav'];
        if (!mimeType || !validMimeTypes.some(valid => mimeType.startsWith(valid))) {
            return { success: false, error: 'Invalid audio mimeType' };
        }

        try {
            // Generate correlation ID and track this audio chunk
            const correlationId = generateCorrelationId();
            // Send to interviewer session (transcription-only)
            process.stdout.write('.');
            await geminiInterviewerSessionRef.current.sendRealtimeInput({
                audio: { data: data, mimeType: mimeType },
            });
            return { success: true };
        } catch (error) {
            console.error('Error sending system audio:', error);
            return { success: false, error: error.message };
        }
    });

    // Handle microphone audio on a separate channel
    ipcMain.handle('send-mic-audio-content', async (event, { data, mimeType }) => {
        if (!geminiMicSessionRef.current) return { success: false, error: 'No active mic session' };

        // SECURITY FIX: Validate audio data
        if (!data || typeof data !== 'string') {
            return { success: false, error: 'Invalid audio data: must be a base64 string' };
        }

        // SECURITY FIX: Limit audio chunk size (10MB base64 max)
        if (data.length > 10 * 1024 * 1024) {
            return { success: false, error: 'Audio chunk too large' };
        }

        // SECURITY FIX: Validate mimeType
        const validMimeTypes = ['audio/pcm;rate=24000', 'audio/webm', 'audio/wav'];
        if (!mimeType || !validMimeTypes.some(valid => mimeType.startsWith(valid))) {
            return { success: false, error: 'Invalid audio mimeType' };
        }

        try {
            // Generate correlation ID and track this audio chunk
            const correlationId = generateCorrelationId();
            // Send to mic session (coaching + transcription)
            process.stdout.write(',');
            await geminiMicSessionRef.current.sendRealtimeInput({
                audio: { data: data, mimeType: mimeType },
            });
            return { success: true };
        } catch (error) {
            console.error('Error sending mic audio:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-image-content', async (event, { data, debug }) => {
        if (!geminiMicSessionRef.current) return { success: false, error: 'No active mic session' };

        try {
            if (!data || typeof data !== 'string') {
                console.error('Invalid image data received');
                return { success: false, error: 'Invalid image data' };
            }

            // SECURITY FIX: Limit image size (20MB base64 max)
            if (data.length > 20 * 1024 * 1024) {
                console.error('Image data too large');
                return { success: false, error: 'Image data too large (max 20MB)' };
            }

            const buffer = Buffer.from(data, 'base64');

            if (buffer.length < 1000) {
                console.error(`Image buffer too small: ${buffer.length} bytes`);
                return { success: false, error: 'Image buffer too small' };
            }

            // SECURITY FIX: Additional size check after decoding
            if (buffer.length > 25 * 1024 * 1024) {
                console.error('Decoded image buffer too large');
                return { success: false, error: 'Decoded image too large' };
            }

            process.stdout.write('!');
            await geminiMicSessionRef.current.sendRealtimeInput({
                media: { data: data, mimeType: 'image/jpeg' },
            });

            return { success: true };
        } catch (error) {
            console.error('Error sending image:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-text-message', async (event, text) => {
        if (!geminiMicSessionRef.current) return { success: false, error: 'No active mic session' };

        try {
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                return { success: false, error: 'Invalid text message' };
            }

            // SECURITY FIX: Limit text message length
            if (text.length > 10000) {
                console.warn('Text message too long, truncating');
                text = text.substring(0, 10000);
            }

            console.log('Sending text message:', text);
            await geminiMicSessionRef.current.sendRealtimeInput({ text: text.trim() });
            return { success: true };
        } catch (error) {
            console.error('Error sending text:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-macos-audio', async event => {
        if (process.platform !== 'darwin') {
            return {
                success: false,
                error: 'macOS audio capture only available on macOS',
            };
        }

        try {
            const success = await startMacOSAudioCapture(geminiSessionRef);
            return { success };
        } catch (error) {
            console.error('Error starting macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async event => {
        try {
            stopMacOSAudioCapture();
            return { success: true };
        } catch (error) {
            console.error('Error stopping macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async event => {
        try {
            stopMacOSAudioCapture();

            // SECURITY FIX: Clear sensitive data from memory
            clearSensitiveData();

            // Cleanup any pending resources and stop audio/video capture
            if (geminiSessionRef.current) {
                await geminiSessionRef.current.close();
                geminiSessionRef.current = null;
            }

            return { success: true };
        } catch (error) {
            console.error('Error closing session:', error);
            return { success: false, error: error.message };
        }
    });

    // Conversation history IPC handlers
    ipcMain.handle('get-current-session', async event => {
        try {
            return { success: true, data: getCurrentSessionData() };
        } catch (error) {
            console.error('Error getting current session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-new-session', async event => {
        try {
            initializeNewSession();
            return { success: true, sessionId: currentSessionId };
        } catch (error) {
            console.error('Error starting new session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-google-search-setting', async (event, enabled) => {
        try {
            console.log('Google Search setting updated to:', enabled);
            // The setting is already saved in localStorage by the renderer
            // This is just for logging/confirmation
            return { success: true };
        } catch (error) {
            console.error('Error updating Google Search setting:', error);
            return { success: false, error: error.message };
        }
    });
}


/**
 * Detects if AI should be interrupted
 * Interruption occurs when: new user speech arrives AND AI is generating
 * Called from bufferTranscript() when speaker="You"
 * @returns {boolean} - True if AI response should be interrupted
 */
function shouldInterruptAI() {
    return messageBuffer.length > 0 && !isGenerationComplete;
}

/**
 * Marks response as interrupted when user speaks
 */
function interruptAIResponse() {
    const { sessionLogger } = require('./sessionLogger');

    if (shouldInterruptAI()) {
        isResponseInterrupted = true;
        sessionLogger.log('AIResponse', `Interrupted (${messageBuffer.length} chars buffered)`);
        messageBuffer = '';  // Clear buffer
        isGenerationComplete = true;  // Mark as complete (though interrupted)
    }
}

/**
 * Handles incoming AI response chunks
 * @param {object} serverContent - Response from Gemini
 */
function handleAIResponse(serverContent) {
    const { sessionLogger } = require('./sessionLogger');

    try {
        // Check if this is a new response start
        if (!messageBuffer && serverContent.modelTurn) {
            // Clear previous response
            messageBuffer = '';
            isGenerationComplete = false;
            isResponseInterrupted = false;
            sessionLogger.log('AIResponse', 'New response started');
        }

        // Accumulate response text
        if (serverContent.text) {
            messageBuffer += serverContent.text;
        }

        // Check if response is complete
        if (serverContent.turnComplete) {
            isGenerationComplete = true;

            // Parse practice tags
            const parsed = parsePracticeTags(messageBuffer);

            // Log completion
            sessionLogger.log('AIResponse', `Complete (${messageBuffer.length} chars, suggestion: ${!!parsed.suggestion}, feedback: ${!!parsed.feedback})`);

            // Return parsed content
            return parsed;
        }

        return null;  // Response still in progress
    } catch (error) {
        console.error('[AI Response] Error:', error);
        sessionLogger.log('AIResponse', `Error: ${error.message}`);

        // Malformed response - skip and continue
        messageBuffer = '';
        isGenerationComplete = true;
        return null;
    }
}

/**
 * Sanitizes potentially corrupted text
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeText(text) {
    try {
        // Remove null bytes
        let sanitized = text.replace(/\0/g, '');

        // Remove other control characters except newlines/tabs
        sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

        // Ensure valid UTF-8 (basic check)
        return sanitized.trim();
    } catch (error) {
        console.error('[Sanitize] Error:', error);
        return '';  // Return empty string on failure
    }
}

/**
 * Validates transcript fragment
 * @param {object} fragment - Transcript fragment from Gemini
 * @returns {boolean} - True if valid
 */
function validateTranscriptFragment(fragment) {
    try {
        if (!fragment) return false;
        if (typeof fragment.text !== 'string') return false;
        if (fragment.text.trim().length === 0) return false;
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Parses practice mode tags from AI response
 * Format: <suggestion>text</suggestion> and <feedback>text</feedback>
 * @param {string} text - AI response text
 * @returns {object} - { suggestion: string|null, feedback: string|null, raw: string }
 */
function parsePracticeTags(text) {
    const suggestionMatch = text.match(/<suggestion>(.*?)<\/suggestion>/s);
    const feedbackMatch = text.match(/<feedback>(.*?)<\/feedback>/s);
    return {
        suggestion: suggestionMatch ? suggestionMatch[1].trim() : null,
        feedback: feedbackMatch ? feedbackMatch[1].trim() : null,
        raw: text.replace(/<\/?(?:suggestion|feedback)>/g, '').trim()
    };
}

// ============================================================================
// TASK 12: CONVERSATION STATE MACHINE INTEGRATION
// ============================================================================

/**
 * Gets current conversation state
 * @returns {string} - Current state (IDLE/SUGGESTING/MONITORING/EVALUATING)
 */
function getCurrentConversationState() {
    try {
        return conversationState.getState() || 'IDLE';
    } catch (error) {
        console.error('[ConversationState] Error getting state:', error);
        return 'IDLE';  // Safe default
    }
}

/**
 * Tracks suggestion from AI
 * @param {string} suggestionText - The suggestion text
 * @param {number} turnId - Turn identifier
 */
function trackSuggestion(suggestionText, turnId) {
    try {
        conversationState.trackSuggestion(suggestionText, turnId);
        const { sessionLogger } = require('./sessionLogger');
        sessionLogger.log('ConversationState', `Tracking suggestion for turn ${turnId}`);
    } catch (error) {
        console.error('[ConversationState] Error tracking suggestion:', error);
    }
}

/**
 * Compares user response to last suggestion
 * @param {string} userText - User's spoken text
 * @returns {object} - Adherence comparison result
 */
function compareUserResponse(userText) {
    try {
        return conversationState.compareResponse(userText);
    } catch (error) {
        console.error('[ConversationState] Error comparing response:', error);
        return { adherence: 0, hasSuggestion: false };
    }
}

// ============================================================================
// TASK 13: AUDIO CORRELATION INTEGRATION
// ============================================================================

/**
 * Cleans up expired audio correlation entries
 * Called every 10 seconds via interval timer
 * Prevents queue buildup from stale entries
 */
function cleanupExpiredCorrelations() {
    // Use the centralized stale chunk removal function
    removeStaleChunks();
}

// ============================================================================
// TASK 14: RAG INTEGRATION
// ============================================================================

/**
 * Query RAG system using intent-based classification
 * @param {string} question - The question text
 * @param {string} sessionId - Current session ID
 * @param {Array} conversationHistory - Recent conversation turns (optional)
 * @returns {Promise<object>} - RAG result or skip indicator
 */
async function queryRAGIfNeeded(question, sessionId, conversationHistory = []) {
    // Classify query intent using pattern matching and semantic signals
    const signals = {
        // Time-sensitive queries need fresh retrieval
        needsFreshInfo: /latest|current|today|now|recent|2024|2025/i.test(question),
        
        // Factual patterns benefit from retrieval
        isFactual: /what is|who is|when did|how many|define|explain|describe/i.test(question),
        
        // Creative/opinion queries skip retrieval
        isCreative: /write|create|imagine|opinion|think about|feel about/i.test(question),
        
        // Named entities suggest factual grounding needed
        hasEntities: /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/.test(question)
    };
    
    // Skip retrieval for creative queries
    if (signals.isCreative && !signals.needsFreshInfo) {
        console.log('[RAG] Skipping RAG - creative/opinion query');
        return {
            usedRAG: false,
            skipped: true,
            reason: 'creative_query',
            strategy: 'direct'
        };
    }
    
    // Retrieve for factual, time-sensitive, or entity-rich queries
    if (signals.needsFreshInfo || signals.isFactual || signals.hasEntities) {
        try {
            // Call retrieveContext with current implementation options
            // Note: minResults, formatAsXML, and lowConfidence will be added in tasks 7-8
            const result = await retrieveContext(question, sessionId, {
                topK: 5,
                minScore: 0.70, // Calibrated for all-MiniLM-L6-v2 (will be used in task 8)
                maxTokens: 500, // Current implementation limit
                includeMetadata: true
            });
            
            // Check if retrieval was successful
            if (result.usedRAG) {
                console.log(`[RAG] Retrieved ${result.chunks?.length || 0} chunks (avg score: ${result.avgScore?.toFixed(2) || 'N/A'})`);
                return result;
            } else if (result.fallback) {
                console.log(`[RAG] Fallback mode: ${result.reason}`);
                return {
                    usedRAG: false,
                    fallback: true,
                    reason: result.reason || 'retrieval_failed',
                    strategy: 'context-only'
                };
            }
            
            return result;
        } catch (error) {
            console.error('[RAG] Error retrieving context:', error);
            return {
                usedRAG: false,
                fallback: true,
                reason: 'error',
                error: error.message
            };
        }
    }
    
    // Default: skip retrieval for ambiguous cases
    console.log('[RAG] Skipping RAG - query does not match retrieval criteria');
    return {
        usedRAG: false,
        skipped: true,
        reason: 'no_retrieval_needed',
        strategy: 'context-only'
    };
}

/**
 * Sends context with optional RAG enhancement
 * @param {string} mainContext - Main context to send
 * @param {string} trigger - Trigger reason
 * @param {object} ragResult - Optional RAG result
 */
async function sendContextWithRAG(mainContext, trigger, ragResult = null) {
    // Send main context first (blocking)
    await sendContextToAI(mainContext, trigger);

    // Send RAG context immediately after (non-blocking)
    if (ragResult && ragResult.usedRAG && ragResult.context) {
        const ragMessage = `<relevantHistory>${ragResult.context}</relevantHistory>`;
        sendContextToAI(ragMessage, 'rag')
            .catch(err => {
                console.error('[RAG] Non-critical failure:', err);
                const { sessionLogger } = require('./sessionLogger');
                sessionLogger.log('RAG', `Failed to send RAG context: ${err.message}`);
            });
    }
}

// ============================================================================
// TASK 15: MAIN TRANSCRIPT FLOW INTEGRATION
// ============================================================================

/**
 * Main transcript buffering handler
 * Integrates all components: buffering, normalization, speaker attribution, context injection
 * @param {object} transcriptFragment - Raw fragment from Gemini
 */
async function processTranscriptFragment(transcriptFragment) {
    const { sessionLogger } = require('./sessionLogger');

    try {
        // 1. Validate fragment
        if (!validateTranscriptFragment(transcriptFragment)) {
            sessionLogger.logBufferRejection('invalid fragment', 0);
            return;
        }

        // 2. Sanitize text
        const sanitizedText = sanitizeText(transcriptFragment.text);

        // 3. Normalize text
        const normalizedText = normalizeText(sanitizedText);

        // 4. Get speaker from audio correlation
        const speaker = determineSpeakerFromCorrelation();

        // 4a. Validate speaker attribution
        const validation = validateSpeakerAttribution(speaker, normalizedText);
        if (process.env.DEBUG_SPEAKER_ATTRIBUTION && validation.warnings.length > 0) {
            const { sessionLogger } = require('./sessionLogger');
            const warningMsg = '[Validation Warnings in processTranscriptFragment] ' + validation.warnings.join(', ');
            console.warn(warningMsg);
            sessionLogger.log('ValidationWarning', warningMsg);
        }

        // 5. Check for interruption (if user speaking while AI generating)
        if (speaker === 'You' && shouldInterruptAI()) {
            interruptAIResponse();
        }

        // 6. Handle speaker change
        const speakerAction = handleSpeakerChange(userSpeechBuffer, previousSpeaker, speaker);

        if (speakerAction.shouldFlush) {
            // Flush previous speaker's buffer
            flushBufferToUI(userSpeechBuffer, previousSpeaker);
            userSpeechBuffer = '';
        } else if (speakerAction.shouldDiscard) {
            // Discard invalid buffer
            sessionLogger.logBufferRejection('speaker change with < 5 words', countWords(userSpeechBuffer));
            userSpeechBuffer = '';
        }

        // 7. Update current speaker
        previousSpeaker = speaker;

        // 8. Add to buffer
        userSpeechBuffer += normalizedText + ' ';
        lastUserSpeechTime = Date.now();

        // 9. Check if should flush buffer
        const currentState = getCurrentConversationState();
        if (shouldFlushBuffer(userSpeechBuffer, lastUserSpeechTime, currentState)) {
            flushBufferToUI(userSpeechBuffer, speaker);
            userSpeechBuffer = '';
        }

        // 10. Add to context buffer
        speakerContextBuffer += `[${speaker}]: ${normalizedText} `;

        // 11. Update turn history
        turnHistory.push({ speaker, text: normalizedText, timestamp: Date.now() });
        if (turnHistory.length > CONTEXT_TURN_HISTORY) {
            turnHistory.shift();  // Remove oldest
        }

        // 12. Schedule context injection on speaker change
        if (speakerAction.shouldFlush || speakerAction.shouldDiscard) {
            scheduleContextInjection('speaker_turn');
        }

    } catch (error) {
        console.error('[Transcript Processing] Error:', error);
        sessionLogger.log('TranscriptProcessing', `Error: ${error.message}`);
    }
}

/**
 * Helper: Flush buffer to UI
 * @param {string} buffer - Buffer to flush
 * @param {string} speaker - Speaker label
 */
function flushBufferToUI(buffer, speaker) {
    const { sessionLogger } = require('./sessionLogger');
    const wordCount = countWords(buffer);

    // Format with speaker label
    const formattedTranscript = `[${speaker}]: ${buffer.trim()}`;

    // Send to renderer
    sendToRenderer('transcript', formattedTranscript);

    // Log
    sessionLogger.log('TranscriptBuffer', `Flushed ${wordCount} words for ${speaker}: ${buffer.substring(0, 50)}...`);
}

// Set up audio correlation cleanup (every 10 seconds)
let correlationCleanupInterval = null;

/**
 * Start the audio correlation cleanup interval
 */
function startCorrelationCleanup() {
    if (!correlationCleanupInterval) {
        correlationCleanupInterval = setInterval(cleanupExpiredCorrelations, 5000); // Run every 5s (increased from 10s)
        console.log('[Audio Correlation] Cleanup interval started (every 5s)');
    }
}

/**
 * Stop the audio correlation cleanup interval
 */
function stopCorrelationCleanup() {
    if (correlationCleanupInterval) {
        clearInterval(correlationCleanupInterval);
        correlationCleanupInterval = null;
        console.log('[Audio Correlation] Cleanup interval stopped');
    }
}

// Start cleanup on module load
startCorrelationCleanup();

module.exports = {
    initializeGeminiSession,
    getEnabledTools,
    getStoredSetting,
    sendToRenderer,
    initializeNewSession,
    saveConversationTurn,
    getCurrentSessionData,
    sendReconnectionContext,
    killExistingSystemAudioDump,
    startMacOSAudioCapture,
    convertStereoToMono,
    stopMacOSAudioCapture,
    sendAudioToGemini,
    setupGeminiIpcHandlers,
    attemptReconnection,
    formatSpeakerResults,
    getAdaptiveTimeout,
    parsePracticeTags,
    normalizeText,
    countWords,
    shouldFlushBuffer,
    handleSpeakerChange,
    cancelDebounce,
    scheduleContextInjection,
    buildContextMessage,
    sendContextToAI,
    shouldInterruptAI,
    interruptAIResponse,
    handleAIResponse,
    sanitizeText,
    validateTranscriptFragment,
    // Task 12: Conversation State Integration
    getCurrentConversationState,
    trackSuggestion,
    compareUserResponse,
    // Task 13: Audio Correlation Integration
    cleanupExpiredCorrelations,
    startCorrelationCleanup,
    stopCorrelationCleanup,
    // Task 14: RAG Integration
    queryRAGIfNeeded,
    sendContextWithRAG,
    // Task 15: Main Transcript Flow
    processTranscriptFragment,
    flushBufferToUI,
    // Speaker Attribution Enhancements (for testing)
    removeStaleChunks,
    determineSpeakerFromCorrelation,
    calculateCorrelationConfidence,
    validateSpeakerAttribution,
    // Test utilities to access internal state
    _getAudioChunkQueue: () => audioChunkQueue,
    _getLastSpeakers: () => lastSpeakers,
    _getQueueSizeHistory: () => queueSizeHistory,
    _getValidationMetrics: () => validationMetrics,
    _resetTestState: () => {
        audioChunkQueue.length = 0;
        lastSpeakers.length = 0;
        queueSizeHistory.length = 0;
        validationMetrics.totalAttributions = 0;
        validationMetrics.lowConfidenceCount = 0;
        validationMetrics.warningsByType = {};
        validationMetrics.averageConfidence = 0;
        validationMetrics.confidenceSum = 0;
    },
};
