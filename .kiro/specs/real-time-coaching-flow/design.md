# Design Document

## Overview

This design addresses critical bugs in the real-time coaching flow system that prevent natural conversation. The core issue is a timeout calculation bug in the transcript buffering logic (line 625 of gemini.js) where the timeout check happens AFTER updating the timestamp, making it always false. This causes word-by-word fragmentation instead of sentence-level buffering.

Additionally, the system suffers from:
- AI response concatenation artifacts ("OnGood", "GotToTo")
- Excessive screenshot captures burning API quota
- Log noise from defensive promise handling
- Unreliable word-level speaker attribution defeating buffering logic

The solution involves fixing the timeout bug, improving buffer management, implementing proper throttling, and making the system resilient to Gemini API's unreliable speaker attribution.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Gemini Live API                          │
│  (Audio Streaming + Transcription + AI Responses)           │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
             │ Transcription                  │ AI Response
             │ Fragments                      │ Fragments
             ▼                                ▼
┌────────────────────────┐        ┌──────────────────────────┐
│  Transcript Buffering  │        │   Message Buffer         │
│  System                │        │   (Response Assembly)    │
│  - Accumulate words    │        │   - Clear on new turn    │
│  - Detect punctuation  │        │   - Prevent artifacts    │
│  - 2s timeout          │        │   - Track completion     │
│  - Ignore speaker flip │        └──────────────────────────┘
└────────────┬───────────┘
             │ Complete
             │ Sentences
             ▼
┌────────────────────────┐        ┌──────────────────────────┐
│  Speaker Attribution   │        │   Context Injection      │
│  System (FIFO Queue)   │◄───────┤   System                 │
│  - Track audio chunks  │        │   - Speaker turns        │
│  - Match transcriptions│        │   - 3s fallback          │
│  - Label speakers      │        │   - Include suggestions  │
└────────────────────────┘        │   - RAG integration      │
                                  └──────────────────────────┘
             │
             ▼
┌────────────────────────┐        ┌──────────────────────────┐
│  Conversation State    │        │   Screenshot Throttle    │
│  Machine               │        │   System                 │
│  - Track suggestions   │        │   - 60s minimum interval │
│  - Monitor responses   │        │   - 5s manual interval   │
│  - Calculate adherence │        │   - Token-based limiting │
└────────────────────────┘        └──────────────────────────┘
```

### Data Flow

1. **Audio Capture** → Audio chunks sent to Gemini API with source tracking (system/mic)
2. **Transcription** → Word fragments arrive with unreliable speaker attribution
3. **Buffering** → Accumulate fragments until punctuation or 2s timeout (ignore speaker changes)
4. **Speaker Attribution** → FIFO queue matches transcriptions to audio source
5. **Context Injection** → Send speaker-labeled history on turn boundaries or 3s timeout
6. **AI Response** → Fragments assembled in message buffer, cleared on new turn
7. **State Tracking** → Conversation state machine tracks suggestions and adherence

## Components and Interfaces

### 1. Transcript Buffering System

**Location**: `src/utils/gemini.js` lines 611-651

**State Variables**:
```javascript
let userSpeechBuffer = '';           // Accumulates speech fragments
let lastUserSpeechTime = Date.now(); // Timestamp of last fragment
const USER_SPEECH_TIMEOUT = 2000;    // 2 seconds silence = complete
```

**Critical Bug Fix** (Line 625):
```javascript
// BEFORE (BUG):
lastUserSpeechTime = Date.now();  // Line 620
const speechTimeoutReached = timeSinceLastSpeech > USER_SPEECH_TIMEOUT; // Line 625 - ALWAYS FALSE!

// AFTER (FIX):
const speechTimeoutReached = timeSinceLastSpeech > USER_SPEECH_TIMEOUT; // Check FIRST
lastUserSpeechTime = Date.now();  // Update AFTER
```

**Interface**:
```javascript
function bufferTranscriptFragment(newTranscript, speaker) {
    // Calculate timeout BEFORE updating timestamp
    const now = Date.now();
    const timeSinceLastSpeech = now - lastUserSpeechTime;
    const speechTimeoutReached = timeSinceLastSpeech > USER_SPEECH_TIMEOUT;
    
    // Accumulate fragment
    userSpeechBuffer += newTranscript + ' ';
    lastUserSpeechTime = now; // Update AFTER check
    
    // Check flush conditions
    const trimmedBuffer = userSpeechBuffer.trim();
    const hasSentenceEnding = /[.!?]$/.test(trimmedBuffer);
    
    // Flush on: punctuation OR timeout (NOT speaker changes)
    if (hasSentenceEnding || speechTimeoutReached) {
        const reason = hasSentenceEnding ? 'sentence complete' : 'timeout';
        sendToRenderer('transcript-update', { text: trimmedBuffer, speaker });
        userSpeechBuffer = '';
        return true; // Flushed
    }
    
    return false; // Still buffering
}
```

**Key Design Decisions**:
- **Ignore speaker changes**: Gemini's word-level attribution is unreliable (oscillates between "You" and "Interviewer")
- **Punctuation detection**: Regex `/[.!?]$/` matches sentence endings
- **Timeout calculation**: Must happen BEFORE timestamp update
- **Progress logging**: Every 5 words to aid debugging without spam

### 2. Message Buffer (Response Assembly)

**Location**: `src/utils/gemini.js` lines 656-700

**State Variables**:
```javascript
let messageBuffer = '';              // Accumulates AI response fragments
let isGenerationComplete = true;     // Tracks if previous response finished
```

**Interface**:
```javascript
// On new AI response turn
if (message.serverContent?.modelTurn?.parts) {
    // DEFENSIVE: Clear buffer if previous generation was complete
    if (isGenerationComplete) {
        console.log('[AI Response] Starting new response, clearing messageBuffer');
        messageBuffer = '';
        isGenerationComplete = false;
    }
    
    // Accumulate fragments
    for (const part of message.serverContent.modelTurn.parts) {
        if (part.text) {
            messageBuffer += part.text;
            sendToRenderer('update-response', messageBuffer);
        }
    }
}

// On generation complete
if (message.serverContent?.generationComplete) {
    console.log('[AI Response] Generation complete');
    sendToRenderer('update-response', messageBuffer);
    
    // Track suggestion for coaching feedback
    if (messageBuffer && messageBuffer.trim().length > 0) {
        conversationState.trackSuggestion(messageBuffer.trim(), 'AI Coach');
    }
    
    // Clear and mark complete
    messageBuffer = '';
    isGenerationComplete = true;
}

// On interruption
if (message.serverContent?.interrupted) {
    console.log('[AI Response] Response interrupted, clearing messageBuffer');
    messageBuffer = '';
    isGenerationComplete = true;
}
```

**Key Design Decisions**:
- **Clear on new turn**: Prevents concatenation artifacts like "OnGood"
- **Track completion state**: `isGenerationComplete` flag prevents premature clearing
- **Handle interruptions**: User can interrupt AI mid-response

### 3. Screenshot Throttle System

**Location**: `src/utils/renderer.js` lines 811-900

**State Variables**:
```javascript
const SCREENSHOT_MIN_INTERVAL = 60000;        // 60s for automated
const SCREENSHOT_MANUAL_MIN_INTERVAL = 5000;  // 5s for manual
let lastAutomatedScreenshotTime = 0;
let lastManualScreenshotTime = 0;
let isCapturingScreenshot = false;            // Prevent race conditions
```

**Interface**:
```javascript
async function captureScreenshot(imageQuality = 'medium', isManual = false) {
    // Prevent race conditions
    if (isCapturingScreenshot) {
        console.log('Screenshot already in progress, skipping');
        return;
    }
    
    const now = Date.now();
    
    if (isManual) {
        // Manual: 5s throttle
        const timeSinceLastManual = now - lastManualScreenshotTime;
        if (timeSinceLastManual < SCREENSHOT_MANUAL_MIN_INTERVAL) {
            console.log(`Manual screenshot throttled: ${Math.round((SCREENSHOT_MANUAL_MIN_INTERVAL - timeSinceLastManual) / 1000)}s remaining`);
            return;
        }
        lastManualScreenshotTime = now;
    } else {
        // Automated: 60s throttle
        const timeSinceLastAutomated = now - lastAutomatedScreenshotTime;
        if (timeSinceLastAutomated < SCREENSHOT_MIN_INTERVAL) {
            const remainingSeconds = Math.round((SCREENSHOT_MIN_INTERVAL - timeSinceLastAutomated) / 1000);
            console.log(`Automated screenshot throttled: ${remainingSeconds}s until next capture`);
            return;
        }
        lastAutomatedScreenshotTime = now;
    }
    
    // Set flag and capture
    isCapturingScreenshot = true;
    try {
        // ... capture logic ...
    } finally {
        isCapturingScreenshot = false;
    }
}

function resetScreenshotThrottle() {
    lastAutomatedScreenshotTime = 0;
    lastManualScreenshotTime = 0;
}
```

**Key Design Decisions**:
- **Separate timers**: Manual and automated screenshots have different throttles
- **Race condition prevention**: `isCapturingScreenshot` flag prevents concurrent captures
- **Reset on session start**: Allow immediate first screenshot
- **Token-based limiting**: Additional check via `tokenTracker.shouldThrottle()`

### 4. Context Injection System

**Location**: `src/utils/gemini.js` lines 104-145, 573-590

**State Variables**:
```javascript
let speakerContextBuffer = '';               // Accumulates speaker-labeled transcript
let lastContextSentTime = Date.now();        // Last injection timestamp
let previousSpeaker = null;                  // Track speaker changes
const CONTEXT_SEND_FALLBACK_TIMEOUT = 3000;  // 3s fallback
```

**Interface**:
```javascript
function sendSpeakerContextIfNeeded(currentSpeaker, geminiSessionRef, force = false) {
    const now = Date.now();
    const timeSinceLastContext = now - lastContextSentTime;
    
    // Trigger 1: Speaker turn boundary
    const speakerChanged = previousSpeaker !== null && previousSpeaker !== currentSpeaker;
    
    // Trigger 2: Fallback timeout (3 seconds)
    const timeoutReached = timeSinceLastContext >= CONTEXT_SEND_FALLBACK_TIMEOUT;
    
    const shouldSend = force || speakerChanged || timeoutReached;
    
    if (shouldSend && speakerContextBuffer.trim()) {
        const triggerReason = speakerChanged ? 'speaker_turn' : 'timeout_fallback';
        
        // Build context message
        let contextMessage = `<context>\n${speakerContextBuffer.trim()}\n</context>`;
        
        // Add last suggestion for coaching feedback
        const currentSuggestion = conversationState.getCurrentSuggestion();
        if (currentSuggestion) {
            contextMessage += `\n<lastSuggestion>\nYou suggested: "${currentSuggestion.text}"\nTurn ID: ${currentSuggestion.turnId}\nTime: ${new Date(currentSuggestion.timestamp).toISOString()}\n</lastSuggestion>`;
        }
        
        // Defensive send with promise handling
        try {
            if (geminiSessionRef.current && typeof geminiSessionRef.current.sendRealtimeInput === 'function') {
                const promise = geminiSessionRef.current.sendRealtimeInput({ text: contextMessage });
                
                if (promise && typeof promise.catch === 'function') {
                    promise.catch(err => {
                        console.error('[Context Injection] Failed:', err);
                    });
                }
                // Silently skip if undefined - normal during certain states
            }
        } catch (err) {
            console.error('[Context Injection] Error:', err);
        }
        
        // Reset buffer and timer
        speakerContextBuffer = '';
        lastContextSentTime = now;
        console.log(`[Context Injection] Sent (trigger: ${triggerReason})`);
    }
    
    previousSpeaker = currentSpeaker;
}
```

**Key Design Decisions**:
- **Event-driven**: Primary trigger is speaker turn boundary
- **Fallback timeout**: 3s ensures context is sent even without speaker changes
- **Include suggestions**: AI needs to remember what it suggested for coaching feedback
- **Defensive promise handling**: Check function exists and promise is valid before .catch()
- **Silent failures**: Don't log warnings when session not ready (expected behavior)

### 5. Speaker Attribution System

**Location**: `src/utils/gemini.js` lines 75-95

**State Variables**:
```javascript
const audioChunkQueue = [];          // FIFO queue of audio chunks
const MAX_QUEUE_SIZE = 50;           // Prevent memory leaks
```

**Interface**:
```javascript
function determineSpeakerFromCorrelation() {
    // Match transcription to oldest untracked chunk (FIFO)
    if (audioChunkQueue.length > 0) {
        const oldestChunk = audioChunkQueue.shift();
        const speaker = oldestChunk.source === 'system' ? 'Interviewer' : 'You';
        
        if (process.env.DEBUG_CORRELATION) {
            console.log(`[Speaker Attribution] Matched to ${oldestChunk.source} (queue: ${audioChunkQueue.length})`);
        }
        
        return speaker;
    }
    
    // Fallback: default to 'You' (mic)
    return 'You';
}

// When sending audio to API
async function sendAudioToGemini(base64Data, geminiSessionRef, source) {
    const correlationId = generateCorrelationId();
    trackAudioChunk(correlationId, source, Date.now());
    
    // Add to FIFO queue
    audioChunkQueue.push({ source, timestamp: Date.now(), correlationId });
    
    // Limit queue size
    if (audioChunkQueue.length > MAX_QUEUE_SIZE) {
        audioChunkQueue.shift();
    }
    
    await geminiSessionRef.current.sendRealtimeInput({
        audio: { data: base64Data, mimeType: 'audio/pcm;rate=24000' }
    });
}
```

**Key Design Decisions**:
- **FIFO matching**: First transcription matches first audio chunk
- **Source tracking**: 'system' (BlackHole/SystemAudioDump) vs 'mic'
- **Queue size limit**: Prevent memory leaks with MAX_QUEUE_SIZE
- **Correlation IDs**: Track chunks for debugging

### 6. Conversation State Machine

**Location**: `src/utils/conversationState.js`

**States**:
```javascript
const STATES = {
    IDLE: 'IDLE',                   // No active conversation
    SUGGESTING: 'SUGGESTING',       // AI just provided suggestion
    MONITORING: 'MONITORING',       // User speaking, AI monitoring
    EVALUATING: 'EVALUATING',       // AI evaluating response
};
```

**Interface**:
```javascript
class ConversationStateMachine {
    trackSuggestion(text, speaker = 'AI') {
        const turnId = ++this.turnIdCounter;
        this.currentSuggestion = {
            text: text.trim(),
            timestamp: Date.now(),
            speaker,
            turnId,
        };
        this.actualResponse = null;
        this.setState(STATES.SUGGESTING);
        return this.currentSuggestion;
    }
    
    compareResponse(actualText) {
        if (!this.currentSuggestion) {
            return { adherence: 0, analysis: 'No suggestion available', hasSuggestion: false };
        }
        
        this.setState(STATES.MONITORING);
        
        const adherence = this._calculateAdherence(this.currentSuggestion.text, actualText);
        
        this.actualResponse = {
            text: actualText.trim(),
            timestamp: Date.now(),
            adherence,
            turnId: this.currentSuggestion.turnId,
        };
        
        // Add to history (limit to 10)
        this.turnHistory.push({
            turnId: this.currentSuggestion.turnId,
            suggestion: this.currentSuggestion.text,
            actual: actualText.trim(),
            adherence,
            timestamp: Date.now(),
        });
        
        if (this.turnHistory.length > 10) {
            this.turnHistory.shift();
        }
        
        return {
            suggestion: this.currentSuggestion.text,
            actualText: actualText.trim(),
            adherence,
            analysis: this._getAdherenceAnalysis(adherence),
            hasSuggestion: true,
        };
    }
    
    _calculateAdherence(suggested, actual) {
        // Normalize: lowercase, remove punctuation, split words
        const normalize = (str) => str.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 0);
        
        const suggestedWords = normalize(suggested);
        const actualWords = normalize(actual);
        
        if (suggestedWords.length === 0 || actualWords.length === 0) return 0;
        
        // Calculate word overlap
        const suggestedSet = new Set(suggestedWords);
        const actualSet = new Set(actualWords);
        
        let matchCount = 0;
        for (const word of actualSet) {
            if (suggestedSet.has(word)) matchCount++;
        }
        
        // Average overlap from both perspectives
        const suggestedCoverage = matchCount / suggestedSet.size;
        const actualCoverage = matchCount / actualSet.size;
        const adherence = ((suggestedCoverage + actualCoverage) / 2) * 100;
        
        return Math.round(Math.min(100, Math.max(0, adherence)));
    }
    
    _getAdherenceAnalysis(adherence) {
        if (adherence >= 80) return 'Excellent adherence - user followed suggestion very closely';
        if (adherence >= 60) return 'Good adherence - user followed key points with some variation';
        if (adherence >= 40) return 'Moderate adherence - user partially followed suggestion';
        if (adherence >= 20) return 'Low adherence - user deviated significantly from suggestion';
        return 'Minimal adherence - user did not follow suggestion';
    }
}
```

**Key Design Decisions**:
- **State transitions**: IDLE → SUGGESTING → MONITORING → EVALUATING
- **Word overlap algorithm**: Simple but effective for adherence scoring
- **Turn history**: Limited to 10 entries to prevent memory growth
- **Bidirectional coverage**: Average of suggested→actual and actual→suggested overlap

## Data Models

### Transcript Buffer State
```javascript
{
    userSpeechBuffer: string,        // Accumulated speech fragments
    lastUserSpeechTime: number,      // Timestamp (ms) of last fragment
    USER_SPEECH_TIMEOUT: 2000        // Constant: 2s timeout
}
```

### Message Buffer State
```javascript
{
    messageBuffer: string,           // Accumulated AI response fragments
    isGenerationComplete: boolean    // True if previous response finished
}
```

### Audio Chunk Queue Entry
```javascript
{
    source: 'system' | 'mic',        // Audio source type
    timestamp: number,               // When chunk was sent (ms)
    correlationId: string            // Unique identifier for debugging
}
```

### Context Injection State
```javascript
{
    speakerContextBuffer: string,    // Accumulated speaker-labeled transcript
    lastContextSentTime: number,     // Last injection timestamp (ms)
    previousSpeaker: string | null,  // Previous speaker for turn detection
    CONTEXT_SEND_FALLBACK_TIMEOUT: 3000  // Constant: 3s fallback
}
```

### Screenshot Throttle State
```javascript
{
    lastAutomatedScreenshotTime: number,  // Last automated capture (ms)
    lastManualScreenshotTime: number,     // Last manual capture (ms)
    isCapturingScreenshot: boolean,       // Race condition prevention
    SCREENSHOT_MIN_INTERVAL: 60000,       // Constant: 60s automated
    SCREENSHOT_MANUAL_MIN_INTERVAL: 5000  // Constant: 5s manual
}
```

### Conversation Turn
```javascript
{
    turnId: number,                  // Unique turn identifier
    suggestion: string,              // What AI suggested
    actual: string,                  // What user actually said
    adherence: number,               // Adherence score 0-100
    timestamp: number                // When turn occurred (ms)
}
```

### Suggestion Object
```javascript
{
    text: string,                    // Suggested response text
    timestamp: number,               // When suggestion was made (ms)
    speaker: string,                 // Speaker label (e.g., 'AI Coach')
    turnId: number                   // Unique turn identifier
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transcript buffering accumulates until completion trigger

*For any* sequence of speech fragments without punctuation, the Transcript Buffering System should accumulate all fragments without sending to the renderer until either sentence-ending punctuation is added or 2 seconds of silence occurs.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Speaker attribution changes do not trigger buffer flush

*For any* sequence of speech fragments where speaker attribution oscillates between "You" and "Interviewer" on consecutive words, the Transcript Buffering System should continue accumulating in the buffer and should NOT flush until punctuation or timeout occurs.

**Validates: Requirements 13.1, 13.2, 13.3, 13.4**

### Property 3: Message buffer clears on new turn

*For any* AI response sequence, when a new response turn begins (isGenerationComplete is true), the Message Buffer should be completely empty before accumulating new text fragments.

**Validates: Requirements 2.1, 2.5**

### Property 4: Message buffer prevents concatenation artifacts

*For any* sequence of multiple AI response turns, the Message Buffer should never produce concatenation artifacts (like "OnGood" or "GotToTo") when properly clearing between turns.

**Validates: Requirements 2.4**

### Property 5: Message buffer clears on completion and interruption

*For any* AI response, when generation completes or is interrupted, the Message Buffer should be cleared and the isGenerationComplete flag should be set to true.

**Validates: Requirements 2.2, 2.3**

### Property 6: Screenshot throttling enforces minimum intervals

*For any* sequence of screenshot capture requests, automated captures should be throttled to minimum 60-second intervals and manual captures should be throttled to minimum 5-second intervals.

**Validates: Requirements 3.1, 3.2, 3.3, 3.5**

### Property 7: Context injection triggers on speaker turns

*For any* conversation with speaker changes, when a speaker turn boundary occurs (previousSpeaker ≠ currentSpeaker), the Context Injection System should immediately send accumulated speaker-labeled context to the AI.

**Validates: Requirements 6.1**

### Property 8: Context injection fallback timeout

*For any* conversation where no speaker turn occurs, when 3 seconds elapse since the last context injection, the Context Injection System should send accumulated context as a fallback.

**Validates: Requirements 6.2**

### Property 9: Context messages include suggestion metadata

*For any* context injection where a current suggestion exists, the context message should include the last AI suggestion with turn ID and timestamp.

**Validates: Requirements 6.3**

### Property 10: Defensive promise handling prevents rejections

*For any* call to sendRealtimeInput that returns undefined, the system should handle it gracefully without throwing unhandled promise rejections or logging excessive warnings.

**Validates: Requirements 6.5, 7.2**

### Property 11: Audio buffer size limiting prevents memory leaks

*For any* audio buffer that grows beyond maximum size (MAX_AUDIO_BUFFER_SIZE * samplesPerChunk), the system should remove the oldest data to maintain the size limit.

**Validates: Requirements 7.5**

### Property 12: Speaker attribution FIFO queue matching

*For any* sequence of audio chunks and transcriptions, the Speaker Attribution System should match each transcription to the oldest unresolved audio chunk in the FIFO queue.

**Validates: Requirements 8.1, 8.2**

### Property 13: Audio chunk queue size limiting

*For any* audio chunk queue that exceeds 50 entries, the Speaker Attribution System should remove the oldest entry to maintain the size limit.

**Validates: Requirements 8.3**

### Property 14: Speaker labeling based on audio source

*For any* audio chunk, when the source is 'system' (BlackHole or SystemAudioDump), the speaker should be labeled "Interviewer", and when the source is 'mic', the speaker should be labeled "You".

**Validates: Requirements 8.4, 8.5**

### Property 15: Speaker attribution used only for context, not buffering

*For any* speech fragment with speaker attribution, the attribution should be used for context tracking and coaching feedback but should NOT be used as a trigger for buffer flush decisions.

**Validates: Requirements 13.5**

### Property 16: Conversation state machine tracks suggestions

*For any* AI response that completes, the Conversation State Machine should track it as a suggestion with a unique turn ID and timestamp.

**Validates: Requirements 10.1**

### Property 17: State machine transitions on user speech

*For any* user speech after a suggestion, the Conversation State Machine should transition from SUGGESTING to MONITORING state.

**Validates: Requirements 10.2**

### Property 18: Adherence calculation uses word overlap

*For any* suggestion and actual response pair, the Conversation State Machine should calculate adherence score (0-100) using word overlap algorithm that averages coverage from both perspectives.

**Validates: Requirements 10.3**

### Property 19: Adherence analysis provides human-readable feedback

*For any* adherence score, the Conversation State Machine should provide human-readable analysis: "Excellent" (≥80%), "Good" (≥60%), "Moderate" (≥40%), "Low" (≥20%), or "Minimal" (<20%).

**Validates: Requirements 10.4**

### Property 20: Turn history size limiting

*For any* turn history that exceeds 10 entries, the Conversation State Machine should remove the oldest entry to maintain the size limit.

**Validates: Requirements 10.5**

## Error Handling

### Defensive Promise Handling

All calls to `geminiSessionRef.current.sendRealtimeInput()` must use defensive checks:

```javascript
// Check function exists
if (geminiSessionRef.current && typeof geminiSessionRef.current.sendRealtimeInput === 'function') {
    const promise = geminiSessionRef.current.sendRealtimeInput({ text: message });
    
    // Check promise is valid before calling .catch()
    if (promise && typeof promise.catch === 'function') {
        promise.catch(err => {
            console.error('[Error Context] Failed:', err);
        });
    }
    // Silently skip if undefined - normal during certain API states
}
```

**Rationale**: The Gemini Live API returns `undefined` from `sendRealtimeInput()` during certain states (processing, transitioning, etc.). Calling `.catch()` on `undefined` throws `TypeError: Cannot read properties of undefined (reading 'catch')`. This defensive pattern prevents unhandled promise rejections.

### Memory Leak Prevention

All unbounded buffers and queues must enforce size limits:

- **Audio buffers**: Remove oldest data when exceeding `MAX_AUDIO_BUFFER_SIZE * samplesPerChunk`
- **Audio chunk queue**: Remove oldest entry when exceeding `MAX_QUEUE_SIZE` (50)
- **Turn history**: Remove oldest entry when exceeding 10 entries

**Rationale**: Long-running sessions can accumulate unbounded data, causing memory leaks and eventual crashes. Size limits ensure stable operation.

### Race Condition Prevention

Screenshot capture uses a flag to prevent concurrent captures:

```javascript
if (isCapturingScreenshot) {
    console.log('Screenshot already in progress, skipping');
    return;
}
isCapturingScreenshot = true;
try {
    // ... capture logic ...
} finally {
    isCapturingScreenshot = false;
}
```

**Rationale**: Multiple screenshot requests can arrive simultaneously (e.g., interval timer + manual trigger). Concurrent captures can corrupt the canvas or cause API errors.

### Template Literal Safety

System prompts must escape backticks in documentation:

```javascript
// WRONG: Unescaped backticks cause ReferenceError
const prompt = `You receive context in `<lastSuggestion>` tags`;

// CORRECT: Escaped backticks
const prompt = `You receive context in \`<lastSuggestion>\` tags`;
```

**Rationale**: Unescaped backticks inside template literals are interpreted as nested template strings, causing `ReferenceError` when variable names appear in documentation.

## Testing Strategy

### Unit Testing

Unit tests will cover specific examples and edge cases:

**Transcript Buffering**:
- Empty input handling
- Single word without punctuation
- Multiple words with punctuation
- Timeout edge case (exactly 2000ms)

**Message Buffer**:
- Empty buffer on startup
- Single fragment
- Multiple fragments
- Interruption mid-response

**Screenshot Throttle**:
- First capture (should allow)
- Second capture within 60s (should throttle)
- Capture after 60s (should allow)
- Manual vs automated separation

**State Machine**:
- Suggestion tracking with empty text
- Adherence calculation with identical strings (should be 100%)
- Adherence calculation with completely different strings (should be 0%)
- State transitions

### Property-Based Testing

Property-based tests will verify universal properties across all inputs using **fast-check** (JavaScript property testing library):

**Configuration**: Each property test should run a minimum of 100 iterations to ensure thorough coverage of the random input space.

**Tagging**: Each property-based test must be tagged with a comment explicitly referencing the correctness property:
```javascript
// Feature: real-time-coaching-flow, Property 1: Transcript buffering accumulates until completion trigger
```

**Test Structure**:
```javascript
const fc = require('fast-check');

// Property 1: Transcript buffering accumulates until completion trigger
test('Property 1: Transcript buffering accumulates until completion trigger', () => {
    fc.assert(
        fc.property(
            fc.array(fc.string({ minLength: 1, maxLength: 20 })), // Random word sequences
            (words) => {
                const buffer = new TranscriptBuffer();
                
                // Add words without punctuation
                for (const word of words) {
                    buffer.add(word);
                }
                
                // Should not have sent anything yet
                expect(buffer.getSentCount()).toBe(0);
                
                // Add punctuation
                buffer.add('.');
                
                // Should have sent exactly once
                expect(buffer.getSentCount()).toBe(1);
            }
        ),
        { numRuns: 100 }
    );
});
```

**Property Test Coverage**:
- Property 1: Generate random word sequences, verify no send until punctuation/timeout
- Property 2: Generate random speaker oscillations, verify buffer doesn't flush
- Property 3-5: Generate random AI response sequences, verify buffer clearing
- Property 6: Generate random capture request timings, verify throttling
- Property 7-9: Generate random conversation sequences, verify context injection
- Property 10: Generate random undefined returns, verify no exceptions
- Property 11: Generate large audio buffers, verify size limiting
- Property 12-15: Generate random audio/transcription sequences, verify speaker attribution
- Property 16-20: Generate random suggestions/responses, verify state machine behavior

### Integration Testing

Integration tests will verify end-to-end coaching flow:

**Coaching Flow Test**:
1. Start session
2. Simulate interviewer question (system audio)
3. Verify AI generates suggestion
4. Simulate user response (mic audio)
5. Verify adherence calculation
6. Verify complete transcript sent to AI

**Audio Capture Test**:
1. Start audio capture
2. Send audio chunks from both sources
3. Verify speaker attribution
4. Verify transcriptions labeled correctly

### Test Utilities

**Mock Gemini Session**:
```javascript
class MockGeminiSession {
    constructor() {
        this.inputs = [];
        this.shouldReturnUndefined = false;
    }
    
    sendRealtimeInput(input) {
        this.inputs.push(input);
        if (this.shouldReturnUndefined) {
            return undefined;
        }
        return Promise.resolve();
    }
}
```

**Time Simulation**:
```javascript
class TimeSimulator {
    constructor() {
        this.currentTime = 0;
    }
    
    advance(ms) {
        this.currentTime += ms;
    }
    
    now() {
        return this.currentTime;
    }
}
```

**Buffer Inspector**:
```javascript
class BufferInspector {
    constructor(buffer) {
        this.buffer = buffer;
        this.sendCount = 0;
        this.sentMessages = [];
    }
    
    onSend(message) {
        this.sendCount++;
        this.sentMessages.push(message);
    }
}
```
