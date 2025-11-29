# Design Document: Transcript Buffering Improvements

## Overview

This design addresses critical issues in the Prism application's real-time transcript buffering and context injection system. The current implementation suffers from:

- **Context injection spam**: Gemini's word-level speaker attribution triggers excessive context injections (multiple per second)
- **Fragment transmission**: Single words and tiny fragments bypass buffering and reach the UI
- **Text fragmentation**: Gemini outputs heavily spaced text that appears broken

The solution implements intelligent debouncing, stricter buffering thresholds, adaptive timeouts based on conversation state, and text normalization to ensure smooth, coherent transcript delivery while maintaining the coaching feedback loop.

## Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Gemini Live API                         │
│              (Speech Transcription + AI)                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Audio Chunks + Transcripts
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Audio Correlation System                       │
│         (FIFO Queue: Chunk ID → Source)                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Transcript + Speaker Label
                 ▼
┌─────────────────────────────────────────────────────────────┐
│           Transcript Buffer (NEW: Enhanced)                 │
│  • Minimum word threshold (5 words)                        │
│  • Adaptive timeouts (2s IDLE, 3s MONITORING)              │
│  • Text normalization                                       │
│  • Speaker change handling                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Buffered Transcript
                 ├──────────────────┬─────────────────────────┐
                 ▼                  ▼                         ▼
┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   UI Renderer        │  │ Context Buffer   │  │ Session Logger   │
│  (Display)           │  │  (Debounced)     │  │  (Diagnostics)   │
└──────────────────────┘  └────────┬─────────┘  └──────────────────┘
                                   │
                                   │ Debounced Context (500ms)
                                   ▼
                          ┌──────────────────┐
                          │  Gemini Live API │
                          │  (Context Input) │
                          └────────┬─────────┘
                                   │
                                   │ AI Response
                                   ▼
                          ┌──────────────────┐
                          │ Response Handler │
                          │ • Tag parsing    │
                          │ • Interruption   │
                          │ • State tracking │
                          └──────────────────┘
```

### Key Architectural Decisions

1. **Separation of Concerns**: Transcript buffering and context injection are separate concerns with different timing requirements
2. **Debouncing Layer**: Context injection uses a 500ms debounce to prevent spam while transcript buffering uses adaptive timeouts
3. **State-Aware Timeouts**: Buffer timeouts adapt based on conversation state (IDLE vs MONITORING)
4. **Text Normalization Pipeline**: All text passes through normalization before display
5. **FIFO Audio Correlation**: Maintains existing correlation system for reliable speaker attribution

## Components and Interfaces

### 1. Enhanced Transcript Buffer

**Location**: `src/utils/gemini.js` (existing file, enhanced)

**State Variables**:
```javascript
// Transcript buffering
let userSpeechBuffer = '';
let lastUserSpeechTime = Date.now();
let currentSpeaker = null;

// Configuration constants
const MIN_WORD_THRESHOLD = 5;
const IDLE_TIMEOUT = 2000;          // 2s when no active coaching
const MONITORING_TIMEOUT = 3000;    // 3s when user is answering
const SLOW_START_TIMEOUT = 3000;    // 3s for first few words
```

**Key Functions**:
```javascript
/**
 * Accumulates transcript fragments and decides when to flush
 * @param {string} fragment - New transcript fragment
 * @param {string} speaker - Speaker label (You/Interviewer)
 * @param {string} conversationState - Current state (IDLE/MONITORING/etc)
 */
function bufferTranscript(fragment, speaker, conversationState)

/**
 * Normalizes text by removing excessive whitespace
 * Handles: multiple spaces, tabs, Unicode spaces, space before punctuation
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
        .replace(/\n{3,}/g, '\n\n')                          // Multiple newlines
        .trim();
}

/**
 * Determines if buffer should flush based on content and timing
 * @returns {boolean} - True if should flush
 */
function shouldFlushBuffer()

/**
 * Flushes buffer to UI and clears state
 * @param {string} reason - Reason for flush (sentence/timeout/speaker_change)
 */
function flushBuffer(reason)

/**
 * Determines appropriate timeout based on conversation state and buffer state
 * Priority: 1) wordCount < 3 → 3s, 2) MONITORING state → 3s, 3) else → 2s
 * @param {string} conversationState - Current state (IDLE/MONITORING/etc)
 * @param {number} wordCount - Current buffer word count
 * @returns {number} - Timeout in milliseconds
 */
function getAdaptiveTimeout(conversationState, wordCount)
```

### 2. Debounced Context Injection

**Location**: `src/utils/gemini.js` (existing file, enhanced)

**State Variables**:
```javascript
// Context injection
let speakerContextBuffer = '';
let lastContextSentTime = Date.now();
let debounceTimer = null;
let pendingContextSend = false;

// Configuration constants
const CONTEXT_DEBOUNCE_DELAY = 500;        // 500ms debounce
const CONTEXT_FALLBACK_TIMEOUT = 3000;     // 3s fallback
const CONTEXT_MAX_SIZE = 1000;             // 1000 chars immediate send
const CONTEXT_HARD_LIMIT = 2000;           // 2000 chars truncate
const CONTEXT_TURN_HISTORY = 3;            // Last 3 turns
```

**Key Functions**:
```javascript
/**
 * Schedules context injection with debouncing
 * @param {string} trigger - Trigger reason (speaker_turn/timeout/size_limit)
 */
function scheduleContextInjection(trigger)

/**
 * Sends context to Gemini with retry logic
 * @param {string} context - Context text
 * @param {string} trigger - Trigger reason
 */
async function sendContextToAI(context, trigger)

/**
 * Builds context message with turn history and last suggestion
 * Format:
 *   <context>[Interviewer]: question\n[You]: answer</context>
 *   <lastSuggestion>Text... Turn ID: 3</lastSuggestion>
 * @returns {string} - Formatted context message
 */
function buildContextMessage()

/**
 * Cancels active debounce timer
 * Called when: context exceeds 1000 chars, session ends, system shutdown
 */
function cancelDebounce() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        pendingContextSend = false;
        sessionLogger.logDebounce('cancelled', 0);
    }
}
```

### 3. Response Handler

**Location**: `src/utils/gemini.js` (existing file, enhanced)

**State Variables**:
```javascript
// AI response handling
let messageBuffer = '';
let isGenerationComplete = false;
let isResponseInterrupted = false;
```

**Key Functions**:
```javascript
/**
 * Handles incoming AI response chunks
 * @param {object} serverContent - Response from Gemini
 */
function handleAIResponse(serverContent)

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

/**
 * Marks response as interrupted when user speaks
 */
function interruptAIResponse()

/**
 * Detects if AI should be interrupted
 * Interruption occurs when: new user speech arrives AND AI is generating
 * Called from bufferTranscript() when speaker="You"
 * @returns {boolean} - True if AI response should be interrupted
 */
function shouldInterruptAI() {
    return messageBuffer.length > 0 && !isGenerationComplete;
}
```

### 4. Conversation State Integration

**Location**: `src/utils/conversationState.js` (existing file, no changes needed)

**Interface Used**:
```javascript
const { conversationState, STATES } = require('./conversationState');

// Query current state
const currentState = conversationState.getState();

// Track suggestions
conversationState.trackSuggestion(suggestionText);

// Compare responses
conversationState.compareResponse(userText);
```

### 5. Session Logger Enhancement

**Location**: `src/utils/sessionLogger.js` (existing file, enhanced)

**New Methods**:
```javascript
/**
 * Logs debounce activity
 * @param {string} action - Action (scheduled/cancelled/executed)
 * @param {number} delay - Delay in ms
 */
logDebounce(action, delay)

/**
 * Logs buffer rejection
 * @param {string} reason - Rejection reason
 * @param {number} wordCount - Current word count
 */
logBufferRejection(reason, wordCount)

/**
 * Logs context truncation
 * @param {number} originalSize - Original size
 * @param {number} truncatedSize - Truncated size
 */
logContextTruncation(originalSize, truncatedSize)
```

### 6. RAG Integration

**Location**: `src/utils/ragController.js` (existing file, interface used)

**Interface Used**:
```javascript
const { retrieveContext } = require('./ragController');

// Query RAG for relevant context
const ragResult = await retrieveContext(questionText, sessionId, {
    topK: 5,
    minScore: 0.6,
    maxTokens: 400
});

// Send main context first (blocking)
await sendContextToAI(contextMessage, 'speaker_turn');

// Send RAG context immediately after (non-blocking)
// Sequential order ensures main context arrives first
if (ragResult.usedRAG) {
    sendContextToAI(`<relevantHistory>${ragResult.context}</relevantHistory>`, 'rag')
        .catch(err => console.error('[RAG] Non-critical failure:', err));
}
```

## Data Models

### Transcript Buffer State

```javascript
{
    buffer: string,              // Accumulated text
    wordCount: number,           // Current word count
    speaker: string,             // Current speaker (You/Interviewer)
    lastUpdateTime: number,      // Timestamp of last fragment
    conversationState: string    // IDLE/SUGGESTING/MONITORING/EVALUATING
}
```

### Context Injection State

```javascript
{
    buffer: string,              // Accumulated context
    turnHistory: Array<{         // Last N turns
        speaker: string,
        text: string,
        timestamp: number
    }>,
    debounceTimer: Timer,        // Active debounce timer
    lastSentTime: number,        // Last injection timestamp
    pendingSend: boolean         // Debounce in progress
}
```

### AI Response State

```javascript
{
    messageBuffer: string,       // Accumulated response
    isComplete: boolean,         // Generation complete flag
    isInterrupted: boolean,      // Interruption flag
    tags: {                      // Parsed practice tags
        suggestion: string | null,
        feedback: string | null
    }
}
```

### Audio Correlation Entry

```javascript
{
    correlationId: string,       // Unique ID (timestamp_random)
    source: string,              // 'mic' or 'system'
    timestamp: number,           // Creation time
    expiresAt: number           // Expiry time
}
```

**Audio Correlation Cleanup**:
```javascript
/**
 * Cleans up expired audio correlation entries
 * Called every 10 seconds via interval timer
 * Prevents queue buildup from stale entries
 */
function cleanupExpiredCorrelations() {
    const now = Date.now();
    audioChunkQueue = audioChunkQueue.filter(entry => entry.expiresAt > now);
}
```

### Turn Definition

```javascript
/**
 * Turn Definition: A "turn" is a single speaker utterance
 * Example:
 *   Turn 1: [Interviewer]: "Tell me about yourself"
 *   Turn 2: [You]: "I'm a software engineer..."
 *   Turn 3: [Interviewer]: "What's your biggest strength?"
 *
 * Context buffer maintains last 3 turns (most recent utterances)
 */
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Minimum word threshold enforcement
*For any* transcript buffer with fewer than 5 words, when timeout is reached, the buffer should not be sent to the UI unless it contains sentence-ending punctuation.
**Validates: Requirements 1.2, 1.5**

### Property 2: Text normalization preserves content
*For any* text with excessive whitespace, normalizing it should produce text with single spaces while preserving all words and punctuation.
**Validates: Requirements 5.1, 5.2, 5.3**

### Property 3: Speaker change flushes valid buffers
*For any* transcript buffer with at least 5 words, when speaker changes, the buffer should be flushed before starting a new buffer for the new speaker.
**Validates: Requirements 1.6**

### Property 4: Speaker change discards invalid buffers
*For any* transcript buffer with fewer than 5 words, when speaker changes, the buffer should be discarded without sending to UI.
**Validates: Requirements 1.7**

### Property 5: Debounce coalesces rapid changes
*For any* sequence of speaker changes within 500ms, only one context injection should occur after the debounce period ends.
**Validates: Requirements 2.1, 2.2**

### Property 6: Context size triggers immediate send
*For any* context buffer exceeding 1000 characters, context should be sent immediately regardless of debounce timers.
**Validates: Requirements 2.6**

### Property 7: Context truncation at hard limit
*For any* context buffer exceeding 2000 characters, the buffer should be truncated to maintain the limit and a warning should be logged.
**Validates: Requirements 2.7**

### Property 8: AI response buffer clearing
*For any* new AI response start, the previous response buffer should be cleared before accumulating new content.
**Validates: Requirements 7.1**

### Property 9: Interruption detection
*For any* AI response in progress, when user speech is detected, the response should be marked as interrupted.
**Validates: Requirements 7.2, 7.5**

### Property 10: Tag extraction correctness
*For any* text containing suggestion tags, extracting the suggestion should return the text between the tags without the tags themselves.
**Validates: Requirements 7.6**

### Property 11: Unknown tag handling
*For any* text containing unrecognized XML-like tags, the system should log them and display the content without the tags.
**Validates: Requirements 7.8**

### Property 12: Error resilience
*For any* malformed transcription data, the system should log the error and continue operation without crashing.
**Validates: Requirements 10.1**

### Property 13: Retry logic
*For any* failed context injection, the system should retry exactly once after 1 second.
**Validates: Requirements 10.2**

### Property 14: Audio correlation FIFO ordering
*For any* sequence of audio chunks enqueued, dequeuing should return them in the same order (FIFO).
**Validates: Requirements 14.1, 14.2, 14.3**

### Property 15: RAG query threshold
*For any* interviewer question with 10 or fewer words, the RAG system should not be queried.
**Validates: Requirements 15.1**

## Error Handling

### Transcript Buffer Errors

1. **Malformed Fragment**: Log error, skip fragment, continue buffering
2. **Invalid Speaker Label**: Default to last known speaker or "You"
3. **Buffer Overflow**: Truncate to last complete sentence, log warning

### Context Injection Errors

1. **API Failure**: Retry once after 1 second, log failure if retry fails
2. **Buffer Overflow**: Truncate oldest entries, log warning
3. **Debounce Timer Failure**: Fall back to immediate send, log error

### AI Response Errors

1. **Malformed Response**: Log error, display raw text without tags
2. **Interrupted Response**: Clear buffer, mark incomplete, log interruption
3. **Tag Parsing Failure**: Display content without tags, log parsing error

### Audio Correlation Errors

1. **Queue Empty**: Default to last known speaker
2. **Queue Overflow (>100)**: Log warning about correlation drift
3. **Expired Entry**: Return null, log expiry

### RAG Integration Errors

1. **Query Failure**: Log error, continue without RAG context
2. **Low Similarity Scores**: Skip RAG, use fallback strategy
3. **Timeout**: Log timeout, continue without RAG context

## Testing Strategy

### Unit Testing

Unit tests will cover specific examples and edge cases:

1. **Text Normalization Examples**:
   - Empty string → empty string
   - "hello    world" → "hello world"
   - "hello ." → "hello."
   - "[Speaker]: text" → "[Speaker]: text" (preserved)

2. **Buffer State Transitions**:
   - Empty buffer + fragment → buffering
   - Buffer with 4 words + timeout → no send
   - Buffer with 5 words + timeout → send
   - Buffer with punctuation → immediate send

3. **Debounce Timing**:
   - Single speaker change → 500ms delay
   - Multiple changes in 500ms → single send
   - Timeout fallback → send after 3s

4. **Tag Parsing Examples**:
   - `<suggestion>text</suggestion>` → extract "text"
   - `<feedback>text</feedback>` → extract "text"
   - `<unknown>text</unknown>` → display "text", log unknown tag

5. **Error Scenarios**:
   - Null fragment → skip
   - Invalid speaker → default to "You"
   - API failure → retry once

### Property-Based Testing

Property-based tests will verify universal properties across many inputs using **fast-check** (JavaScript property testing library). Each test will run a minimum of 100 iterations.

**Test Configuration**:
```javascript
const fc = require('fast-check');

// Run each property test 100 times
const testConfig = { numRuns: 100 };
```

**Property Test Structure**:
```javascript
describe('Transcript Buffering Properties', () => {
    it('Property 1: Minimum word threshold enforcement', () => {
        fc.assert(
            fc.property(
                fc.array(fc.string(), { minLength: 1, maxLength: 4 }), // < 5 words
                fc.boolean(), // has punctuation
                (words, hasPunctuation) => {
                    // Test implementation
                }
            ),
            testConfig
        );
    });
});
```

**Generator Strategies**:

```javascript
/**
 * Custom generators for property-based testing
 */
const generators = {
    fragmentWithWhitespace: fc.string().map(s => s.replace(/./g, c => c + ' '.repeat(fc.nat(3)))),
    speaker: fc.constantFrom('You', 'Interviewer'),
    conversationState: fc.constantFrom('IDLE', 'SUGGESTING', 'MONITORING', 'EVALUATING'),
    timestampSequence: fc.array(fc.integer({ min: 0, max: 5000 }))
        .map(deltas => deltas.reduce((acc, d) => [...acc, acc[acc.length-1] + d], [Date.now()]))
};
```

1. **Text Fragments**: Generate random strings with varying whitespace patterns
2. **Speaker Labels**: Generate from set ["You", "Interviewer", "System"]
3. **Timing Sequences**: Generate arrays of timestamps with varying intervals
4. **Buffer States**: Generate random buffer contents with word counts 0-20
5. **XML Tags**: Generate random tag names and nested structures

**Property Test Coverage**:

- All 15 correctness properties will have corresponding property-based tests
- Each test will be tagged with the property number and requirement reference
- Tests will use smart generators that constrain to valid input spaces
- Tests will avoid mocking where possible to test real behavior

### Integration Testing

Integration tests will verify end-to-end flows:

1. **Full Transcript Flow**: Audio → Correlation → Buffer → UI
2. **Context Injection Flow**: Transcript → Debounce → Context → AI
3. **Coaching Loop**: Question → Suggestion → User Response → Feedback
4. **RAG Integration**: Question → RAG Query → Context Enhancement
5. **Error Recovery**: Failure → Retry → Fallback

### Performance Testing

Performance tests will verify latency requirements:

1. **Debounce Latency**: Verify ≤ 500ms delay
2. **Buffer Flush Latency**: Verify ≤ 100ms to UI
3. **Context Injection**: Verify ≤ 1000ms API call
4. **RAG Query**: Verify ≤ 500ms query time

Performance tests are not property-based but use timing measurements and assertions.

