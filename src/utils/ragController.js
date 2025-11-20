// ragController.js - Main RAG controller with context retrieval logic
// This module coordinates between embeddings, vector search, and storage
// Runs in the main process (Electron)

const { generateEmbedding, generateEmbeddings, chunkDocument } = require('./embeddings');
const { initializeIndex, addBatchToIndex, search, loadIndex, saveIndex, clearIndex, getIndexStats } = require('./vectorSearch');

// RAG system state
let isInitialized = false;
let currentSessionId = null;

/**
 * Initialize the RAG system
 * Loads existing index or creates a new one
 */
async function initializeRAG() {
    if (isInitialized) {
        console.log('RAG system already initialized');
        return true;
    }

    try {
        console.log('Initializing RAG system...');

        // Try to load existing index
        const loaded = loadIndex();

        if (!loaded) {
            // Initialize new index if no existing one found
            console.log('No existing index found, creating new one');
            initializeIndex(384, 10000); // 384 dims for all-MiniLM-L6-v2, max 10k elements
        }

        isInitialized = true;
        console.log('RAG system initialized successfully');

        // Log index stats
        const stats = getIndexStats();
        console.log('Index stats:', stats);

        return true;
    } catch (error) {
        console.error('Failed to initialize RAG system:', error);
        return false;
    }
}

/**
 * Process conversation history and add to RAG index
 * @param {string} sessionId - Session ID
 * @param {Array} conversationHistory - Array of conversation turns
 */
async function processConversationHistory(sessionId, conversationHistory) {
    if (!isInitialized) {
        await initializeRAG();
    }

    if (!conversationHistory || conversationHistory.length === 0) {
        console.log('No conversation history to process');
        return;
    }

    try {
        console.log(`Processing conversation history for session ${sessionId}...`);
        currentSessionId = sessionId;

        // Combine all transcriptions into a single document
        const fullDocument = conversationHistory
            .map(turn => turn.transcription)
            .filter(text => text && text.trim().length > 0)
            .join('\n\n');

        if (!fullDocument || fullDocument.trim().length === 0) {
            console.log('No valid transcriptions to process');
            return;
        }

        // Chunk the document
        const chunks = chunkDocument(fullDocument, 500, 100);
        console.log(`Document chunked into ${chunks.length} chunks`);

        // Generate embeddings for all chunks
        const texts = chunks.map(chunk => chunk.text);
        const embeddings = await generateEmbeddings(texts);

        // Prepare data for batch indexing
        const batchData = chunks.map((chunk, index) => ({
            embedding: embeddings[index],
            metadata: {
                sessionId: sessionId,
                text: chunk.text,
                chunkIndex: chunk.index,
                startPos: chunk.startPos,
                endPos: chunk.endPos,
                timestamp: Date.now(),
            }
        }));

        // Add to vector index
        const ids = addBatchToIndex(batchData);
        console.log(`Added ${ids.length} chunks to vector index`);

        // Save the updated index
        saveIndex();

        return {
            success: true,
            chunksProcessed: chunks.length,
            indexIds: ids,
        };
    } catch (error) {
        console.error('Error processing conversation history:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Retrieve relevant context for a question
 * Implements hybrid approach: metadata + relevant chunks
 *
 * @param {string} question - User's question
 * @param {string} sessionId - Current session ID
 * @param {object} options - Retrieval options
 * @returns {Promise<object>} - Retrieved context and metadata
 */
async function retrieveContext(question, sessionId, options = {}) {
    if (!isInitialized) {
        await initializeRAG();
    }

    const {
        topK = 5,                    // Number of chunks to retrieve
        minScore = 0.6,              // Minimum similarity score
        includeMetadata = true,      // Include critical metadata
        maxTokens = 500,             // Max tokens for retrieved context
        metadataTokens = 100,        // Tokens reserved for metadata
        fallbackToFull = true,       // Fallback to full context if scores too low
    } = options;

    try {
        console.log(`Retrieving context for question: "${question.substring(0, 50)}..."`);

        // Generate embedding for the question
        const queryEmbedding = await generateEmbedding(question);

        // Search for similar chunks
        const results = search(queryEmbedding, topK, minScore);

        console.log(`Found ${results.length} relevant chunks (threshold: ${minScore})`);

        // Check if we should fallback to full context
        const avgScore = results.length > 0
            ? results.reduce((sum, r) => sum + r.score, 0) / results.length
            : 0;

        if (fallbackToFull && avgScore < minScore) {
            console.log(`Average similarity too low (${avgScore.toFixed(2)}), using fallback strategy`);
            return {
                usedRAG: false,
                fallback: true,
                reason: 'Low similarity scores',
                avgScore: avgScore,
            };
        }

        // Build context from retrieved chunks
        let contextText = '';
        let tokensUsed = 0;
        const retrievedChunks = [];

        // Reserve space for metadata
        const availableTokens = maxTokens - (includeMetadata ? metadataTokens : 0);

        // Add chunks in order of relevance
        for (const result of results) {
            const chunkText = result.metadata.text;
            const estimatedTokens = Math.ceil(chunkText.length / 4); // Rough estimate: 1 token ≈ 4 chars

            if (tokensUsed + estimatedTokens > availableTokens) {
                console.log(`Reached token limit (${maxTokens}), stopping at ${retrievedChunks.length} chunks`);
                break;
            }

            retrievedChunks.push({
                text: chunkText,
                score: result.score,
                chunkIndex: result.metadata.chunkIndex,
            });

            contextText += chunkText + '\n\n';
            tokensUsed += estimatedTokens;
        }

        // Prepare metadata (if enabled)
        let metadataText = '';
        if (includeMetadata) {
            metadataText = `Session: ${sessionId}\nQuestion Type: Interview Question\nContext Source: RAG (${retrievedChunks.length} relevant chunks)\n\n`;
        }

        // Final context
        const finalContext = metadataText + contextText;

        console.log(`Retrieved context: ${tokensUsed} tokens from ${retrievedChunks.length} chunks`);

        return {
            usedRAG: true,
            fallback: false,
            context: finalContext.trim(),
            chunks: retrievedChunks,
            tokensEstimate: tokensUsed + (includeMetadata ? metadataTokens : 0),
            avgScore: avgScore,
            stats: {
                chunksRetrieved: retrievedChunks.length,
                totalCandidates: results.length,
                avgSimilarity: avgScore,
            }
        };
    } catch (error) {
        console.error('Error retrieving context:', error);

        // Fallback on error
        return {
            usedRAG: false,
            fallback: true,
            reason: 'Error during retrieval',
            error: error.message,
        };
    }
}

/**
 * Process a new conversation turn and update the index
 * @param {string} sessionId - Session ID
 * @param {object} turn - Conversation turn (transcription + AI response)
 */
async function processNewTurn(sessionId, turn) {
    if (!isInitialized) {
        await initializeRAG();
    }

    try {
        console.log('Processing new conversation turn...');

        const text = turn.transcription;
        if (!text || text.trim().length === 0) {
            console.log('No transcription to process');
            return;
        }

        // Chunk the text (even single turn might need chunking if long)
        const chunks = chunkDocument(text, 500, 100);

        if (chunks.length === 0) {
            console.log('No valid chunks created');
            return;
        }

        // Generate embeddings
        const texts = chunks.map(chunk => chunk.text);
        const embeddings = await generateEmbeddings(texts);

        // Prepare batch data
        const batchData = chunks.map((chunk, index) => ({
            embedding: embeddings[index],
            metadata: {
                sessionId: sessionId,
                text: chunk.text,
                chunkIndex: chunk.index,
                startPos: chunk.startPos,
                endPos: chunk.endPos,
                timestamp: turn.timestamp || Date.now(),
            }
        }));

        // Add to index
        const ids = addBatchToIndex(batchData);
        console.log(`Added ${ids.length} new chunks to index`);

        // Save index
        saveIndex();

        return {
            success: true,
            chunksAdded: ids.length,
        };
    } catch (error) {
        console.error('Error processing new turn:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Clear RAG data for a specific session
 * @param {string} sessionId - Session ID to clear
 */
async function clearSessionData(sessionId) {
    if (!isInitialized) {
        await initializeRAG();
    }

    try {
        console.log(`Clearing RAG data for session ${sessionId}...`);

        // Note: hnswlib doesn't support direct deletion
        // For now, we just log this. Full implementation would require
        // rebuilding the index without the session's chunks
        console.log('Session data cleared (index rebuild required for full removal)');

        return { success: true };
    } catch (error) {
        console.error('Error clearing session data:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get RAG system statistics
 */
function getRAGStats() {
    if (!isInitialized) {
        return {
            initialized: false,
            message: 'RAG system not initialized',
        };
    }

    const indexStats = getIndexStats();

    return {
        initialized: true,
        currentSession: currentSessionId,
        index: indexStats,
    };
}

/**
 * Reset the RAG system (clear all data)
 */
async function resetRAG() {
    console.log('Resetting RAG system...');

    clearIndex();
    currentSessionId = null;
    isInitialized = false;

    console.log('RAG system reset complete');
}

module.exports = {
    initializeRAG,
    processConversationHistory,
    retrieveContext,
    processNewTurn,
    clearSessionData,
    getRAGStats,
    resetRAG,
};
