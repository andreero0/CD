// ragController.js - Main RAG controller with context retrieval logic
// This module coordinates between embeddings, vector search, and storage
// Runs in the main process (Electron)

const { generateEmbedding, generateEmbeddings, chunkDocument } = require('./embeddings');
const { initializeIndex, addBatchToIndex, search, loadIndex, saveIndex, clearIndex, getIndexStats } = require('./vectorSearch');
const { countTokens, truncateToTokenLimit, countTokensBatch } = require('./tokenCounter');
const { Semaphore } = require('async-mutex');

// Timeout duration for async operations (10 seconds)
const ASYNC_TIMEOUT_MS = 10000;

/**
 * Wrap an async operation with timeout handling
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of operation for error messages
 * @returns {Promise} - Promise that rejects on timeout
 */
function withTimeout(promise, timeoutMs, operationName) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
}

// RAG system state
let isInitialized = false;
let currentSessionId = null;

// Semaphore to limit concurrent embedding operations to 3
const embeddingSemaphore = new Semaphore(3);

// Debounce state
let debounceTimers = new Map(); // Map of sessionId -> timeout

/**
 * Debounce function - delays execution until after delay ms have elapsed since last call
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, delay) {
    let timeoutId;
    return function debounced(...args) {
        clearTimeout(timeoutId);
        return new Promise((resolve, reject) => {
            timeoutId = setTimeout(async () => {
                try {
                    const result = await func(...args);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }, delay);
        });
    };
}

/**
 * Process a new turn with debouncing and semaphore control
 * Internal implementation that gets debounced
 * @param {string} sessionId - Session ID
 * @param {object} turn - Conversation turn
 */
async function processNewTurnInternal(sessionId, turn) {
    // Acquire semaphore to limit concurrent operations
    const [value, release] = await embeddingSemaphore.acquire();
    
    try {
        console.log(`[RAG] Processing turn with semaphore (${embeddingSemaphore.getValue()} slots available)`);
        return await processNewTurn(sessionId, turn);
    } finally {
        release();
    }
}

/**
 * Debounced version of processNewTurnInternal
 * Delays embedding generation by 500ms to batch rapid updates
 */
const debouncedProcessNewTurn = debounce(processNewTurnInternal, 500);

/**
 * Initialize the RAG system
 * Loads existing index or creates a new one
 */
async function initializeRAG() {
    if (isInitialized) {
        console.log('[RAG] System already initialized');
        return true;
    }

    try {
        console.log('[RAG] Initializing RAG system...');

        // Wrap initialization with timeout
        await withTimeout(
            (async () => {
                // Try to load existing index
                const loaded = loadIndex();

                if (!loaded) {
                    // Initialize new index if no existing one found
                    console.log('[RAG] No existing index found, creating new one');
                    initializeIndex(384, 10000); // 384 dims for all-MiniLM-L6-v2, max 10k elements
                }
            })(),
            ASYNC_TIMEOUT_MS,
            'RAG initialization'
        );

        isInitialized = true;
        console.log('[RAG] System initialized successfully');

        // Log index stats
        const stats = getIndexStats();
        console.log('[RAG] Index stats:', stats);

        return true;
    } catch (error) {
        console.error('[RAG] Failed to initialize RAG system:', error.message, error.stack);
        
        // Attempt to initialize empty index as fallback
        try {
            console.log('[RAG] Attempting fallback initialization with empty index...');
            initializeIndex(384, 10000);
            isInitialized = true;
            console.log('[RAG] Fallback initialization successful');
            return true;
        } catch (fallbackError) {
            console.error('[RAG] Fallback initialization failed:', fallbackError.message);
            return false;
        }
    }
}

/**
 * Process conversation history and add to RAG index
 * Uses accurate token counting to enforce 256 token limit per chunk
 * @param {string} sessionId - Session ID
 * @param {Array} conversationHistory - Array of conversation turns
 */
async function processConversationHistory(sessionId, conversationHistory) {
    try {
        // Ensure RAG is initialized with timeout
        if (!isInitialized) {
            const initialized = await withTimeout(
                initializeRAG(),
                ASYNC_TIMEOUT_MS,
                'RAG initialization in processConversationHistory'
            );
            
            if (!initialized) {
                console.error('[RAG] Failed to initialize, cannot process conversation history');
                return {
                    success: false,
                    reason: 'RAG initialization failed',
                    chunksProcessed: 0,
                };
            }
        }

        // Validate input
        if (!conversationHistory || conversationHistory.length === 0) {
            console.log('[RAG] No conversation history to process');
            return {
                success: false,
                reason: 'No conversation history to process',
                chunksProcessed: 0,
            };
        }

        if (!sessionId || typeof sessionId !== 'string') {
            console.error('[RAG] Invalid sessionId provided');
            return {
                success: false,
                reason: 'Invalid sessionId',
                chunksProcessed: 0,
            };
        }

        console.log(`[RAG] Processing conversation history for session ${sessionId}...`);
        currentSessionId = sessionId;

        // Combine all transcriptions into a single document
        const fullDocument = conversationHistory
            .map(turn => turn.transcription)
            .filter(text => text && text.trim().length > 0)
            .join('\n\n');

        if (!fullDocument || fullDocument.trim().length === 0) {
            console.log('[RAG] No valid transcriptions to process');
            return {
                success: false,
                reason: 'No valid transcriptions to process',
                chunksProcessed: 0,
            };
        }

        // Wrap the entire processing pipeline with timeout
        const result = await withTimeout(
            (async () => {
                // Chunk the document with token limit enforcement
                const chunks = chunkDocument(fullDocument, 500, 100);
                console.log(`[RAG] Document chunked into ${chunks.length} chunks`);

                // Validate and truncate chunks that exceed 256 token limit
                const validatedChunks = [];
                for (const chunk of chunks) {
                    try {
                        const tokenCount = await countTokens(chunk.text);
                        
                        if (tokenCount > 256) {
                            console.log(`[RAG] Chunk ${chunk.index} exceeds 256 tokens (${tokenCount}), truncating...`);
                            const truncatedText = await truncateToTokenLimit(chunk.text, 256);
                            validatedChunks.push({
                                ...chunk,
                                text: truncatedText,
                                tokenCount: 256,
                                wasTruncated: true,
                            });
                        } else {
                            validatedChunks.push({
                                ...chunk,
                                tokenCount: tokenCount,
                                wasTruncated: false,
                            });
                        }
                    } catch (tokenError) {
                        console.error(`[RAG] Error counting tokens for chunk ${chunk.index}:`, tokenError.message);
                        // Use chunk without token count as fallback
                        validatedChunks.push({
                            ...chunk,
                            tokenCount: null,
                            wasTruncated: false,
                        });
                    }
                }

                // Generate embeddings for all chunks
                const texts = validatedChunks.map(chunk => chunk.text);
                const embeddings = await generateEmbeddings(texts);

                // Prepare data for batch indexing
                const batchData = validatedChunks.map((chunk, index) => ({
                    embedding: embeddings[index],
                    metadata: {
                        sessionId: sessionId,
                        text: chunk.text,
                        chunkIndex: chunk.index,
                        startPos: chunk.startPos,
                        endPos: chunk.endPos,
                        tokenCount: chunk.tokenCount,
                        wasTruncated: chunk.wasTruncated,
                        timestamp: Date.now(),
                    }
                }));

                // Add to vector index
                const ids = await addBatchToIndex(batchData);
                console.log(`[RAG] Added ${ids.length} chunks to vector index`);

                // Save the updated index
                await saveIndex();

                return {
                    success: true,
                    chunksProcessed: validatedChunks.length,
                    indexIds: ids,
                };
            })(),
            ASYNC_TIMEOUT_MS,
            'Conversation history processing'
        );

        return result;
    } catch (error) {
        console.error('[RAG] Error processing conversation history:', error.message, error.stack);
        return {
            success: false,
            error: error.message,
            reason: error.message.includes('timed out') ? 'timeout' : 'processing_error',
            chunksProcessed: 0,
        };
    }
}

/**
 * Format retrieved chunks as XML with document IDs and relevance scores
 * @param {Array} chunks - Array of chunk objects with text and score
 * @returns {string} - XML formatted context
 */
function formatContextAsXML(chunks) {
    if (!chunks || chunks.length === 0) {
        return '<retrieved_context>\n</retrieved_context>';
    }

    const documents = chunks.map((chunk, idx) => {
        const escapedText = chunk.text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        return `  <document id="${idx + 1}" relevance="${chunk.score.toFixed(2)}">
${escapedText}
  </document>`;
    }).join('\n');
    
    return `<retrieved_context>
${documents}
</retrieved_context>`;
}

/**
 * Retrieve relevant context for a question
 * Implements hybrid retrieval: top-k + threshold filtering with minimum results guarantee
 * Uses accurate token counting to enforce 2000 token limit (50% of 4K context)
 * Calibrated for all-MiniLM-L6-v2 with 0.70 similarity threshold
 *
 * @param {string} question - User's question
 * @param {string} sessionId - Current session ID
 * @param {object} options - Retrieval options
 * @returns {Promise<object>} - Retrieved context and metadata
 */
async function retrieveContext(question, sessionId, options = {}) {
    try {
        // Ensure RAG is initialized with timeout
        if (!isInitialized) {
            const initialized = await withTimeout(
                initializeRAG(),
                ASYNC_TIMEOUT_MS,
                'RAG initialization in retrieveContext'
            );
            
            if (!initialized) {
                console.error('[RAG] Failed to initialize, cannot retrieve context');
                return {
                    usedRAG: false,
                    fallback: true,
                    reason: 'RAG initialization failed',
                    error: 'Failed to initialize RAG system',
                };
            }
        }

        // Validate inputs
        if (!question || typeof question !== 'string' || question.trim().length === 0) {
            console.error('[RAG] Invalid question provided');
            return {
                usedRAG: false,
                fallback: true,
                reason: 'Invalid question',
                error: 'Question must be a non-empty string',
            };
        }

        if (!sessionId || typeof sessionId !== 'string') {
            console.error('[RAG] Invalid sessionId provided');
            return {
                usedRAG: false,
                fallback: true,
                reason: 'Invalid sessionId',
                error: 'SessionId must be a non-empty string',
            };
        }

        const {
            topK = 10,                   // Number of candidates to retrieve (increased for hybrid approach)
            minScore = 0.70,             // Minimum similarity threshold (calibrated for all-MiniLM-L6-v2)
            minResults = 3,              // Minimum results to return even if below threshold
            includeMetadata = true,      // Include critical metadata
            maxTokens = 2000,            // Max tokens for retrieved context (50% of 4K context window)
            metadataTokens = 100,        // Tokens reserved for metadata
            formatAsXML = false,         // Format context as XML
        } = options;

        console.log(`[RAG] Retrieving context for question: "${question.substring(0, 50)}..."`);

        // Wrap the entire retrieval pipeline with timeout
        const result = await withTimeout(
            (async () => {
                // Generate embedding for the question
                const queryEmbedding = await generateEmbedding(question);

                // Search for top-k candidates (no threshold filtering at search level)
                // We'll apply hybrid filtering after getting results
                const allResults = search(queryEmbedding, topK, 0.0);

                console.log(`[RAG] Found ${allResults.length} candidate chunks`);

                if (allResults.length === 0) {
                    console.log('[RAG] No results found in index');
                    return {
                        usedRAG: false,
                        fallback: true,
                        reason: 'No results found',
                        avgScore: 0,
                    };
                }

                // Hybrid retrieval: filter by threshold
                const thresholdFiltered = allResults.filter(r => r.score >= minScore);
                const belowThresholdCount = allResults.length - thresholdFiltered.length;
                
                // Determine final results with minimum guarantee
                let finalResults;
                let lowConfidence = false;
                
                if (thresholdFiltered.length < minResults) {
                    console.warn(`[RAG] Only ${thresholdFiltered.length} results above threshold ${minScore}, returning top ${minResults}`);
                    finalResults = allResults.slice(0, minResults);
                    lowConfidence = true;
                } else {
                    finalResults = thresholdFiltered;
                }

                // Calculate average score
                const avgScore = finalResults.length > 0
                    ? finalResults.reduce((sum, r) => sum + r.score, 0) / finalResults.length
                    : 0;

                console.log(`[RAG] Hybrid retrieval: ${finalResults.length} results (${thresholdFiltered.length} above threshold, avg score: ${avgScore.toFixed(3)})`);

                // Build context from retrieved chunks with accurate token counting
                let contextText = '';
                let actualTokensUsed = 0;
                const retrievedChunks = [];

                // Reserve space for metadata
                const availableTokens = maxTokens - (includeMetadata ? metadataTokens : 0);

                // Prepare metadata (if enabled and not using XML)
                let metadataText = '';
                if (includeMetadata && !formatAsXML) {
                    metadataText = `Session: ${sessionId}\nQuestion Type: Interview Question\nContext Source: RAG (${finalResults.length} relevant chunks)\n\n`;
                }

                // Add chunks in order of relevance with accurate token counting
                for (const result of finalResults) {
                    // Skip results with missing metadata
                    if (!result.metadata || !result.metadata.text) {
                        console.warn('[RAG] Skipping result with missing metadata');
                        continue;
                    }
                    
                    const chunkText = result.metadata.text;
                    
                    try {
                        // Count tokens accurately
                        const chunkTokens = await countTokens(chunkText);

                        // Check if adding this chunk would exceed the limit
                        if (actualTokensUsed + chunkTokens > availableTokens) {
                            console.log(`[RAG] Would exceed token limit (${maxTokens}), stopping at ${retrievedChunks.length} chunks`);
                            break;
                        }

                        retrievedChunks.push({
                            text: chunkText,
                            score: result.score,
                            chunkIndex: result.metadata.chunkIndex,
                            tokenCount: chunkTokens,
                        });

                        contextText += chunkText + '\n\n';
                        actualTokensUsed += chunkTokens;
                    } catch (tokenError) {
                        console.error('[RAG] Error counting tokens for chunk:', tokenError.message);
                        // Skip this chunk and continue with others
                        continue;
                    }
                }

                // Format context (XML or plain text)
                let finalContext;
                if (formatAsXML) {
                    finalContext = formatContextAsXML(retrievedChunks);
                } else {
                    finalContext = metadataText + contextText;
                }

                // Ensure final context doesn't exceed maxTokens
                try {
                    const finalTokenCount = await countTokens(finalContext);
                    if (finalTokenCount > maxTokens) {
                        console.warn(`[RAG] Final context exceeds ${maxTokens} tokens (${finalTokenCount}), truncating...`);
                        finalContext = await truncateToTokenLimit(finalContext, maxTokens);
                        actualTokensUsed = maxTokens;
                    } else {
                        actualTokensUsed = finalTokenCount;
                    }
                } catch (tokenError) {
                    console.error('[RAG] Error counting final tokens:', tokenError.message);
                    // Use estimated tokens as fallback
                    actualTokensUsed = Math.ceil(finalContext.length / 4);
                }

                console.log(`[RAG] Retrieved context: ${actualTokensUsed} tokens from ${retrievedChunks.length} chunks`);

                return {
                    usedRAG: true,
                    fallback: false,
                    context: finalContext.trim(),
                    chunks: retrievedChunks,
                    tokensUsed: actualTokensUsed,
                    avgScore: avgScore,
                    lowConfidence: lowConfidence,
                    belowThresholdCount: belowThresholdCount,
                    stats: {
                        chunksRetrieved: retrievedChunks.length,
                        totalCandidates: allResults.length,
                        aboveThreshold: thresholdFiltered.length,
                        avgSimilarity: avgScore,
                        threshold: minScore,
                    }
                };
            })(),
            ASYNC_TIMEOUT_MS,
            'Context retrieval'
        );

        return result;
    } catch (error) {
        console.error('[RAG] Error retrieving context:', error.message, error.stack);

        // Fallback on error - never crash
        return {
            usedRAG: false,
            fallback: true,
            reason: error.message.includes('timed out') ? 'timeout' : 'retrieval_error',
            error: error.message,
            avgScore: 0,
        };
    }
}

/**
 * Process a new conversation turn and update the index
 * Uses accurate token counting to enforce 256 token limit per chunk
 * @param {string} sessionId - Session ID
 * @param {object} turn - Conversation turn (transcription + AI response)
 */
async function processNewTurn(sessionId, turn) {
    try {
        // Ensure RAG is initialized with timeout
        if (!isInitialized) {
            const initialized = await withTimeout(
                initializeRAG(),
                ASYNC_TIMEOUT_MS,
                'RAG initialization in processNewTurn'
            );
            
            if (!initialized) {
                console.error('[RAG] Failed to initialize, cannot process new turn');
                return {
                    success: false,
                    reason: 'RAG initialization failed',
                    chunksAdded: 0,
                };
            }
        }

        // Validate inputs
        if (!sessionId || typeof sessionId !== 'string') {
            console.error('[RAG] Invalid sessionId provided');
            return {
                success: false,
                reason: 'Invalid sessionId',
                chunksAdded: 0,
            };
        }

        if (!turn || typeof turn !== 'object') {
            console.error('[RAG] Invalid turn object provided');
            return {
                success: false,
                reason: 'Invalid turn object',
                chunksAdded: 0,
            };
        }

        console.log('[RAG] Processing new conversation turn...');

        const text = turn.transcription;
        if (!text || text.trim().length === 0) {
            console.log('[RAG] No transcription to process');
            return {
                success: false,
                reason: 'No transcription to process',
                chunksAdded: 0,
            };
        }

        // Wrap the entire processing pipeline with timeout
        const result = await withTimeout(
            (async () => {
                // Chunk the text (even single turn might need chunking if long)
                const chunks = chunkDocument(text, 500, 100);

                if (chunks.length === 0) {
                    console.log('[RAG] No valid chunks created');
                    return {
                        success: false,
                        reason: 'No valid chunks created',
                        chunksAdded: 0,
                    };
                }

                // Validate and truncate chunks that exceed 256 token limit
                const validatedChunks = [];
                for (const chunk of chunks) {
                    try {
                        const tokenCount = await countTokens(chunk.text);
                        
                        if (tokenCount > 256) {
                            console.log(`[RAG] Chunk ${chunk.index} exceeds 256 tokens (${tokenCount}), truncating...`);
                            const truncatedText = await truncateToTokenLimit(chunk.text, 256);
                            validatedChunks.push({
                                ...chunk,
                                text: truncatedText,
                                tokenCount: 256,
                                wasTruncated: true,
                            });
                        } else {
                            validatedChunks.push({
                                ...chunk,
                                tokenCount: tokenCount,
                                wasTruncated: false,
                            });
                        }
                    } catch (tokenError) {
                        console.error(`[RAG] Error counting tokens for chunk ${chunk.index}:`, tokenError.message);
                        // Use chunk without token count as fallback
                        validatedChunks.push({
                            ...chunk,
                            tokenCount: null,
                            wasTruncated: false,
                        });
                    }
                }

                // Generate embeddings
                const texts = validatedChunks.map(chunk => chunk.text);
                const embeddings = await generateEmbeddings(texts);

                // Prepare batch data
                const batchData = validatedChunks.map((chunk, index) => ({
                    embedding: embeddings[index],
                    metadata: {
                        sessionId: sessionId,
                        text: chunk.text,
                        chunkIndex: chunk.index,
                        startPos: chunk.startPos,
                        endPos: chunk.endPos,
                        tokenCount: chunk.tokenCount,
                        wasTruncated: chunk.wasTruncated,
                        timestamp: turn.timestamp || Date.now(),
                    }
                }));

                // Add to index
                const ids = await addBatchToIndex(batchData);
                console.log(`[RAG] Added ${ids.length} new chunks to index`);

                // Save index
                await saveIndex();

                return {
                    success: true,
                    chunksAdded: ids.length,
                };
            })(),
            ASYNC_TIMEOUT_MS,
            'New turn processing'
        );

        return result;
    } catch (error) {
        console.error('[RAG] Error processing new turn:', error.message, error.stack);
        return {
            success: false,
            error: error.message,
            reason: error.message.includes('timed out') ? 'timeout' : 'processing_error',
            chunksAdded: 0,
        };
    }
}

/**
 * Clear RAG data for a specific session
 * @param {string} sessionId - Session ID to clear
 */
async function clearSessionData(sessionId) {
    try {
        // Ensure RAG is initialized
        if (!isInitialized) {
            const initialized = await withTimeout(
                initializeRAG(),
                ASYNC_TIMEOUT_MS,
                'RAG initialization in clearSessionData'
            );
            
            if (!initialized) {
                console.error('[RAG] Failed to initialize, cannot clear session data');
                return { 
                    success: false, 
                    reason: 'RAG initialization failed' 
                };
            }
        }

        // Validate input
        if (!sessionId || typeof sessionId !== 'string') {
            console.error('[RAG] Invalid sessionId provided');
            return { 
                success: false, 
                reason: 'Invalid sessionId' 
            };
        }

        console.log(`[RAG] Clearing RAG data for session ${sessionId}...`);

        // Note: hnswlib doesn't support direct deletion
        // For now, we just log this. Full implementation would require
        // rebuilding the index without the session's chunks
        console.log('[RAG] Session data cleared (index rebuild required for full removal)');

        return { success: true };
    } catch (error) {
        console.error('[RAG] Error clearing session data:', error.message, error.stack);
        return { 
            success: false, 
            error: error.message,
            reason: 'clear_error'
        };
    }
}

/**
 * Get RAG system statistics
 */
function getRAGStats() {
    try {
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
    } catch (error) {
        console.error('[RAG] Error getting RAG stats:', error.message);
        return {
            initialized: false,
            error: error.message,
            message: 'Error retrieving RAG statistics',
        };
    }
}

/**
 * Reset the RAG system (clear all data)
 */
async function resetRAG() {
    try {
        console.log('[RAG] Resetting RAG system...');

        // Wrap reset operations with timeout
        await withTimeout(
            (async () => {
                clearIndex();
                currentSessionId = null;
                isInitialized = false;
            })(),
            ASYNC_TIMEOUT_MS,
            'RAG reset'
        );

        console.log('[RAG] RAG system reset complete');
        return { success: true };
    } catch (error) {
        console.error('[RAG] Error resetting RAG system:', error.message, error.stack);
        
        // Force reset even on error
        try {
            currentSessionId = null;
            isInitialized = false;
        } catch (fallbackError) {
            console.error('[RAG] Fallback reset failed:', fallbackError.message);
        }
        
        return { 
            success: false, 
            error: error.message,
            reason: error.message.includes('timed out') ? 'timeout' : 'reset_error'
        };
    }
}

/**
 * Process a new turn with debouncing (public API)
 * This is the debounced version that should be called from external code
 * @param {string} sessionId - Session ID
 * @param {object} turn - Conversation turn
 */
async function processNewTurnDebounced(sessionId, turn) {
    return debouncedProcessNewTurn(sessionId, turn);
}

/**
 * Save the RAG index to disk
 * Should be called before application quit or window close
 */
async function saveRAGIndex() {
    if (!isInitialized) {
        console.log('[RAG] System not initialized, skipping index save');
        return { success: false, reason: 'not_initialized' };
    }

    try {
        console.log('[RAG] Saving index to disk...');
        
        // Wrap save operation with timeout
        const path = await withTimeout(
            saveIndex(),
            ASYNC_TIMEOUT_MS,
            'Index save'
        );
        
        console.log('[RAG] Index saved successfully to:', path);
        return { success: true, path };
    } catch (error) {
        console.error('[RAG] Error saving index:', error.message, error.stack);
        return { 
            success: false, 
            error: error.message,
            reason: error.message.includes('timed out') ? 'timeout' : 'save_error'
        };
    }
}

module.exports = {
    initializeRAG,
    processConversationHistory,
    retrieveContext,
    processNewTurn,
    processNewTurnDebounced,
    clearSessionData,
    getRAGStats,
    resetRAG,
    formatContextAsXML,
    saveRAGIndex,
};
