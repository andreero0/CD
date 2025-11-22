const fc = require('fast-check');

// Mock electron before importing gemini
const electronPath = require.resolve('electron');
require.cache[electronPath] = {
    exports: {
        BrowserWindow: {
            getAllWindows: vi.fn(() => [{ webContents: { send: vi.fn() } }]),
        },
        ipcMain: { handle: vi.fn(), on: vi.fn() },
        shell: { openExternal: vi.fn() },
    },
};

const { parsePracticeTags, getAdaptiveTimeout, countWords, shouldFlushBuffer, handleSpeakerChange } = require('../src/utils/gemini');

describe('AI Response Tag Parsing', () => {
    it('Property 10: Tag extraction correctness', () => {
        fc.assert(
            fc.property(
                fc.string(),
                (content) => {
                    const text = `<suggestion>${content}</suggestion>`;
                    const parsed = parsePracticeTags(text);

                    expect(parsed.suggestion).toBe(content.trim());
                    expect(parsed.feedback).toBeNull();
                    expect(parsed.raw).toBe(content.trim());
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 11: Unknown tag handling', () => {
        fc.assert(
            fc.property(
                fc.string(),
                fc.string(),
                (tagName, content) => {
                    // Only test truly unknown tags (not suggestion/feedback)
                    fc.pre(!['suggestion', 'feedback'].includes(tagName));

                    const text = `<${tagName}>${content}</${tagName}>`;
                    const parsed = parsePracticeTags(text);

                    // Unknown tags should remain in raw output
                    expect(parsed.suggestion).toBeNull();
                    expect(parsed.feedback).toBeNull();
                    expect(parsed.raw).toContain(content);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Additional manual test cases for specific examples
    it('extracts suggestion tag correctly', () => {
        const parsed = parsePracticeTags('<suggestion>test</suggestion>');
        expect(parsed.suggestion).toBe('test');
        expect(parsed.feedback).toBeNull();
        expect(parsed.raw).toBe('test');
    });

    it('extracts feedback tag correctly', () => {
        const parsed = parsePracticeTags('<feedback>good</feedback>');
        expect(parsed.suggestion).toBeNull();
        expect(parsed.feedback).toBe('good');
        expect(parsed.raw).toBe('good');
    });

    it('preserves unknown tags in raw output', () => {
        const parsed = parsePracticeTags('<unknown>data</unknown>');
        expect(parsed.suggestion).toBeNull();
        expect(parsed.feedback).toBeNull();
        expect(parsed.raw).toBe('<unknown>data</unknown>');
    });

    it('handles both suggestion and feedback tags together', () => {
        const parsed = parsePracticeTags('<suggestion>try this</suggestion> <feedback>well done</feedback>');
        expect(parsed.suggestion).toBe('try this');
        expect(parsed.feedback).toBe('well done');
        expect(parsed.raw).toBe('try this well done');
    });

    it('handles multiline content', () => {
        const parsed = parsePracticeTags('<suggestion>line 1\nline 2</suggestion>');
        expect(parsed.suggestion).toBe('line 1\nline 2');
        expect(parsed.raw).toBe('line 1\nline 2');
    });

    it('trims whitespace from extracted content', () => {
        const parsed = parsePracticeTags('<suggestion>  test  </suggestion>');
        expect(parsed.suggestion).toBe('test');
        expect(parsed.raw).toBe('test');
    });
});

describe('Adaptive Timeout Logic', () => {
    it('Property: Adaptive timeout selection based on state', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('IDLE', 'SUGGESTING', 'MONITORING', 'EVALUATING'),
                fc.integer({ min: 0, max: 20 }),
                (state, wordCount) => {
                    const timeout = getAdaptiveTimeout(state, wordCount);

                    if (wordCount < 3) {
                        expect(timeout).toBe(3000);
                    } else if (state === 'MONITORING') {
                        expect(timeout).toBe(3000);
                    } else {
                        expect(timeout).toBe(2000);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});

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
