# Transcript Buffering Configuration Guide

## Overview
All configuration constants are defined at the top of `/home/user/CD/src/utils/gemini.js`.

## Buffering Constants

### MIN_WORD_THRESHOLD = 5
- **Purpose:** Minimum words before sending transcript to UI
- **Impact:** Higher values reduce fragment spam, lower values improve responsiveness
- **Recommended range:** 3-10 words

### Timeout Constants

#### IDLE_TIMEOUT = 2000ms
- **When:** No active coaching, normal conversation
- **Purpose:** Standard pause detection
- **Impact:** Lower values = more responsive, higher values = fewer interruptions

#### MONITORING_TIMEOUT = 3000ms
- **When:** User is answering a question (MONITORING state)
- **Purpose:** Give user time to think without cutting off
- **Impact:** Should be higher than IDLE_TIMEOUT

#### SLOW_START_TIMEOUT = 3000ms
- **When:** User has spoken < 3 words
- **Purpose:** Prevent premature cutoff on slow starts
- **Impact:** Should match or exceed MONITORING_TIMEOUT

### Timeout Priority
1. If wordCount < 3 → SLOW_START_TIMEOUT (3s)
2. Else if state === MONITORING → MONITORING_TIMEOUT (3s)
3. Else → IDLE_TIMEOUT (2s)

## Context Injection Constants

### CONTEXT_DEBOUNCE_DELAY = 500ms
- **Purpose:** Prevent context injection spam
- **Impact:** Lower = more responsive, higher = fewer API calls

### CONTEXT_FALLBACK_TIMEOUT = 3000ms
- **Purpose:** Fallback timeout if no speaker changes
- **Impact:** Maximum time between context updates

### CONTEXT_MAX_SIZE = 1000 characters
- **Purpose:** Trigger immediate send for large buffers
- **Impact:** Prevents excessive debouncing on long conversations

### CONTEXT_HARD_LIMIT = 2000 characters
- **Purpose:** Hard truncation limit
- **Impact:** Prevents API payload overruns

### CONTEXT_TURN_HISTORY = 3 turns
- **Purpose:** Number of recent turns to include in context
- **Impact:** Higher = more context, lower = faster processing

## Audio Correlation Constants

### Cleanup Interval = 10000ms (10 seconds)
- **Purpose:** Remove expired correlation entries
- **Impact:** Prevents memory leaks

### Queue Overflow Threshold = 100 entries
- **Purpose:** Warn about correlation drift
- **Impact:** Detection of audio/transcript mismatch

## RAG Integration Constants

### Word Count Threshold = 10 words
- **Purpose:** Only query RAG for substantial questions
- **Impact:** Higher = fewer RAG queries, lower = more context

### RAG Query Parameters
- **topK:** 5 (number of results)
- **minScore:** 0.6 (minimum similarity)
- **maxTokens:** 400 (max context size)

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Debounce latency | ≤ 500ms | 500ms |
| Buffer flush to UI | ≤ 100ms | < 50ms |
| Context injection | ≤ 1000ms | < 200ms |
| RAG query | ≤ 500ms | 50-200ms |

## Tuning Guide

### For More Responsive UI
- Decrease MIN_WORD_THRESHOLD to 3
- Decrease IDLE_TIMEOUT to 1500ms
- Decrease CONTEXT_DEBOUNCE_DELAY to 300ms

### For More Stable Experience
- Increase MIN_WORD_THRESHOLD to 7
- Increase MONITORING_TIMEOUT to 4000ms
- Increase CONTEXT_DEBOUNCE_DELAY to 700ms

### For Lower API Usage
- Increase CONTEXT_DEBOUNCE_DELAY to 1000ms
- Increase CONTEXT_FALLBACK_TIMEOUT to 5000ms
- Decrease CONTEXT_TURN_HISTORY to 2

## Environment-Specific Configuration

### Development
```javascript
const MIN_WORD_THRESHOLD = 3;  // More responsive for testing
const IDLE_TIMEOUT = 1500;
```

### Production
```javascript
const MIN_WORD_THRESHOLD = 5;  // Stable default
const IDLE_TIMEOUT = 2000;
```

### Testing
```javascript
const MIN_WORD_THRESHOLD = 1;  // Test all cases
const IDLE_TIMEOUT = 100;  // Fast timeouts
```
