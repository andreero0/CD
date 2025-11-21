const { GoogleGenAI } = require('@google/genai');
const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');
const { processNewTurn, initializeRAG, retrieveContext } = require('./ragController');
const { conversationState, STATES } = require('./conversationState');
const { formatAllDocuments, clearDocumentCache } = require('./documentRetriever');
const { generateCorrelationId, trackAudioChunk, resolveCorrelationId, clearAll: clearCorrelationData } = require('./audioCorrelation');

// Conversation tracking variables
let currentSessionId = null;
let currentTranscription = '';
let conversationHistory = [];
let isInitializingSession = false;

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

// CORRELATION-BASED SPEAKER TRACKING SYSTEM
// Queue to track audio chunks in order for correlation-based speaker attribution
const audioChunkQueue = [];
const MAX_QUEUE_SIZE = 50; // Keep last 50 chunks (prevents memory leak)

// Event-driven context injection tracking
let previousSpeaker = null; // Track previous speaker for turn detection
let speakerContextBuffer = '';
const CONTEXT_SEND_FALLBACK_TIMEOUT = 3000; // 3s fallback if no speaker change
let lastContextSentTime = Date.now();

// TRANSCRIPT BUFFERING: Prevent word-by-word fragmentation
let userSpeechBuffer = ''; // Buffer to accumulate user speech
let lastUserSpeechTime = Date.now(); // Track when last user speech arrived
const USER_SPEECH_TIMEOUT = 2000; // 2 seconds of silence = sentence complete

function setCurrentProfile(profile) {
    currentProfile = profile || 'interview';
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
 * Determines speaker from audio correlation queue
 * Uses FIFO matching: first transcription matches first unresolved audio chunk
 */
function determineSpeakerFromCorrelation() {
    // Try to match with oldest untracked chunk in queue
    if (audioChunkQueue.length > 0) {
        const oldestChunk = audioChunkQueue.shift(); // Remove and return oldest
        const speaker = oldestChunk.source === 'system' ? 'Interviewer' : 'You';

        if (process.env.DEBUG_CORRELATION) {
            console.log(`[Speaker Attribution] Matched transcription to ${oldestChunk.source} audio (queue remaining: ${audioChunkQueue.length})`);
        }

        return speaker;
    }

    // Fallback: if queue is empty, default to 'You' (mic)
    if (process.env.DEBUG_CORRELATION) {
        console.log('[Speaker Attribution] Queue empty, defaulting to "You"');
    }
    return 'You';
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
let messageBuffer = '';
let isGenerationComplete = true; // Track if previous AI response is complete

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
    }

        const session = await client.live.connect({
            model: 'gemini-live-2.5-flash-preview',
            callbacks: {
                onopen: function () {
                    sendToRenderer('update-status', 'Live session connected');
                },
                onmessage: function (message) {
                    console.log('----------------', message);

                    // Handle transcription updates (support both .results and .text formats)
                    if (message.serverContent?.inputTranscription) {
                        let newTranscript = '';

                        // Format 1: Speaker diarization results (structured format)
                        if (message.serverContent.inputTranscription.results) {
                            newTranscript = formatSpeakerResults(message.serverContent.inputTranscription.results);
                        }
                        // Format 2: Simple text transcription (newer API format)
                        else if (message.serverContent.inputTranscription.text) {
                            newTranscript = message.serverContent.inputTranscription.text;
                        }

                        if (newTranscript && newTranscript.trim()) {
                            // CORRELATION-BASED SPEAKER ATTRIBUTION
                            // Match transcription to audio chunk using FIFO queue
                            const speaker = determineSpeakerFromCorrelation();

                            // COACHING FEEDBACK LOOP: When user speaks, compare against suggestion
                            if (speaker === 'You') {
                                const comparison = conversationState.compareResponse(newTranscript);
                                if (comparison && comparison.hasSuggestion) {
                                    console.log(`[Coaching] User adherence to suggestion: ${comparison.adherence}% - ${comparison.analysis}`);
                                }
                            }

                            // Accumulate transcript WITH speaker labels for AI context
                            // Format: "[Interviewer]: question [You]: answer"
                            const formattedChunk = `[${speaker}]: ${newTranscript} `;
                            currentTranscription += formattedChunk;
                            speakerContextBuffer += formattedChunk;

                            // EVENT-DRIVEN CONTEXT INJECTION
                            // Send context on speaker turn boundaries (primary) or 3s timeout (fallback)
                            const now = Date.now();
                            const timeSinceLastContext = now - lastContextSentTime;
                            const speakerChanged = previousSpeaker !== null && previousSpeaker !== speaker;
                            const timeoutReached = timeSinceLastContext >= CONTEXT_SEND_FALLBACK_TIMEOUT;
                            const shouldSendContext = speakerChanged || timeoutReached;

                            if (shouldSendContext && speakerContextBuffer.trim()) {
                                const triggerReason = speakerChanged ? 'speaker_turn' : 'timeout_fallback';
                                console.log(`[Context Injection] Sending (trigger: ${triggerReason})`);
                                // Build context message with suggestion tracking
                                let contextMessage = `<context>\n${speakerContextBuffer.trim()}\n</context>`;

                                // COACHING FEEDBACK LOOP: Add last suggestion to context so AI remembers what it suggested
                                const currentSuggestion = conversationState.getCurrentSuggestion();
                                if (currentSuggestion) {
                                    contextMessage += `\n<lastSuggestion>\nYou suggested: "${currentSuggestion.text}"\nTurn ID: ${currentSuggestion.turnId}\nTime: ${new Date(currentSuggestion.timestamp).toISOString()}\n</lastSuggestion>`;
                                }

                                // RAG INTEGRATION: When interviewer asks a question, retrieve relevant past context
                                // Note: We'll send RAG context separately after retrieval to avoid blocking
                                if (speaker === 'Interviewer' && newTranscript && newTranscript.trim().length > 10) {
                                    (async () => {
                                        try {
                                            console.log('[RAG] Retrieving context for interviewer question...');
                                            const ragResult = await retrieveContext(newTranscript, currentSessionId, {
                                                topK: 3,              // Get top 3 most relevant chunks
                                                minScore: 0.6,        // Minimum similarity threshold
                                                maxTokens: 400,       // Max tokens for RAG context
                                                includeMetadata: true,
                                            });

                                            if (ragResult.usedRAG && ragResult.context) {
                                                // Send RAG context as a separate message
                                                const ragContextMessage = `<relevantHistory>\n${ragResult.context}\n</relevantHistory>`;
                                                console.log(`[RAG] Sending ${ragResult.chunks?.length || 0} relevant chunks (avg similarity: ${ragResult.avgScore?.toFixed(2)})`);

                                                try {
                                                    const promise = geminiSessionRef.current?.sendRealtimeInput({
                                                        text: ragContextMessage
                                                    });

                                                    if (promise && typeof promise.catch === 'function') {
                                                        promise.catch(err => {
                                                            console.error('[RAG] Failed to send RAG context:', err);
                                                        });
                                                    }
                                                } catch (err) {
                                                    console.error('[RAG] Error sending RAG context:', err);
                                                }
                                            } else if (ragResult.fallback) {
                                                console.log(`[RAG] Fallback mode: ${ragResult.reason}`);
                                            }
                                        } catch (error) {
                                            console.error('[RAG] Error retrieving context:', error);
                                            // Continue without RAG context
                                        }
                                    })();
                                }

                                // Send accumulated context to AI with defensive promise handling
                                try {
                                    if (geminiSessionRef.current && typeof geminiSessionRef.current.sendRealtimeInput === 'function') {
                                        const promise = geminiSessionRef.current.sendRealtimeInput({
                                            text: contextMessage
                                        });

                                        if (promise && typeof promise.catch === 'function') {
                                            promise.catch(err => {
                                                console.error('[Context Injection] Failed to send speaker context:', err);
                                            });
                                        }
                                        // Session is ready but sendRealtimeInput returned undefined - this is OK during certain states
                                    }
                                    // Silently skip if session not ready - this is normal during initialization/processing
                                } catch (err) {
                                    console.error('[Context Injection] Error calling sendRealtimeInput:', err);
                                }

                                // Reset buffer and timer
                                speakerContextBuffer = '';
                                lastContextSentTime = now;
                                console.log('[Context Injection] Sent to AI with suggestion tracking (trigger: ' + triggerReason + ')');
                            }

                            // SMART TRANSCRIPT BUFFERING: Prevent word-by-word fragmentation
                            // Strategy: Buffer ALL speech regardless of speaker, send only on punctuation or timeout
                            // Ignore speaker changes since Gemini's word-level attribution is unreliable

                            // Check timeout BEFORE updating timestamp
                            const now = Date.now();
                            const timeSinceLastSpeech = now - lastUserSpeechTime;
                            const timeoutReached = timeSinceLastSpeech > USER_SPEECH_TIMEOUT;

                            // Accumulate ALL speech fragments (both user and interviewer)
                            userSpeechBuffer += newTranscript + ' ';
                            lastUserSpeechTime = now;

                            // Check if we should send the buffered speech
                            const trimmedBuffer = userSpeechBuffer.trim();
                            const hasSentenceEnding = /[.!?]$/.test(trimmedBuffer);

                            // Send ONLY on: sentence ending OR timeout (ignore unreliable speaker changes)
                            if (hasSentenceEnding || timeoutReached) {
                                const reason = hasSentenceEnding ? 'sentence complete' : 'timeout';
                                console.log(`[Transcript Buffer] Sending buffered speech (${reason}, ${trimmedBuffer.split(' ').length} words): "${trimmedBuffer.substring(0, 50)}..."`);
                                sendToRenderer('transcript-update', { text: trimmedBuffer, speaker: speaker });
                                userSpeechBuffer = ''; // Clear buffer after sending
                            } else {
                                // Still buffering - log progress every 5 words
                                const wordCount = trimmedBuffer.split(' ').length;
                                if (wordCount % 5 === 0) {
                                    console.log(`[Transcript Buffer] Buffering... (${wordCount} words, ${(USER_SPEECH_TIMEOUT - timeSinceLastSpeech) / 1000}s until timeout)`);
                                }
                            }

                            // Update previous speaker for context tracking
                            previousSpeaker = speaker;
                        }
                    }

                    // Handle AI model response
                    if (message.serverContent?.modelTurn?.parts) {
                        // DEFENSIVE: Clear buffer if this is a new turn (previous generation was complete)
                        if (isGenerationComplete) {
                            console.log('[AI Response] Starting new response, clearing messageBuffer');
                            messageBuffer = '';
                            isGenerationComplete = false;
                        }

                        for (const part of message.serverContent.modelTurn.parts) {
                            console.log(part);
                            if (part.text) {
                                messageBuffer += part.text;
                                sendToRenderer('update-response', messageBuffer);
                            }
                        }
                    }

                    // Handle response interruption (user interrupted or API cut off)
                    if (message.serverContent?.interrupted) {
                        console.log('[AI Response] Response interrupted, clearing messageBuffer');
                        messageBuffer = '';
                        isGenerationComplete = true;
                    }

                    if (message.serverContent?.generationComplete) {
                        console.log('[AI Response] Generation complete, final messageBuffer:', messageBuffer.substring(0, 50) + '...');
                        sendToRenderer('update-response', messageBuffer);

                        // COACHING FEEDBACK LOOP: Track AI suggestion when generation is complete
                        if (messageBuffer && messageBuffer.trim().length > 0) {
                            conversationState.trackSuggestion(messageBuffer.trim(), 'AI Coach');
                        }

                        // Save conversation turn when we have both transcription and AI response
                        if (currentTranscription && messageBuffer) {
                            saveConversationTurn(currentTranscription, messageBuffer);
                            currentTranscription = ''; // Reset for next turn
                        }

                        // DEFENSIVE: Clear buffer and mark as complete
                        messageBuffer = '';
                        isGenerationComplete = true; // Mark generation as complete
                        console.log('[AI Response] messageBuffer cleared, ready for next response');
                    }

                    if (message.serverContent?.turnComplete) {
                        sendToRenderer('update-status', 'Listening...');
                    }
                },
                onerror: function (e) {
                    console.debug('Error:', e.message);

                    // Check if the error is related to invalid API key
                    const isApiKeyError =
                        e.message &&
                        (e.message.includes('API key not valid') ||
                            e.message.includes('invalid API key') ||
                            e.message.includes('authentication failed') ||
                            e.message.includes('unauthorized'));

                    if (isApiKeyError) {
                        console.log('Error due to invalid API key - stopping reconnection attempts');
                        lastSessionParams = null; // Clear session params to prevent reconnection
                        reconnectionAttempts = maxReconnectionAttempts; // Stop further attempts
                        sendToRenderer('update-status', 'Error: Invalid API key');
                        return;
                    }

                    sendToRenderer('update-status', 'Error: ' + e.message);
                },
                onclose: function (e) {
                    console.debug('Session closed:', e.reason);

                    // Check if the session closed due to invalid API key
                    const isApiKeyError =
                        e.reason &&
                        (e.reason.includes('API key not valid') ||
                            e.reason.includes('invalid API key') ||
                            e.reason.includes('authentication failed') ||
                            e.reason.includes('unauthorized'));

                    if (isApiKeyError) {
                        console.log('Session closed due to invalid API key - stopping reconnection attempts');
                        lastSessionParams = null; // Clear session params to prevent reconnection
                        reconnectionAttempts = maxReconnectionAttempts; // Stop further attempts
                        sendToRenderer('update-status', 'Session closed: Invalid API key');
                        return;
                    }

                    // Attempt automatic reconnection for server-side closures
                    if (lastSessionParams && reconnectionAttempts < maxReconnectionAttempts) {
                        console.log('Attempting automatic reconnection...');
                        attemptReconnection();
                    } else {
                        sendToRenderer('update-status', 'Session closed');
                    }
                },
            },
            config: {
                responseModalities: ['TEXT'],
                tools: enabledTools,
                // Enable speaker diarization
                inputAudioTranscription: {
                    enableSpeakerDiarization: true,
                    minSpeakerCount: 2,
                    maxSpeakerCount: 2,
                },
                contextWindowCompression: { slidingWindow: {} },
                speechConfig: { languageCode: language },
                systemInstruction: {
                    parts: [{ text: systemPrompt }],
                },
            },
        });

        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        return session;
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
        console.log('Checking for existing SystemAudioDump processes...');

        // Kill any existing SystemAudioDump processes
        const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
            stdio: 'ignore',
        });

        killProc.on('close', code => {
            if (code === 0) {
                console.log('Killed existing SystemAudioDump processes');
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

    console.log('Starting macOS audio capture with SystemAudioDump...');

    const { app } = require('electron');
    const path = require('path');

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'SystemAudioDump');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'SystemAudioDump');
    }

    console.log('SystemAudioDump path:', systemAudioPath);

    // Verify the binary exists
    if (!require('fs').existsSync(systemAudioPath)) {
        throw new Error('SystemAudioDump binary not found at: ' + systemAudioPath);
    }

    // Spawn SystemAudioDump with stealth options
    const spawnOptions = {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            // Set environment variables that might help with stealth
            PROCESS_NAME: 'AudioService',
            APP_NAME: 'System Audio Service',
        },
    };

    // On macOS, apply additional stealth measures
    if (process.platform === 'darwin') {
        spawnOptions.detached = false;
        spawnOptions.windowsHide = false;
    }

    return new Promise((resolve, reject) => {
        systemAudioProc = spawn(systemAudioPath, [], spawnOptions);

        if (!systemAudioProc.pid) {
            console.error('Failed to start SystemAudioDump');
            reject(new Error('Failed to spawn SystemAudioDump process'));
            return;
        }

        console.log('SystemAudioDump started with PID:', systemAudioProc.pid);

        let stderrBuffer = '';
        let hasReceivedAudio = false;
        let startupTimeout = null;

        const CHUNK_DURATION = 0.1;
        const SAMPLE_RATE = 24000;
        const BYTES_PER_SAMPLE = 2;
        const CHANNELS = 2;
        const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

        let audioBuffer = Buffer.alloc(0);

        systemAudioProc.stdout.on('data', data => {
            // First audio data received - clear startup timeout
            if (!hasReceivedAudio) {
                hasReceivedAudio = true;
                if (startupTimeout) {
                    clearTimeout(startupTimeout);
                    startupTimeout = null;
                }
                console.log('SystemAudioDump: Receiving audio data successfully');
                resolve(true);
            }

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
        });

        systemAudioProc.stderr.on('data', data => {
            const errorText = data.toString();
            stderrBuffer += errorText;
            console.error('SystemAudioDump stderr:', errorText);

            // Check for "stream stopped by system" error (-3821)
            if (errorText.includes('-3821') || errorText.includes('Stream was stopped by the system')) {
                const systemStopError = 'System audio capture was interrupted by macOS. This usually happens when the app loses focus or macOS background restrictions activate. The app may need to remain visible for system audio capture to work reliably.';
                console.error('System interruption detected:', systemStopError);
                sendToRenderer('update-status', 'Warning: ' + systemStopError);

                // Note: We don't reject here because audio was working initially
                // The system just stopped it mid-session
            }
            // Check for permission errors (-3805)
            else if (errorText.includes('-3805') ||
                errorText.includes('ScreenCaptureKit') ||
                errorText.includes('permission') ||
                errorText.includes('Screen Recording')) {

                const permissionError = 'Screen Recording permission required. Please grant permission in System Settings → Privacy & Security → Screen Recording and enable the app (Terminal.app or Prism.app).';
                console.error('Permission error detected:', permissionError);
                sendToRenderer('update-status', 'Error: ' + permissionError);

                // Don't reject immediately - let the timeout handle it
                // This allows the user to see the full error message
            }
        });

        systemAudioProc.on('close', code => {
            console.log('SystemAudioDump process closed with code:', code);
            systemAudioProc = null;

            if (!hasReceivedAudio) {
                // Process closed before receiving audio - likely a permission error
                let errorMessage = 'SystemAudioDump closed unexpectedly';
                if (stderrBuffer) {
                    errorMessage += ': ' + stderrBuffer.trim();
                }
                if (code !== 0) {
                    errorMessage += ' (exit code: ' + code + ')';
                }
                reject(new Error(errorMessage));
            }
        });

        systemAudioProc.on('error', err => {
            console.error('SystemAudioDump process error:', err);
            systemAudioProc = null;
            reject(err);
        });

        // Set a 5-second timeout for receiving first audio data
        // If no audio is received, it's likely a permission issue
        startupTimeout = setTimeout(() => {
            if (!hasReceivedAudio) {
                console.error('SystemAudioDump timeout: No audio data received after 5 seconds');

                let errorMessage = 'SystemAudioDump failed to capture audio. ';

                if (stderrBuffer.includes('-3805') ||
                    stderrBuffer.includes('ScreenCaptureKit') ||
                    stderrBuffer.includes('permission')) {
                    errorMessage += 'This is likely a Screen Recording permission issue. Please:\n\n' +
                                  '1. Open System Settings → Privacy & Security → Screen Recording\n' +
                                  '2. Enable the app you are running (Terminal.app if using npm start, or Prism.app if using DMG)\n' +
                                  '3. Restart the app';
                } else if (stderrBuffer) {
                    errorMessage += 'Error: ' + stderrBuffer.trim();
                } else {
                    errorMessage += 'No error details available. Check Terminal logs.';
                }

                // Kill the process
                if (systemAudioProc) {
                    systemAudioProc.kill('SIGTERM');
                }

                reject(new Error(errorMessage));
            }
        }, 5000);
    });
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
    if (systemAudioProc) {
        console.log('Stopping SystemAudioDump...');
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
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };

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
            trackAudioChunk(correlationId, 'system', Date.now());

            // Add to FIFO queue for speaker matching
            audioChunkQueue.push({ source: 'system', timestamp: Date.now(), correlationId });

            // Limit queue size to prevent memory leaks
            if (audioChunkQueue.length > MAX_QUEUE_SIZE) {
                audioChunkQueue.shift(); // Remove oldest
            }

            process.stdout.write('.');
            await geminiSessionRef.current.sendRealtimeInput({
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
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };

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
            trackAudioChunk(correlationId, 'mic', Date.now());

            // Add to FIFO queue for speaker matching
            audioChunkQueue.push({ source: 'mic', timestamp: Date.now(), correlationId });

            // Limit queue size to prevent memory leaks
            if (audioChunkQueue.length > MAX_QUEUE_SIZE) {
                audioChunkQueue.shift(); // Remove oldest
            }

            process.stdout.write(',');
            await geminiSessionRef.current.sendRealtimeInput({
                audio: { data: data, mimeType: mimeType },
            });
            return { success: true };
        } catch (error) {
            console.error('Error sending mic audio:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-image-content', async (event, { data, debug }) => {
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };

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
            await geminiSessionRef.current.sendRealtimeInput({
                media: { data: data, mimeType: 'image/jpeg' },
            });

            return { success: true };
        } catch (error) {
            console.error('Error sending image:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-text-message', async (event, text) => {
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };

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
            await geminiSessionRef.current.sendRealtimeInput({ text: text.trim() });
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
};
