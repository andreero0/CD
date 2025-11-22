# Exact Code Additions Summary

## File 1: `/home/user/CD/src/utils/gemini.js`

### Addition 1: MIN_WORD_THRESHOLD Constant (Line 80)
**Location**: After SLOW_START_TIMEOUT constant, before setCurrentProfile() function

```javascript
const MIN_WORD_THRESHOLD = 5;       // Minimum words before sending to UI
```

---

### Addition 2: countWords() Function (Lines 100-107)
**Location**: After getAdaptiveTimeout() function, before formatSpeakerResults() function

```javascript
/**
 * Counts words in text
 * @param {string} text - Text to count
 * @returns {number} - Word count
 */
function countWords(text) {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}
```

---

### Addition 3: shouldFlushBuffer() Function (Lines 109-132)
**Location**: After countWords() function, before handleSpeakerChange() function

```javascript
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
```

---

### Addition 4: handleSpeakerChange() Function (Lines 134-157)
**Location**: After shouldFlushBuffer() function, before formatSpeakerResults() function

```javascript
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
```

---

### Addition 5: Module Exports (Lines 1679-1681)
**Location**: In module.exports object, after normalizeText

```javascript
    countWords,
    shouldFlushBuffer,
    handleSpeakerChange,
```

---

## File 2: `/home/user/CD/tests/transcript-buffer.test.js`

### Addition 1: Updated Imports (Line 15)
**Before**:
```javascript
const { parsePracticeTags, getAdaptiveTimeout } = require('../src/utils/gemini');
```

**After**:
```javascript
const { parsePracticeTags, getAdaptiveTimeout, countWords, shouldFlushBuffer, handleSpeakerChange } = require('../src/utils/gemini');
```

---

### Addition 2: Property Test Suite (Lines 122-177)
**Location**: After "Adaptive Timeout Logic" describe block

```javascript
describe('Transcript Buffer Word Threshold', () => {
    it('Property 1: Minimum word threshold enforcement', () => {
        fc.assert(
            fc.property(
                fc.array(fc.string(), { minLength: 1, maxLength: 4 }), // < 5 words
                fc.boolean(), // has punctuation
                (words, hasPunctuation) => {
                    const text = words.join(' ') + (hasPunctuation ? '.' : '');
                    const wordCount = countWords(text);
                    const result = shouldFlushBuffer(text, Date.now() - 3000, 'IDLE');

                    if (hasPunctuation) {
                        // Always flush with punctuation
                        expect(result).toBe(true);
                    } else if (wordCount < 5) {
                        // Don't flush if < 5 words and no punctuation
                        expect(result).toBe(false);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 3: Speaker change flushes valid buffers', () => {
        fc.assert(
            fc.property(
                fc.array(fc.string(), { minLength: 5, maxLength: 10 }), // >= 5 words
                (words) => {
                    const buffer = words.join(' ');
                    const result = handleSpeakerChange(buffer, 'You', 'Interviewer');

                    expect(result.shouldFlush).toBe(true);
                    expect(result.shouldDiscard).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 4: Speaker change discards invalid buffers', () => {
        fc.assert(
            fc.property(
                fc.array(fc.string(), { minLength: 1, maxLength: 4 }), // < 5 words
                (words) => {
                    const buffer = words.join(' ');
                    const result = handleSpeakerChange(buffer, 'You', 'Interviewer');

                    expect(result.shouldFlush).toBe(false);
                    expect(result.shouldDiscard).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});
```

---

## Summary Statistics

- **Total lines added to gemini.js**: ~70 lines
- **Total lines added to tests**: ~60 lines
- **New functions**: 3 (countWords, shouldFlushBuffer, handleSpeakerChange)
- **New constants**: 1 (MIN_WORD_THRESHOLD)
- **New tests**: 3 property-based tests
- **Test iterations**: 300 total (100 per property test)

All code additions follow the existing code style and include comprehensive JSDoc documentation.
