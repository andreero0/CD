// rag.test.js - Test suite for RAG system
const { describe, it, expect, beforeAll } = require('vitest');

describe('RAG System Tests', () => {
    describe('Embeddings Service', () => {
        it('should load embeddings module', async () => {
            const embeddings = require('../utils/embeddings');
            expect(embeddings).toBeDefined();
            expect(embeddings.generateEmbedding).toBeDefined();
            expect(embeddings.chunkDocument).toBeDefined();
        });

        it('should chunk document correctly', () => {
            const { chunkDocument } = require('../utils/embeddings');

            const testDoc = 'This is a test document. '.repeat(50); // Create a longer document
            const chunks = chunkDocument(testDoc, 100, 20);

            expect(chunks).toBeDefined();
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThan(0);

            // Check chunk structure
            if (chunks.length > 0) {
                expect(chunks[0]).toHaveProperty('text');
                expect(chunks[0]).toHaveProperty('index');
                expect(chunks[0]).toHaveProperty('startPos');
                expect(chunks[0]).toHaveProperty('endPos');
            }
        });

        it('should calculate cosine similarity', () => {
            const { cosineSimilarity } = require('../utils/embeddings');

            // Test identical vectors
            const vec1 = [1, 0, 0, 0];
            const vec2 = [1, 0, 0, 0];
            const similarity1 = cosineSimilarity(vec1, vec2);
            expect(similarity1).toBeCloseTo(1.0, 5);

            // Test orthogonal vectors
            const vec3 = [1, 0, 0, 0];
            const vec4 = [0, 1, 0, 0];
            const similarity2 = cosineSimilarity(vec3, vec4);
            expect(similarity2).toBeCloseTo(0.0, 5);
        });
    });

    describe('Vector Search Service', () => {
        it('should load vector search module', () => {
            const vectorSearch = require('../utils/vectorSearch');
            expect(vectorSearch).toBeDefined();
            expect(vectorSearch.initializeIndex).toBeDefined();
            expect(vectorSearch.search).toBeDefined();
        });

        it('should initialize index', () => {
            const { initializeIndex, getIndexStats } = require('../utils/vectorSearch');

            const result = initializeIndex(384, 100);
            expect(result).toBe(true);

            const stats = getIndexStats();
            expect(stats.initialized).toBe(true);
            expect(stats.numDimensions).toBe(384);
            expect(stats.maxElements).toBe(100);
            expect(stats.numElements).toBe(0);
        });
    });

    describe('RAG Controller', () => {
        it('should load RAG controller module', () => {
            const ragController = require('../utils/ragController');
            expect(ragController).toBeDefined();
            expect(ragController.initializeRAG).toBeDefined();
            expect(ragController.retrieveContext).toBeDefined();
            expect(ragController.processConversationHistory).toBeDefined();
        });

        it('should get RAG stats when not initialized', () => {
            const { getRAGStats } = require('../utils/ragController');

            const stats = getRAGStats();
            expect(stats).toBeDefined();
            expect(stats).toHaveProperty('initialized');
        });
    });

    describe('RAG Storage', () => {
        it('should load RAG storage module', () => {
            const ragStorage = require('../utils/ragStorage');
            expect(ragStorage).toBeDefined();
            expect(ragStorage.saveEmbedding).toBeDefined();
            expect(ragStorage.saveChunk).toBeDefined();
        });
    });

    describe('RAG Client', () => {
        it('should load RAG client module', () => {
            const ragClient = require('../utils/ragClient');
            expect(ragClient).toBeDefined();
            expect(ragClient.retrieveContext).toBeDefined();
            expect(ragClient.processNewTurn).toBeDefined();
        });
    });

    describe('Integration Tests', () => {
        it('should chunk and prepare document for embedding', () => {
            const { chunkDocument } = require('../utils/embeddings');

            const sampleConversation = `
                Interviewer: Tell me about yourself.
                Candidate: I am a software engineer with 5 years of experience.
                Interviewer: What technologies do you work with?
                Candidate: I primarily work with JavaScript, Python, and Node.js.
                Interviewer: Can you describe a challenging project?
                Candidate: I built a real-time analytics dashboard using React and WebSockets.
            `;

            const chunks = chunkDocument(sampleConversation, 200, 50);
            expect(chunks).toBeDefined();
            expect(chunks.length).toBeGreaterThan(0);

            console.log(`Sample conversation chunked into ${chunks.length} pieces`);
        });
    });
});
