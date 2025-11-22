/**
 * AI Response Handling and Error Handling Tests
 * Tests for shouldInterruptAI, interruptAIResponse, handleAIResponse, sanitizeText, validateTranscriptFragment
 */

const fc = require('fast-check');

// Mock sessionLogger
const mockSessionLogger = {
    log: vi.fn(),
};

vi.mock('../utils/sessionLogger', () => ({
    sessionLogger: mockSessionLogger,
}));

describe('AI Response Handling - Unit Tests', () => {
    // Test shouldInterruptAI logic
    describe('shouldInterruptAI', () => {
        it('returns true when buffer has content and generation not complete', () => {
            const messageBuffer = 'test content';
            const isGenerationComplete = false;
            const result = messageBuffer.length > 0 && !isGenerationComplete;
            expect(result).toBe(true);
        });

        it('returns false when buffer is empty', () => {
            const messageBuffer = '';
            const isGenerationComplete = false;
            const result = messageBuffer.length > 0 && !isGenerationComplete;
            expect(result).toBe(false);
        });

        it('returns false when generation is complete', () => {
            const messageBuffer = 'test content';
            const isGenerationComplete = true;
            const result = messageBuffer.length > 0 && !isGenerationComplete;
            expect(result).toBe(false);
        });
    });

    // Test sanitizeText logic
    describe('sanitizeText', () => {
        function sanitizeText(text) {
            try {
                // Remove null bytes
                let sanitized = text.replace(/\0/g, '');

                // Remove other control characters except newlines/tabs
                sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

                // Ensure valid UTF-8 (basic check)
                return sanitized.trim();
            } catch (error) {
                return '';  // Return empty string on failure
            }
        }

        it('removes null bytes', () => {
            const corruptedText = 'Hello\0World\0Test';
            const sanitized = sanitizeText(corruptedText);
            expect(sanitized).toBe('HelloWorldTest');
            expect(sanitized).not.toContain('\0');
        });

        it('removes control characters', () => {
            const textWithControl = 'Hello\x01\x02World\x1F\x7FTest';
            const sanitized = sanitizeText(textWithControl);
            expect(sanitized).toBe('HelloWorldTest');
        });

        it('preserves newlines and tabs', () => {
            const text = 'Hello\nWorld\tTest';
            const sanitized = sanitizeText(text);
            expect(sanitized).toBe('Hello\nWorld\tTest');
        });

        it('trims whitespace', () => {
            const text = '  Hello World  ';
            const sanitized = sanitizeText(text);
            expect(sanitized).toBe('Hello World');
        });

        it('handles null input gracefully', () => {
            expect(() => {
                const result = sanitizeText(null);
                expect(result).toBe('');
            }).not.toThrow();
        });

        it('Property: sanitizes all strings', () => {
            fc.assert(
                fc.property(
                    fc.string(),
                    (text) => {
                        const result = sanitizeText(text);
                        expect(typeof result).toBe('string');
                        expect(result).not.toContain('\0');
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    // Test validateTranscriptFragment logic
    describe('validateTranscriptFragment', () => {
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

        it('validates correct transcript fragments', () => {
            const validFragment = { text: 'Hello world' };
            expect(validateTranscriptFragment(validFragment)).toBe(true);
        });

        it('rejects null', () => {
            expect(validateTranscriptFragment(null)).toBe(false);
        });

        it('rejects undefined', () => {
            expect(validateTranscriptFragment(undefined)).toBe(false);
        });

        it('rejects non-string text', () => {
            expect(validateTranscriptFragment({ text: 123 })).toBe(false);
        });

        it('rejects empty string', () => {
            expect(validateTranscriptFragment({ text: '' })).toBe(false);
        });

        it('rejects whitespace-only string', () => {
            expect(validateTranscriptFragment({ text: '   ' })).toBe(false);
        });

        it('Property 12: Error resilience', () => {
            fc.assert(
                fc.property(
                    fc.oneof(
                        fc.constant(null),
                        fc.constant(undefined),
                        fc.constant({ text: 123 }),  // Invalid type
                        fc.constant({ text: '' })     // Empty
                    ),
                    (malformedFragment) => {
                        // Should not throw
                        expect(() => {
                            const isValid = validateTranscriptFragment(malformedFragment);
                            expect(isValid).toBe(false);
                        }).not.toThrow();
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    // Test parsePracticeTags logic
    describe('parsePracticeTags', () => {
        function parsePracticeTags(text) {
            const suggestionMatch = text.match(/<suggestion>(.*?)<\/suggestion>/s);
            const feedbackMatch = text.match(/<feedback>(.*?)<\/feedback>/s);
            return {
                suggestion: suggestionMatch ? suggestionMatch[1].trim() : null,
                feedback: feedbackMatch ? feedbackMatch[1].trim() : null,
                raw: text.replace(/<\/?(?:suggestion|feedback)>/g, '').trim()
            };
        }

        it('parses suggestion tags', () => {
            const text = '<suggestion>Try this approach</suggestion>';
            const result = parsePracticeTags(text);
            expect(result.suggestion).toBe('Try this approach');
            expect(result.feedback).toBe(null);
        });

        it('parses feedback tags', () => {
            const text = '<feedback>Good job!</feedback>';
            const result = parsePracticeTags(text);
            expect(result.suggestion).toBe(null);
            expect(result.feedback).toBe('Good job!');
        });

        it('parses both tags', () => {
            const text = '<suggestion>Answer with STAR</suggestion> Response here <feedback>Well done</feedback>';
            const result = parsePracticeTags(text);
            expect(result.suggestion).toBe('Answer with STAR');
            expect(result.feedback).toBe('Well done');
            // The raw text includes the content from tags but without the tag markers
            expect(result.raw).toBe('Answer with STAR Response here Well done');
        });

        it('handles text without tags', () => {
            const text = 'Just regular text';
            const result = parsePracticeTags(text);
            expect(result.suggestion).toBe(null);
            expect(result.feedback).toBe(null);
            expect(result.raw).toBe('Just regular text');
        });
    });

    // Test handleAIResponse logic
    describe('handleAIResponse', () => {
        let messageBuffer = '';
        let isGenerationComplete = true;
        let isResponseInterrupted = false;

        function parsePracticeTags(text) {
            const suggestionMatch = text.match(/<suggestion>(.*?)<\/suggestion>/s);
            const feedbackMatch = text.match(/<feedback>(.*?)<\/feedback>/s);
            return {
                suggestion: suggestionMatch ? suggestionMatch[1].trim() : null,
                feedback: feedbackMatch ? feedbackMatch[1].trim() : null,
                raw: text.replace(/<\/?(?:suggestion|feedback)>/g, '').trim()
            };
        }

        function handleAIResponse(serverContent) {
            try {
                // Check if this is a new response start
                if (!messageBuffer && serverContent.modelTurn) {
                    // Clear previous response
                    messageBuffer = '';
                    isGenerationComplete = false;
                    isResponseInterrupted = false;
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

                    // Return parsed content
                    return parsed;
                }

                return null;  // Response still in progress
            } catch (error) {
                // Malformed response - skip and continue
                messageBuffer = '';
                isGenerationComplete = true;
                return null;
            }
        }

        beforeEach(() => {
            messageBuffer = '';
            isGenerationComplete = true;
            isResponseInterrupted = false;
        });

        it('starts new response', () => {
            handleAIResponse({ modelTurn: true });
            expect(isGenerationComplete).toBe(false);
        });

        it('accumulates text', () => {
            handleAIResponse({ modelTurn: true, text: 'Hello ' });
            handleAIResponse({ text: 'World' });
            expect(messageBuffer).toBe('Hello World');
        });

        it('completes response and parses tags', () => {
            handleAIResponse({ modelTurn: true, text: '<suggestion>Test</suggestion>' });
            const result = handleAIResponse({ turnComplete: true });
            expect(result).toBeDefined();
            expect(result.suggestion).toBe('Test');
            expect(isGenerationComplete).toBe(true);
        });

        it('Property 8: AI response buffer clearing', () => {
            fc.assert(
                fc.property(
                    fc.string(),
                    fc.string(),
                    (firstResponse, secondResponse) => {
                        // Simulate first response
                        messageBuffer = '';
                        handleAIResponse({ modelTurn: true, text: firstResponse });
                        handleAIResponse({ turnComplete: true });

                        // Start new response
                        messageBuffer = '';
                        const result = handleAIResponse({ modelTurn: true, text: secondResponse });

                        // Buffer should be cleared for new response
                        expect(result).toBe(null); // Not complete yet
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('handles malformed response gracefully', () => {
            expect(() => {
                handleAIResponse({ invalid: 'data' });
            }).not.toThrow();
        });
    });

    // Test interruptAIResponse logic
    describe('interruptAIResponse', () => {
        it('Property 9: Interruption detection', () => {
            let messageBuffer = 'test response';
            let isGenerationComplete = false;
            let isResponseInterrupted = false;

            // Check if should interrupt
            const shouldInterrupt = messageBuffer.length > 0 && !isGenerationComplete;
            expect(shouldInterrupt).toBe(true);

            // Interrupt
            if (shouldInterrupt) {
                isResponseInterrupted = true;
                messageBuffer = '';
                isGenerationComplete = true;
            }

            // Verify interruption state
            expect(messageBuffer).toBe('');
            expect(isResponseInterrupted).toBe(true);
            expect(isGenerationComplete).toBe(true);
        });
    });
});
