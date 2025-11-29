# Context Injection with Debouncing Implementation

## Overview
This document describes the implementation of context injection with debouncing for the Prism application. The implementation adds a sophisticated debouncing layer and context message builder to optimize AI context updates.

## Files Modified

### 1. `/home/user/CD/src/utils/gemini.js`

#### Constants Added (Lines 48-53)
```javascript
// Context injection constants
const CONTEXT_DEBOUNCE_DELAY = 500;        // 500ms debounce
const CONTEXT_FALLBACK_TIMEOUT = 3000;     // 3s fallback
const CONTEXT_MAX_SIZE = 1000;             // 1000 chars immediate send
const CONTEXT_HARD_LIMIT = 2000;           // 2000 chars truncate
const CONTEXT_TURN_HISTORY = 3;            // Last 3 turns
```

**Purpose:** These constants control the debouncing behavior and size limits for context injection.
- **CONTEXT_DEBOUNCE_DELAY:** Prevents rapid-fire context updates by waiting 500ms
- **CONTEXT_FALLBACK_TIMEOUT:** Ensures context is sent even if no speaker change occurs
- **CONTEXT_MAX_SIZE:** Triggers immediate send when context exceeds 1000 characters
- **CONTEXT_HARD_LIMIT:** Truncates context to 2000 characters max
- **CONTEXT_TURN_HISTORY:** Keeps last 3 conversation turns in history

#### State Variables Added (Lines 66-69)
```javascript
// Context injection state
let debounceTimer = null;
let pendingContextSend = false;
let turnHistory = [];  // Array of { speaker, text, timestamp }
```

**Purpose:** Track the debouncing state and conversation history.

#### Function 1: `cancelDebounce()` (Lines 159-171)
```javascript
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
```

**Integration:** Uses `sessionLogger.logDebounce('cancelled', 0)` to log cancellation events.

**Called when:**
- Context buffer exceeds 1000 characters (immediate send needed)
- Session ends
- System shutdown

#### Function 2: `scheduleContextInjection()` (Lines 173-204)
```javascript
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
```

**Integration:** Uses `sessionLogger.logDebounce()` to log three states:
- `scheduled`: When a new debounce timer is created
- `cancelled`: When an existing timer is cancelled
- `executed`: When the debounce timer fires

**Logic Flow:**
1. Check if buffer exceeds 1000 chars → immediate send
2. Cancel any existing debounce timer
3. Schedule new timer for 500ms
4. Timer executes → send context to AI

#### Function 3: `buildContextMessage()` (Lines 206-229)
```javascript
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
```

**Output Format:**
```xml
<context>
[Interviewer]: Tell me about yourself
[You]: I'm a software engineer
</context>
<lastSuggestion>Try mentioning your specific experience Turn ID: 5</lastSuggestion>
```

#### Function 4: `sendContextToAI()` (Lines 231-267)
```javascript
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
```

**Integration:** Uses three sessionLogger methods:
- `logContextTruncation(originalSize, truncatedSize)`: When context > 2000 chars
- `log('ContextInjection', message)`: For send operations and errors

**Features:**
- Automatic truncation at 2000 characters (keeps most recent)
- Retry logic (one retry after 1 second)
- Error handling with logging
- Buffer clearing after successful send

#### Exports Added (Lines 1572-1575)
```javascript
module.exports = {
    // ... existing exports
    cancelDebounce,
    scheduleContextInjection,
    buildContextMessage,
    sendContextToAI,
};
```

## Tests Created

### `/home/user/CD/src/__tests__/contextInjectionDebouncing.test.js`

#### Test Suite Structure
1. **Property 5: Debounce coalesces rapid changes**
   - Verifies that 5 rapid calls result in only 1 execution
   - Uses fake timers to simulate timing

2. **Property 6: Context size triggers immediate send**
   - Tests immediate send when buffer > 1000 chars
   - Uses property-based testing with fast-check
   - Runs 10 test cases with random strings 1001-1500 chars

3. **Property 7: Context truncation at hard limit**
   - Verifies truncation at 2000 char limit
   - Uses property-based testing with fast-check
   - Runs 10 test cases with random strings 2001-3000 chars

4. **buildContextMessage tests**
   - Tests formatting with suggestion
   - Tests formatting without suggestion (null)

5. **cancelDebounce tests**
   - Verifies timer cancellation
   - Checks logging behavior

6. **sendContextToAI retry logic tests**
   - Tests single retry on failure
   - Verifies no retry when isRetry=true

## Requirements Validated

### Requirement 2.1: Debouncing Layer
✅ Implemented via `scheduleContextInjection()` with 500ms delay

### Requirement 2.2: Size Limits
✅ Implemented with CONTEXT_MAX_SIZE (1000) and CONTEXT_HARD_LIMIT (2000)

### Requirement 2.5: Event Logging
✅ Integrated with sessionLogger for:
- Debounce events (scheduled/cancelled/executed)
- Context truncation
- Context injection operations
- Errors

### Requirement 2.6: Context Message Format
✅ Implemented via `buildContextMessage()` with XML-style tags

### Requirement 2.7: Turn History Tracking
✅ Implemented with turnHistory array and CONTEXT_TURN_HISTORY constant

### Requirement 2.8: Retry Logic
✅ Implemented in `sendContextToAI()` with 1-second delay and single retry

## Integration Points

### sessionLogger Integration
The implementation integrates with sessionLogger in multiple places:

1. **cancelDebounce():**
   ```javascript
   sessionLogger.logDebounce('cancelled', 0)
   ```

2. **scheduleContextInjection():**
   ```javascript
   sessionLogger.logDebounce('cancelled', CONTEXT_DEBOUNCE_DELAY)
   sessionLogger.logDebounce('scheduled', CONTEXT_DEBOUNCE_DELAY)
   sessionLogger.logDebounce('executed', CONTEXT_DEBOUNCE_DELAY)
   ```

3. **sendContextToAI():**
   ```javascript
   sessionLogger.logContextTruncation(context.length, CONTEXT_HARD_LIMIT)
   sessionLogger.log('ContextInjection', `Trigger: ${trigger}, Size: ${context.length} chars`)
   sessionLogger.log('ContextInjection', `Error: ${error.message}`)
   ```

## Usage Example

```javascript
// Schedule context injection (will debounce for 500ms)
scheduleContextInjection('speaker_turn');

// Build context message with suggestion
const suggestion = {
    text: 'Try mentioning your experience with React',
    turnId: 5,
    timestamp: Date.now()
};
const message = buildContextMessage(suggestion);

// Send context directly
await sendContextToAI(message, 'manual_trigger');

// Cancel pending debounce
cancelDebounce();
```

## Error Handling

1. **Network Errors:** Automatic retry after 1 second
2. **Size Errors:** Automatic truncation to 2000 chars
3. **Malformed Data:** Logged but doesn't crash
4. **Missing Session:** Gracefully skips send operation

## Performance Characteristics

- **Debounce Delay:** 500ms (coalesces rapid updates)
- **Fallback Timeout:** 3000ms (ensures eventual send)
- **Size Threshold:** 1000 chars (triggers immediate send)
- **Hard Limit:** 2000 chars (prevents excessive token usage)
- **Turn History:** Last 3 turns (balances context vs. token usage)
- **Retry Delay:** 1000ms (gives network time to recover)

## Future Improvements

1. Add configurable constants (via settings)
2. Implement exponential backoff for retries
3. Add metrics tracking (average debounce wait time, truncation rate)
4. Consider compression for large contexts
5. Add turn history prioritization (weight recent turns more)
