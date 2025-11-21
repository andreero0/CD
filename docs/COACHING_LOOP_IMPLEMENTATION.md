# Coaching Feedback Loop & Conversation State Machine

## Overview

This document describes the implementation of the coaching feedback loop and conversation state machine that enables the AI to track suggestions and monitor user adherence in real-time.

## Problem Statement

The teleprompter + coach system was sending suggestions to users but had no memory of those suggestions when users spoke. This broke the "monitoring and correction" workflow because:

1. The AI would suggest something to the user
2. The user would speak and try to follow the suggestion
3. The AI had no memory of what it just suggested
4. The AI couldn't provide intelligent feedback or corrections

## Solution Architecture

### Components

1. **ConversationStateMachine** (`/home/user/CD/src/utils/conversationState.js`)
   - Tracks conversation state using a finite state machine
   - Stores current suggestions and responses
   - Calculates adherence scores
   - Maintains turn history

2. **Gemini Integration** (`/home/user/CD/src/utils/gemini.js`)
   - Tracks AI suggestions when generated
   - Compares user responses against suggestions
   - Injects suggestion context into AI prompts
   - Manages state transitions

3. **Prompt Updates** (`/home/user/CD/src/utils/prompts.js`)
   - Updated interview and sales prompts
   - Added explicit tracking workflow instructions
   - Clarified AI's monitoring responsibilities

## State Machine

### States

```javascript
IDLE        // No active conversation
SUGGESTING  // AI just provided a suggestion
MONITORING  // User is speaking, AI is monitoring
EVALUATING  // AI is evaluating user's response
```

### State Transitions

```
IDLE → SUGGESTING (when AI generates suggestion)
SUGGESTING → MONITORING (when user speaks)
MONITORING → SUGGESTING (when AI provides feedback/new suggestion)
[any state] → IDLE (on reset/new session)
```

## Implementation Details

### 1. ConversationStateMachine Class

**File**: `/home/user/CD/src/utils/conversationState.js`

#### Key Methods

- `trackSuggestion(text, speaker)`: Records a new AI suggestion
  - Stores: text, timestamp, speaker, turnId
  - Transitions to SUGGESTING state
  - Returns suggestion object

- `compareResponse(actualText)`: Compares user speech against suggestion
  - Calculates adherence score (0-100)
  - Transitions to MONITORING state
  - Returns comparison object with adherence analysis

- `getCurrentSuggestion()`: Retrieves the current suggestion
  - Used by gemini.js to inject context into AI prompts

- `reset()`: Clears all state
  - Called when starting new sessions
  - Returns to IDLE state

- `getTurnHistory()`: Returns last 10 conversation turns
  - Useful for debugging and analysis

#### Adherence Calculation

The adherence score is calculated using word overlap:

```javascript
// Normalize both texts (lowercase, remove punctuation)
// Calculate word set intersection
// Score = average of (overlap/suggested_words, overlap/actual_words)
// Range: 0-100%
```

**Scoring Thresholds**:
- 80-100%: Excellent adherence
- 60-79%: Good adherence
- 40-59%: Moderate adherence
- 20-39%: Low adherence
- 0-19%: Minimal adherence

### 2. Gemini.js Integration

**File**: `/home/user/CD/src/utils/gemini.js`

#### Changes Made

1. **Import Statement** (line 7):
```javascript
const { conversationState, STATES } = require('./conversationState');
```

2. **Session Initialization** (lines 91):
```javascript
// Reset conversation state machine for new session
conversationState.reset();
```

3. **Input Transcription Handler** (lines 405-411):
```javascript
// COACHING FEEDBACK LOOP: When user speaks, compare against suggestion
if (speaker === 'You') {
    const comparison = conversationState.compareResponse(newTranscript);
    if (comparison && comparison.hasSuggestion) {
        console.log(`[Coaching] User adherence: ${comparison.adherence}% - ${comparison.analysis}`);
    }
}
```

4. **Context Injection** (lines 425-429):
```javascript
// COACHING FEEDBACK LOOP: Add last suggestion to context
const currentSuggestion = conversationState.getCurrentSuggestion();
if (currentSuggestion) {
    contextMessage += `\n<lastSuggestion>\nYou suggested: "${currentSuggestion.text}"\nTurn ID: ${currentSuggestion.turnId}\nTime: ${new Date(currentSuggestion.timestamp).toISOString()}\n</lastSuggestion>`;
}
```

5. **Suggestion Tracking** (lines 473-476):
```javascript
// COACHING FEEDBACK LOOP: Track AI suggestion when generation is complete
if (messageBuffer && messageBuffer.trim().length > 0) {
    conversationState.trackSuggestion(messageBuffer.trim(), 'AI Coach');
}
```

### 3. Prompt Updates

**File**: `/home/user/CD/src/utils/prompts.js`

#### Interview Profile (lines 31-40)

Added **TRACKING WORKFLOW** section:

```markdown
**TRACKING WORKFLOW - HOW YOU MONITOR THE CANDIDATE:**
1. **When you suggest something**: The system tracks your suggestion automatically
2. **When [You] speaks**: The system compares their words to your suggestion and calculates adherence
3. **You receive context**: Your previous suggestion is provided to you in `<lastSuggestion>` tags
4. **Your responsibility**:
   - If adherence is good (they followed your advice) → acknowledge briefly ("Good!")
   - If adherence is poor (they went off-script) → correct immediately ("Say this instead: ...")
   - If they missed key points → remind them ("Add: [missing point]")
```

#### Sales Profile (lines 142-150)

Added similar **TRACKING WORKFLOW** section with sales-specific guidance.

## Data Flow

### Suggestion Flow

```
1. Interviewer asks question
2. AI generates suggestion
   ↓
3. gemini.js receives modelTurn.parts
   ↓
4. On generationComplete:
   - conversationState.trackSuggestion(messageBuffer)
   - State: IDLE → SUGGESTING
   ↓
5. Suggestion stored with metadata:
   {
     text: "I'm a software engineer with...",
     timestamp: 1700000000000,
     speaker: "AI Coach",
     turnId: 1
   }
```

### Response Comparison Flow

```
1. User speaks (microphone audio)
   ↓
2. gemini.js receives inputTranscription
3. Speaker identified as "You"
   ↓
4. conversationState.compareResponse(transcript)
   - State: SUGGESTING → MONITORING
   - Calculate adherence score
   ↓
5. Comparison logged:
   "[Coaching] User adherence: 65% - Good adherence"
   ↓
6. Context sent to AI every 3 seconds:
   <context>
   [Interviewer]: Tell me about yourself
   [You]: I'm a software engineer...
   </context>
   <lastSuggestion>
   You suggested: "I'm a software engineer with 5 years..."
   Turn ID: 1
   Time: 2024-01-01T00:00:00.000Z
   </lastSuggestion>
```

## Edge Cases Handled

### 1. Empty or Invalid Input

**Problem**: What if suggestion/response is empty?
**Solution**: Defensive validation in `trackSuggestion()` and `compareResponse()`

```javascript
if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.warn('[State Machine] Attempted to track empty suggestion');
    return null;
}
```

### 2. No Suggestion to Compare Against

**Problem**: User speaks before AI has made any suggestion
**Solution**: `compareResponse()` checks for existence of currentSuggestion

```javascript
if (!this.currentSuggestion) {
    console.warn('[State Machine] No current suggestion to compare against');
    return {
        actualText: actualText.trim(),
        timestamp: Date.now(),
        adherence: 0,
        analysis: 'No suggestion available to compare',
        hasSuggestion: false,
    };
}
```

### 3. Memory Management

**Problem**: Turn history could grow unbounded
**Solution**: Limited to last 10 turns

```javascript
// Keep history limited to last 10 turns
if (this.turnHistory.length > 10) {
    this.turnHistory.shift();
}
```

### 4. Session Boundaries

**Problem**: State persists across sessions
**Solution**: Reset state on new session initialization

```javascript
async function initializeNewSession() {
    // ... existing code ...
    conversationState.reset();
    // ... existing code ...
}
```

### 5. Error Handling in Adherence Calculation

**Problem**: Calculation could fail with invalid input
**Solution**: Try-catch with fallback

```javascript
try {
    // ... calculation logic ...
    return Math.round(Math.min(100, Math.max(0, adherence)));
} catch (error) {
    console.error('[State Machine] Error calculating adherence:', error);
    return 0;
}
```

### 6. Async Context Injection

**Problem**: sendRealtimeInput might not return a Promise
**Solution**: Defensive promise handling

```javascript
if (promise && typeof promise.catch === 'function') {
    promise.catch(err => {
        console.error('Failed to send speaker context:', err);
    });
} else {
    console.warn('[Speaker Context] sendRealtimeInput did not return a Promise');
}
```

## Testing

### Manual Testing Recommendations

1. **Basic Flow Test**
   ```
   1. Start interview session
   2. Interviewer asks: "Tell me about yourself"
   3. Verify AI provides suggestion
   4. User repeats suggestion closely
   5. Check console: Should show high adherence (>80%)
   6. Verify AI acknowledges: "Good!"
   ```

2. **Off-Script Test**
   ```
   1. Interviewer asks question
   2. AI provides suggestion
   3. User says something completely different
   4. Check console: Should show low adherence (<40%)
   5. Verify AI corrects: "Say this instead: ..."
   ```

3. **State Persistence Test**
   ```
   1. Start session (state: IDLE)
   2. AI suggests something (state: SUGGESTING)
   3. User speaks (state: MONITORING)
   4. AI responds (state: SUGGESTING)
   5. Verify state transitions logged in console
   ```

4. **Session Reset Test**
   ```
   1. Have a conversation (multiple turns)
   2. Start new session
   3. Verify state reset to IDLE
   4. Verify currentSuggestion is null
   5. Verify history is cleared
   ```

### Automated Testing

A basic test is included in the implementation report. To run:

```bash
node -e "const { conversationState, STATES } = require('./src/utils/conversationState.js'); /* test code */"
```

### Integration Testing

The existing test suite should pass without modification:

```bash
npm test
```

Specifically, `geminiConversation.test.js` tests the core conversation functions and should work with the new state machine since `reset()` is called in `initializeNewSession()`.

## Console Debugging

### State Machine Logs

All state machine operations are logged with `[State Machine]` prefix:

```
[State Machine] IDLE → SUGGESTING
[State Machine] Tracked suggestion #1: "I'm a software engineer with..."
[State Machine] SUGGESTING → MONITORING
[State Machine] Response adherence: 65%
[State Machine] Reset to initial state
```

### Coaching Logs

Comparison results are logged with `[Coaching]` prefix:

```
[Coaching] User adherence to suggestion: 85% - Excellent adherence - user followed suggestion very closely
[Coaching] User adherence to suggestion: 35% - Low adherence - user deviated significantly from suggestion
```

### Context Logs

Context injection is logged with `[Speaker Context]` prefix:

```
[Speaker Context] Sent to AI with suggestion tracking
```

## Performance Considerations

### Memory Usage

- **Turn History**: Limited to 10 turns (~10KB)
- **Current Suggestion**: Single object (~1KB)
- **State**: Minimal (few bytes)
- **Total**: ~11KB per session

### CPU Usage

- **Adherence Calculation**: O(n+m) where n,m are word counts
  - Typical: <1ms for normal sentences
- **State Transitions**: O(1)
- **Context Injection**: O(1)

### Network Impact

- Context sent every 3 seconds (existing behavior)
- Adds ~100-200 bytes to context message
- Negligible impact on bandwidth

## Future Enhancements

### Potential Improvements

1. **Advanced Adherence Algorithms**
   - Use semantic similarity (embeddings) instead of word overlap
   - Account for paraphrasing and synonyms
   - Consider sentence structure and key points

2. **Adherence History Analytics**
   - Track average adherence over time
   - Identify patterns in user deviations
   - Suggest personalized coaching adjustments

3. **Multi-turn Tracking**
   - Track adherence across multiple exchanges
   - Detect when user gets back on track
   - Identify persistent misconceptions

4. **Visual Feedback**
   - Display adherence score in UI
   - Highlight matched/missed phrases
   - Show state machine status indicator

5. **Export and Replay**
   - Save turn history to database
   - Replay coaching sessions
   - Generate adherence reports

## Troubleshooting

### Issue: State machine not tracking suggestions

**Symptom**: No logs with `[State Machine]` prefix
**Cause**: conversationState not imported properly
**Solution**: Verify `require('./conversationState')` in gemini.js

### Issue: Adherence always 0%

**Symptom**: All comparisons show 0% adherence
**Cause**: Suggestion not being tracked before comparison
**Solution**: Check that `trackSuggestion()` is called on generationComplete

### Issue: Context not injected

**Symptom**: AI doesn't reference previous suggestions
**Cause**: `<lastSuggestion>` tags not sent to AI
**Solution**: Check CONTEXT_SEND_INTERVAL (3000ms) and verify sendRealtimeInput

### Issue: State persists across sessions

**Symptom**: Old suggestions appear in new sessions
**Cause**: `reset()` not called on new session
**Solution**: Verify `initializeNewSession()` calls `conversationState.reset()`

## File Summary

### Files Modified

1. **`/home/user/CD/src/utils/conversationState.js`** (NEW)
   - 323 lines
   - Implements ConversationStateMachine class
   - Exports singleton instance and STATES enum

2. **`/home/user/CD/src/utils/gemini.js`** (MODIFIED)
   - Added import (line 7)
   - Added reset call (line 91)
   - Added comparison logic (lines 405-411)
   - Added context injection (lines 425-429)
   - Added tracking logic (lines 473-476)
   - Total: 5 integration points

3. **`/home/user/CD/src/utils/prompts.js`** (MODIFIED)
   - Updated interview profile (lines 31-40)
   - Updated sales profile (lines 142-150)
   - Total: 2 sections added

### No Breaking Changes

- All existing functionality preserved
- Existing tests should pass without modification
- Backward compatible with current UI
- Optional feature (works even if AI ignores context)

## Conclusion

The coaching feedback loop implementation successfully addresses the core issue of AI memory loss between suggestions and responses. The state machine provides a clean, maintainable architecture for tracking conversation flow, and the integration with gemini.js is minimal and non-invasive.

The system now enables:
- ✅ AI tracks what it suggests
- ✅ AI knows what user actually said
- ✅ AI can provide intelligent corrections
- ✅ Real-time monitoring and feedback
- ✅ Persistent state across conversation turns
- ✅ Clean reset between sessions

This implementation serves as a foundation for more advanced coaching features and analytics in the future.
