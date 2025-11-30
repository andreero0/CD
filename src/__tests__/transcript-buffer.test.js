// Vitest globals are available without import
const fc = require('fast-check');
const { normalizeText } = require('../utils/gemini');

describe('Transcript Buffering Properties', () => {
    describe('Property 2: Text normalization preserves content', () => {
        it('removes double spaces', () => {
            fc.assert(
                fc.property(
                    fc.string(),
                    (text) => {
                        const normalized = normalizeText(text);
                        // Verify no double spaces (unless string is empty or whitespace-only)
                        if (normalized.length > 0) {
                            expect(normalized).not.toMatch(/  /);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('removes space before punctuation', () => {
            fc.assert(
                fc.property(
                    fc.string(),
                    (text) => {
                        const normalized = normalizeText(text);
                        // Verify no space before common punctuation
                        expect(normalized).not.toMatch(/ [.,!?]/);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('removes leading and trailing whitespace', () => {
            fc.assert(
                fc.property(
                    fc.string(),
                    (text) => {
                        const normalized = normalizeText(text);
                        // Verify trimmed (no leading/trailing whitespace)
                        if (normalized.length > 0) {
                            expect(normalized).toBe(normalized.trim());
                            expect(normalized[0]).not.toMatch(/\s/);
                            expect(normalized[normalized.length - 1]).not.toMatch(/\s/);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('converts tabs to spaces', () => {
            fc.assert(
                fc.property(
                    fc.string(),
                    (text) => {
                        const normalized = normalizeText(text);
                        // Verify no tabs remain
                        expect(normalized).not.toMatch(/\t/);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('converts Unicode spaces to ASCII spaces', () => {
            fc.assert(
                fc.property(
                    fc.string(),
                    (text) => {
                        const normalized = normalizeText(text);
                        // Verify no Unicode spaces remain (U+2000-U+200B, U+202F, U+205F, U+3000)
                        expect(normalized).not.toMatch(/[\u2000-\u200B\u202F\u205F\u3000]/);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('limits consecutive newlines to maximum of 2', () => {
            fc.assert(
                fc.property(
                    fc.string(),
                    (text) => {
                        const normalized = normalizeText(text);
                        // Verify no more than 2 consecutive newlines
                        expect(normalized).not.toMatch(/\n{3,}/);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('is idempotent - normalizing twice gives same result', () => {
            fc.assert(
                fc.property(
                    fc.string(),
                    (text) => {
                        const normalized1 = normalizeText(text);
                        const normalized2 = normalizeText(normalized1);
                        // Normalizing an already normalized string should not change it
                        expect(normalized1).toBe(normalized2);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Edge cases and specific scenarios', () => {
        it('handles empty string', () => {
            expect(normalizeText('')).toBe('');
        });

        it('handles whitespace-only strings', () => {
            expect(normalizeText('   ')).toBe('');
            expect(normalizeText('\t\t')).toBe('');
            expect(normalizeText('\n\n\n')).toBe('');
        });

        it('preserves single spaces between words', () => {
            expect(normalizeText('hello world')).toBe('hello world');
        });

        it('removes multiple spaces between words', () => {
            expect(normalizeText('hello    world')).toBe('hello world');
        });

        it('removes space before punctuation', () => {
            expect(normalizeText('hello , world')).toBe('hello, world');
            expect(normalizeText('hello . world')).toBe('hello. world');
            expect(normalizeText('hello ! world')).toBe('hello! world');
            expect(normalizeText('hello ? world')).toBe('hello? world');
        });

        it('converts tabs to single spaces', () => {
            expect(normalizeText('hello\tworld')).toBe('hello world');
            expect(normalizeText('hello\t\tworld')).toBe('hello world');
        });

        it('converts Unicode spaces to ASCII', () => {
            expect(normalizeText('hello\u2000world')).toBe('hello world'); // en quad
            expect(normalizeText('hello\u3000world')).toBe('hello world'); // ideographic space
        });

        it('limits consecutive newlines', () => {
            expect(normalizeText('hello\n\n\nworld')).toBe('hello\n\nworld');
            expect(normalizeText('hello\n\n\n\n\nworld')).toBe('hello\n\nworld');
        });

        it('preserves speaker labels format', () => {
            expect(normalizeText('[Interviewer]: Hello, how are you?'))
                .toBe('[Interviewer]: Hello, how are you?');
            expect(normalizeText('[You]:   I am  fine , thank you!'))
                .toBe('[You]: I am fine, thank you!');
        });

        it('handles mixed whitespace types', () => {
            expect(normalizeText('  hello \t world  \n\n\n  test  '))
                .toBe('hello world\n\ntest');
        });

        it('removes spaces around newlines', () => {
            expect(normalizeText('hello \nworld')).toBe('hello\nworld');
            expect(normalizeText('hello\n world')).toBe('hello\nworld');
            expect(normalizeText('hello \n world')).toBe('hello\nworld');
        });

        it('handles complex real-world example', () => {
            const input = '[Interviewer]:  Tell   me  about  yourself .\n\n\n[You]:   I am   a software  engineer , with  5  years  of  experience !';
            const expected = '[Interviewer]: Tell me about yourself.\n\n[You]: I am a software engineer, with 5 years of experience!';
            expect(normalizeText(input)).toBe(expected);
        });
    });

    describe('Custom generators for transcript text', () => {
        // Generator for speaker labels
        const speakerLabel = fc.constantFrom(
            '[Interviewer]',
            '[You]',
            '[Manager]',
            '[Prospect]'
        );

        // Generator for transcript segments with speaker labels
        const transcriptSegment = fc.tuple(
            speakerLabel,
            fc.lorem({ maxCount: 10 })
        ).map(([speaker, text]) => `${speaker}: ${text}`);

        it('handles generated transcript segments', () => {
            fc.assert(
                fc.property(
                    transcriptSegment,
                    (segment) => {
                        const normalized = normalizeText(segment);
                        // Should still contain speaker label
                        expect(normalized).toMatch(/^\[.*?\]:/);
                        // Should not have excessive whitespace
                        expect(normalized).not.toMatch(/  /);
                    }
                ),
                { numRuns: 100 }
            );
        });

        // Generator for multiple segments (simulating a conversation)
        const conversation = fc.array(transcriptSegment, { minLength: 1, maxLength: 10 })
            .map(segments => segments.join('\n\n'));

        it('handles generated multi-turn conversations', () => {
            fc.assert(
                fc.property(
                    conversation,
                    (conv) => {
                        const normalized = normalizeText(conv);
                        // Should preserve structure but normalize whitespace
                        expect(normalized).not.toMatch(/  /);
                        expect(normalized).not.toMatch(/\n{3,}/);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
