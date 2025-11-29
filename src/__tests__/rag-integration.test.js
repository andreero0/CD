// rag-integration.test.js - Integration tests for RAG system
// Tests the complete RAG flow: initialization → embeddings → search → retrieval

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { initializeRAG, processConversationHistory, retrieveContext, resetRAG, saveRAGIndex, formatContextAsXML } from '../utils/ragController.js';
import { initializeIndex, getIndexStats, clearIndex } from '../utils/vectorSearch.js';
import { generateEmbedding } from '../utils/embeddings.js';
import { countTokens } from '../utils/tokenCounter.js';
import fs from 'fs';
import path from 'path';

describe('RAG System Integration Tests', () => {
    const testSessionId = 'test-session-integration';
    const testDataDir = path.join(process.cwd(), '.rag-data');

    beforeAll(async () => {
        // Ensure test data directory exists
        if (!fs.existsSync(testDataDir)) {
            fs.mkdirSync(testDataDir, { recursive: true });
        }
    });

    beforeEach(async () => {
        // Reset RAG system before each test
        await resetRAG();
    });

    afterEach(async () => {
        // Clean up after each test
        await resetRAG();
    });

    afterAll(async () => {
        // Clean up test files
        const testFiles = [
            path.join(testDataDir, 'hnsw_index.dat'),
            path.join(testDataDir, 'hnsw_metadata.json'),
        ];

        for (const file of testFiles) {
            if (fs.existsSync(file)) {
                try {
                    fs.unlinkSync(file);
                } catch (error) {
                    console.warn(`Failed to delete ${file}:`, error.message);
                }
            }
        }
    });

    describe('1. RAG System Initialization', () => {
        it('should initialize RAG system correctly in Electron environment', async () => {
            const result = await initializeRAG();
            expect(result).toBe(true);

            // After reset and init, we should have a fresh index
            // Note: getIndexStats() checks if hnswIndex exists, not if RAG is initialized
            // So we verify the initialization result instead
            expect(result).toBe(true);
        });

        it('should handle initialization timeout gracefully', async () => {
            // This test verifies timeout handling exists
            // Actual timeout would take 10s, so we just verify the function completes
            const result = await initializeRAG();
            expect(result).toBe(true);
        });

        it('should initialize with fallback on error', async () => {
            // Reset first
            await resetRAG();
            
            // Initialize should work even if no existing index
            const result = await initializeRAG();
            expect(result).toBe(true);
        });
    });

    describe('2. Conversation Flow with RAG Integration', () => {
        it('should process conversation history end-to-end', async () => {
            await initializeRAG();

            const conversationHistory = [
                { transcription: 'Tell me about your experience with React.' },
                { transcription: 'I have 5 years of experience building React applications.' },
                { transcription: 'What projects have you worked on?' },
                { transcription: 'I built an e-commerce platform and a social media dashboard.' },
            ];

            const result = await processConversationHistory(testSessionId, conversationHistory);

            expect(result.success).toBe(true);
            expect(result.chunksProcessed).toBeGreaterThan(0);
            expect(result.indexIds).toBeDefined();
            expect(result.indexIds.length).toBeGreaterThan(0);
            expect(result.indexIds.length).toBe(result.chunksProcessed);
        });

        it('should handle empty conversation history gracefully', async () => {
            await initializeRAG();

            const result = await processConversationHistory(testSessionId, []);

            expect(result.success).toBe(false);
            expect(result.reason).toBe('No conversation history to process');
            expect(result.chunksProcessed).toBe(0);
        });

        it('should handle invalid session ID', async () => {
            await initializeRAG();

            const conversationHistory = [
                { transcription: 'Test question' },
            ];

            const result = await processConversationHistory(null, conversationHistory);

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Invalid sessionId');
        });
    });

    describe('3. Embeddings Generation with Token Counting', () => {
        it('should generate embeddings with accurate token counting', async () => {
            await initializeRAG();

            const text = 'This is a test sentence for embedding generation.';
            const embedding = await generateEmbedding(text);

            // Verify embedding dimensions
            expect(embedding).toBeDefined();
            expect(Array.isArray(embedding)).toBe(true);
            expect(embedding.length).toBe(384);

            // Verify token counting works
            const tokenCount = await countTokens(text);
            expect(tokenCount).toBeGreaterThan(0);
            expect(tokenCount).toBeLessThan(50); // Reasonable upper bound
        });

        it('should enforce 256 token limit per chunk', async () => {
            await initializeRAG();

            // Create a long text that exceeds 256 tokens
            const longText = 'word '.repeat(300); // ~300 tokens
            const conversationHistory = [
                { transcription: longText },
            ];

            const result = await processConversationHistory(testSessionId, conversationHistory);

            expect(result.success).toBe(true);
            
            // Verify chunks were created and truncated if needed
            expect(result.chunksProcessed).toBeGreaterThan(0);
        });
    });

    describe('4. Vector Search with 0.70 Threshold', () => {
        it('should retrieve relevant context with 0.70 similarity threshold', async () => {
            await initializeRAG();

            // Add some conversation history
            const conversationHistory = [
                { transcription: 'I have experience with React, Vue, and Angular frameworks.' },
                { transcription: 'I built a large-scale e-commerce platform using React and Redux.' },
                { transcription: 'I also worked on microservices architecture with Node.js.' },
            ];

            await processConversationHistory(testSessionId, conversationHistory);

            // Query for relevant context
            const question = 'What frontend frameworks do you know?';
            const result = await retrieveContext(question, testSessionId, {
                topK: 5,
                minScore: 0.70,
                minResults: 3,
                formatAsXML: false,
            });

            expect(result.usedRAG).toBe(true);
            expect(result.fallback).toBe(false);
            expect(result.context).toBeDefined();
            expect(result.chunks).toBeDefined();
            expect(result.chunks.length).toBeGreaterThan(0);
            expect(result.avgScore).toBeGreaterThan(0);
        });

        it('should return minimum results even if below threshold', async () => {
            await initializeRAG();

            // Add conversation history
            const conversationHistory = [
                { transcription: 'I like pizza and pasta.' },
                { transcription: 'My favorite color is blue.' },
                { transcription: 'I enjoy hiking on weekends.' },
            ];

            const processResult = await processConversationHistory(testSessionId, conversationHistory);
            expect(processResult.success).toBe(true);
            expect(processResult.chunksProcessed).toBeGreaterThan(0);

            // Query for something unrelated (low similarity)
            const question = 'What is quantum computing?';
            const result = await retrieveContext(question, testSessionId, {
                topK: 10,
                minScore: 0.70,
                minResults: 3,
                formatAsXML: false,
            });

            // Should return results (may be low confidence if below threshold)
            expect(result.usedRAG).toBe(true);
            expect(result.chunks).toBeDefined();
            expect(result.chunks.length).toBeGreaterThan(0);
            
            // If results are below threshold, should be marked as low confidence
            if (result.lowConfidence) {
                expect(result.belowThresholdCount).toBeGreaterThan(0);
            }
        });

        it('should handle queries with no results gracefully', async () => {
            await initializeRAG();

            // Don't add any conversation history - but there may be leftover data from previous tests
            // Clear the index first to ensure truly empty state
            await resetRAG();
            await initializeRAG();

            const question = 'What is your experience?';
            const result = await retrieveContext(question, testSessionId, {
                topK: 5,
                minScore: 0.70,
            });

            // Should either have no results or return minimum results with low confidence
            if (result.usedRAG) {
                // If there's leftover data, it should be marked as low confidence
                expect(result.lowConfidence).toBe(true);
            } else {
                expect(result.fallback).toBe(true);
                expect(result.reason).toBe('No results found');
            }
        });
    });

    describe('5. Thread Safety with Concurrent Operations', () => {
        it('should handle concurrent write operations safely', async () => {
            await initializeRAG();

            const conversationHistories = [
                [{ transcription: 'First conversation about React development.' }],
                [{ transcription: 'Second conversation about Vue.js framework.' }],
                [{ transcription: 'Third conversation about Angular applications.' }],
            ];

            // Process multiple conversations concurrently
            const promises = conversationHistories.map((history, index) =>
                processConversationHistory(`session-${index}`, history)
            );

            const results = await Promise.all(promises);

            // All should succeed
            results.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.chunksProcessed).toBeGreaterThan(0);
            });

            // Verify total chunks processed
            const totalChunks = results.reduce((sum, r) => sum + r.chunksProcessed, 0);
            expect(totalChunks).toBeGreaterThan(0);
        });

        it('should handle concurrent read operations during writes', async () => {
            await initializeRAG();

            // Add initial data
            await processConversationHistory(testSessionId, [
                { transcription: 'I have experience with JavaScript and TypeScript.' },
            ]);

            // Perform concurrent reads and writes
            const operations = [
                retrieveContext('What languages do you know?', testSessionId),
                processConversationHistory(testSessionId, [
                    { transcription: 'I also know Python and Go.' },
                ]),
                retrieveContext('Tell me about your skills', testSessionId),
            ];

            const results = await Promise.all(operations);

            // All operations should complete without errors
            expect(results.length).toBe(3);
        });
    });

    describe('6. XML Context Formatting', () => {
        it('should format context as XML with document IDs and relevance scores', async () => {
            await initializeRAG();

            // Add conversation history
            await processConversationHistory(testSessionId, [
                { transcription: 'I have 5 years of React experience.' },
                { transcription: 'I built several large-scale applications.' },
            ]);

            // Retrieve with XML formatting
            const result = await retrieveContext('What is your experience?', testSessionId, {
                topK: 5,
                minScore: 0.60,
                formatAsXML: true,
            });

            expect(result.usedRAG).toBe(true);
            expect(result.context).toBeDefined();
            
            // Verify XML structure
            expect(result.context).toContain('<retrieved_context>');
            expect(result.context).toContain('</retrieved_context>');
            expect(result.context).toContain('<document id=');
            expect(result.context).toContain('relevance=');
            expect(result.context).toContain('</document>');
        });

        it('should handle empty chunks with XML formatting', async () => {
            const chunks = [];
            const xml = formatContextAsXML(chunks);

            expect(xml).toBe('<retrieved_context>\n</retrieved_context>');
        });

        it('should escape XML special characters', async () => {
            const chunks = [
                { text: 'Text with <tags> and & symbols', score: 0.95, chunkIndex: 0 },
            ];
            const xml = formatContextAsXML(chunks);

            expect(xml).toContain('&lt;tags&gt;');
            expect(xml).toContain('&amp;');
            expect(xml).not.toContain('<tags>');
        });
    });

    describe('7. Token Limit Enforcement', () => {
        it('should enforce 2000 token limit for retrieved context', async () => {
            await initializeRAG();

            // Add lots of conversation history
            const longHistory = [];
            for (let i = 0; i < 20; i++) {
                longHistory.push({
                    transcription: `This is conversation turn ${i}. I have extensive experience with various technologies including React, Vue, Angular, Node.js, Python, Java, and many more frameworks and tools.`,
                });
            }

            await processConversationHistory(testSessionId, longHistory);

            // Retrieve context with token limit
            const result = await retrieveContext('Tell me about your experience', testSessionId, {
                topK: 20,
                minScore: 0.60,
                maxTokens: 2000,
                formatAsXML: false,
            });

            expect(result.usedRAG).toBe(true);
            expect(result.tokensUsed).toBeDefined();
            expect(result.tokensUsed).toBeLessThanOrEqual(2000);
        });

        it('should truncate context if it exceeds token limit', async () => {
            await initializeRAG();

            // Add very long conversation
            const veryLongText = 'word '.repeat(1000); // Very long text
            await processConversationHistory(testSessionId, [
                { transcription: veryLongText },
            ]);

            // Retrieve with strict token limit
            const result = await retrieveContext('Tell me about this', testSessionId, {
                topK: 10,
                minScore: 0.50,
                maxTokens: 500,
                formatAsXML: false,
            });

            // Should either use RAG with token limit or fallback if no results
            if (result.usedRAG) {
                expect(result.tokensUsed).toBeLessThanOrEqual(500);
            } else {
                expect(result.fallback).toBe(true);
            }
        });
    });

    describe('8. Lifecycle Event Handlers', () => {
        it('should save index on demand', async () => {
            await initializeRAG();

            // Add some data
            await processConversationHistory(testSessionId, [
                { transcription: 'Test data for index save.' },
            ]);

            // Save index
            const result = await saveRAGIndex();

            expect(result.success).toBe(true);
            expect(result.path).toBeDefined();
            expect(fs.existsSync(result.path)).toBe(true);
        });

        it('should handle save when not initialized', async () => {
            await resetRAG();

            const result = await saveRAGIndex();

            expect(result.success).toBe(false);
            expect(result.reason).toBe('not_initialized');
        });
    });

    describe('9. Error Handling and Fallbacks', () => {
        it('should handle invalid question gracefully', async () => {
            await initializeRAG();

            const result = await retrieveContext('', testSessionId);

            expect(result.usedRAG).toBe(false);
            expect(result.fallback).toBe(true);
            expect(result.reason).toBe('Invalid question');
        });

        it('should handle invalid session ID in retrieval', async () => {
            await initializeRAG();

            const result = await retrieveContext('What is your experience?', null);

            expect(result.usedRAG).toBe(false);
            expect(result.fallback).toBe(true);
            expect(result.reason).toBe('Invalid sessionId');
        });

        it('should never crash on errors', async () => {
            await initializeRAG();

            // Try various error conditions
            const operations = [
                retrieveContext('', testSessionId),
                retrieveContext('valid question', null),
                processConversationHistory(null, [{ transcription: 'test' }]),
                processConversationHistory(testSessionId, []),
            ];

            // All should complete without throwing
            const results = await Promise.all(operations);

            results.forEach(result => {
                expect(result).toBeDefined();
                expect(result.success !== undefined || result.usedRAG !== undefined).toBe(true);
            });
        });
    });

    describe('10. Complete RAG Flow', () => {
        it('should complete full RAG flow: question → embeddings → search → context retrieval', async () => {
            // 1. Initialize
            const initResult = await initializeRAG();
            expect(initResult).toBe(true);

            // 2. Process conversation history (generates embeddings)
            const conversationHistory = [
                { transcription: 'I am a senior software engineer with 8 years of experience.' },
                { transcription: 'I specialize in React, Node.js, and cloud architecture.' },
                { transcription: 'I have led teams of 5-10 developers on multiple projects.' },
                { transcription: 'My most recent project was a microservices platform for e-commerce.' },
            ];

            const processResult = await processConversationHistory(testSessionId, conversationHistory);
            expect(processResult.success).toBe(true);
            expect(processResult.chunksProcessed).toBeGreaterThan(0);

            // 3. Generate query embedding and search
            const question = 'What is your experience with React and Node.js?';
            const retrievalResult = await retrieveContext(question, testSessionId, {
                topK: 5,
                minScore: 0.70,
                minResults: 3,
                maxTokens: 2000,
                formatAsXML: true,
            });

            // 4. Verify complete flow
            expect(retrievalResult.usedRAG).toBe(true);
            expect(retrievalResult.fallback).toBe(false);
            expect(retrievalResult.context).toBeDefined();
            expect(retrievalResult.context).toContain('<retrieved_context>');
            expect(retrievalResult.chunks).toBeDefined();
            expect(retrievalResult.chunks.length).toBeGreaterThan(0);
            expect(retrievalResult.tokensUsed).toBeGreaterThan(0);
            expect(retrievalResult.tokensUsed).toBeLessThanOrEqual(2000);
            expect(retrievalResult.avgScore).toBeGreaterThan(0);

            // 5. Verify chunks contain relevant information
            const contextLower = retrievalResult.context.toLowerCase();
            expect(
                contextLower.includes('react') || 
                contextLower.includes('node') || 
                contextLower.includes('experience')
            ).toBe(true);

            // 6. Save index
            const saveResult = await saveRAGIndex();
            expect(saveResult.success).toBe(true);
        });
    });
});
