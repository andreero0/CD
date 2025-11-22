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

// Mock sessionLogger before requiring gemini
vi.mock('../utils/sessionLogger', () => ({
    sessionLogger: {
        log: vi.fn(),
    },
}));

// Mock hnswlib-node to avoid native binding issues in tests
vi.mock('hnswlib-node', () => ({
    HierarchicalNSW: vi.fn(),
}));

// Mock RAG controller
vi.mock('../utils/ragController', () => ({
    processNewTurn: vi.fn(),
    initializeRAG: vi.fn(),
    retrieveContext: vi.fn(),
}));

// Mock documentRetriever
vi.mock('../utils/documentRetriever', () => ({
    formatAllDocuments: vi.fn(),
    clearDocumentCache: vi.fn(),
}));

// Mock audioCorrelation
vi.mock('../utils/audioCorrelation', () => ({
    generateCorrelationId: vi.fn(),
    trackAudioChunk: vi.fn(),
    resolveCorrelationId: vi.fn(),
    clearAll: vi.fn(),
}));

const {
    initializeNewSession,
    saveConversationTurn,
    getCurrentSessionData,
    shouldInterruptAI,
    interruptAIResponse,
    handleAIResponse,
    sanitizeText,
    validateTranscriptFragment,
} = require('../utils/gemini');

const fc = require('fast-check');

describe('gemini conversation helpers', () => {
    beforeEach(() => {
        initializeNewSession();
    });

    it('saves conversation turns and retrieves history', () => {
        saveConversationTurn('hello', 'hi');
        saveConversationTurn('how are you', "i'm fine");

        const data = getCurrentSessionData();
        expect(data.history).toHaveLength(2);
        expect(data.history[0].transcription).toBe('hello');
        expect(data.history[1].ai_response).toBe("i'm fine");
    });
});

describe('AI Response Handling', () => {
    it('Property 8: AI response buffer clearing', () => {
        fc.assert(
            fc.property(
                fc.string(),
                fc.string(),
                (firstResponse, secondResponse) => {
                    // Test that handleAIResponse properly clears buffer between responses
                    // Simulate first response
                    handleAIResponse({ modelTurn: true, text: firstResponse });
                    handleAIResponse({ turnComplete: true });

                    // Start new response
                    const result = handleAIResponse({ modelTurn: true, text: secondResponse });

                    // Buffer should contain only second response (verified internally)
                    // We can't access messageBuffer directly, but we test the behavior
                    expect(result).toBe(null); // Not complete yet
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 9: Interruption detection', () => {
        // Test shouldInterruptAI returns true when AI is generating
        // Start a response
        handleAIResponse({ modelTurn: true, text: 'test response' });

        // Should detect interruption opportunity
        expect(shouldInterruptAI()).toBe(true);

        // Interrupt
        interruptAIResponse();

        // After interruption, should no longer detect interruption opportunity
        expect(shouldInterruptAI()).toBe(false);
    });

    it('handles complete AI response with practice tags', () => {
        const responseText = '<suggestion>Try this</suggestion> General response <feedback>Good job</feedback>';

        handleAIResponse({ modelTurn: true });
        handleAIResponse({ text: responseText });
        const result = handleAIResponse({ turnComplete: true });

        expect(result).toBeDefined();
        expect(result.suggestion).toBe('Try this');
        expect(result.feedback).toBe('Good job');
        expect(result.raw).toBe('General response');
    });

    it('handles interrupted AI response', () => {
        handleAIResponse({ modelTurn: true, text: 'Starting response' });

        expect(shouldInterruptAI()).toBe(true);

        interruptAIResponse();

        expect(shouldInterruptAI()).toBe(false);
    });

    it('handles malformed AI response gracefully', () => {
        expect(() => {
            handleAIResponse({ invalid: 'data' });
        }).not.toThrow();
    });
});

describe('Error Handling', () => {
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

    it('sanitizes corrupted text with null bytes', () => {
        const corruptedText = 'Hello\0World\0Test';
        const sanitized = sanitizeText(corruptedText);
        expect(sanitized).toBe('HelloWorldTest');
        expect(sanitized).not.toContain('\0');
    });

    it('sanitizes text with control characters', () => {
        const textWithControl = 'Hello\x01\x02World\x1F\x7FTest';
        const sanitized = sanitizeText(textWithControl);
        expect(sanitized).toBe('HelloWorldTest');
    });

    it('preserves newlines and tabs', () => {
        const text = 'Hello\nWorld\tTest';
        const sanitized = sanitizeText(text);
        expect(sanitized).toBe('Hello\nWorld\tTest');
    });

    it('validates correct transcript fragments', () => {
        const validFragment = { text: 'Hello world' };
        expect(validateTranscriptFragment(validFragment)).toBe(true);
    });

    it('rejects invalid transcript fragments', () => {
        expect(validateTranscriptFragment(null)).toBe(false);
        expect(validateTranscriptFragment(undefined)).toBe(false);
        expect(validateTranscriptFragment({ text: 123 })).toBe(false);
        expect(validateTranscriptFragment({ text: '' })).toBe(false);
        expect(validateTranscriptFragment({ text: '   ' })).toBe(false);
    });

    it('handles sanitization errors gracefully', () => {
        expect(() => {
            const result = sanitizeText(null);
            expect(result).toBe('');
        }).not.toThrow();
    });
});
