// embeddings.js - Local embeddings generation using @xenova/transformers

// Singleton pipeline instance for efficiency
let embeddingPipeline = null;
let isInitializing = false;
let initPromise = null;
let transformersModule = null;

/**
 * Lazy load the transformers module (ES Module)
 */
async function loadTransformers() {
    if (transformersModule) {
        return transformersModule;
    }

    try {
        transformersModule = await import('@xenova/transformers');
        
        // Configure for Node.js/Electron environment
        transformersModule.env.allowRemoteModels = true;
        transformersModule.env.allowLocalModels = true;
        transformersModule.env.backends.onnx.wasm.numThreads = 1; // Single thread for Electron compatibility

        // Use ONNX runtime for Node.js
        if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
            console.log('Running in Electron environment');
        }

        return transformersModule;
    } catch (error) {
        console.error('Failed to load @xenova/transformers:', error);
        throw error;
    }
}

/**
 * Initialize the embedding pipeline with all-MiniLM-L6-v2 model
 * This model produces 384-dimensional embeddings
 */
async function initializeEmbeddings() {
    if (embeddingPipeline) {
        return embeddingPipeline;
    }

    if (isInitializing) {
        return initPromise;
    }

    isInitializing = true;
    console.log('[Embeddings] Initializing embeddings model: Xenova/all-MiniLM-L6-v2...');

    try {
        // Load transformers module dynamically with timeout (30 seconds for model download)
        const transformers = await Promise.race([
            loadTransformers(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Transformers module loading timed out after 30s')), 30000)
            )
        ]);
        
        // Initialize pipeline with timeout (30 seconds for model loading)
        initPromise = Promise.race([
            transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                quantized: true, // Use quantized model for better performance
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Pipeline initialization timed out after 30s')), 30000)
            )
        ]);

        embeddingPipeline = await initPromise;
        console.log('[Embeddings] Model initialized successfully');
        isInitializing = false;
        return embeddingPipeline;
    } catch (error) {
        console.error('[Embeddings] Failed to initialize embeddings model:', error.message, error.stack);
        isInitializing = false;
        initPromise = null;
        
        // Retry once after 2 seconds if initialization failed
        if (!error.message.includes('timed out')) {
            console.log('[Embeddings] Retrying initialization in 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
                isInitializing = true;
                const transformers = await loadTransformers();
                initPromise = transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                    quantized: true,
                });
                embeddingPipeline = await initPromise;
                console.log('[Embeddings] Model initialized successfully on retry');
                isInitializing = false;
                return embeddingPipeline;
            } catch (retryError) {
                console.error('[Embeddings] Retry failed:', retryError.message);
                isInitializing = false;
                initPromise = null;
                throw retryError;
            }
        }
        
        throw error;
    }
}

/**
 * Generate embedding for a single text chunk
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<Float32Array>} - 384-dimensional embedding vector
 */
async function generateEmbedding(text) {
    try {
        // Validate input
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            throw new Error('Invalid text input for embedding generation: text must be a non-empty string');
        }

        // Initialize pipeline with timeout
        const pipeline = await Promise.race([
            initializeEmbeddings(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Pipeline initialization timed out')), 30000)
            )
        ]);

        // Generate embedding with timeout (10 seconds)
        const output = await Promise.race([
            pipeline(text, {
                pooling: 'mean', // Mean pooling
                normalize: true, // Normalize embeddings for cosine similarity
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Embedding generation timed out after 10s')), 10000)
            )
        ]);

        // Extract the embedding vector
        const embedding = Array.from(output.data);

        // Validate output dimensions
        if (embedding.length !== 384) {
            throw new Error(`Invalid embedding dimensions: expected 384, got ${embedding.length}`);
        }

        console.log(`[Embeddings] Generated embedding for text (${text.length} chars): ${embedding.length} dimensions`);
        return embedding;
    } catch (error) {
        console.error('[Embeddings] Error generating embedding:', error.message, error.stack);
        throw new Error(`Failed to generate embedding: ${error.message}`);
    }
}

/**
 * Generate embeddings for multiple text chunks in batch
 * @param {string[]} texts - Array of text chunks
 * @returns {Promise<Float32Array[]>} - Array of embedding vectors
 */
async function generateEmbeddings(texts) {
    try {
        // Validate input
        if (!Array.isArray(texts) || texts.length === 0) {
            throw new Error('Invalid texts input for batch embedding generation: must be non-empty array');
        }

        // Validate all texts are strings
        const invalidTexts = texts.filter(t => !t || typeof t !== 'string' || t.trim().length === 0);
        if (invalidTexts.length > 0) {
            throw new Error(`Invalid texts in batch: ${invalidTexts.length} empty or non-string texts found`);
        }

        // Initialize pipeline
        const pipeline = await initializeEmbeddings();

        console.log(`[Embeddings] Generating embeddings for ${texts.length} text chunks...`);

        // Process in batches to avoid memory issues
        const BATCH_SIZE = 32;
        const embeddings = [];
        const errors = [];

        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batch = texts.slice(i, Math.min(i + BATCH_SIZE, texts.length));
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(texts.length / BATCH_SIZE);
            
            console.log(`[Embeddings] Processing batch ${batchNum}/${totalBatches}`);

            try {
                // Generate embeddings for batch with timeout (30 seconds per batch)
                const batchEmbeddings = await Promise.race([
                    Promise.all(batch.map(text => generateEmbedding(text))),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Batch ${batchNum} timed out after 30s`)), 30000)
                    )
                ]);

                embeddings.push(...batchEmbeddings);
            } catch (batchError) {
                console.error(`[Embeddings] Error processing batch ${batchNum}:`, batchError.message);
                errors.push({ batch: batchNum, error: batchError.message });
                
                // Try processing batch items individually as fallback
                console.log(`[Embeddings] Attempting individual processing for batch ${batchNum}...`);
                for (const text of batch) {
                    try {
                        const embedding = await generateEmbedding(text);
                        embeddings.push(embedding);
                    } catch (itemError) {
                        console.error('[Embeddings] Failed to generate embedding for individual text:', itemError.message);
                        // Re-throw if we can't process any items
                        throw new Error(`Failed to generate embeddings for batch ${batchNum}: ${itemError.message}`);
                    }
                }
            }
        }

        if (errors.length > 0) {
            console.warn(`[Embeddings] Completed with ${errors.length} batch errors (recovered via fallback)`);
        }

        console.log(`[Embeddings] Generated ${embeddings.length} embeddings successfully`);
        
        // Validate we got all embeddings
        if (embeddings.length !== texts.length) {
            throw new Error(`Embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`);
        }
        
        return embeddings;
    } catch (error) {
        console.error('[Embeddings] Error generating batch embeddings:', error.message, error.stack);
        throw new Error(`Failed to generate batch embeddings: ${error.message}`);
    }
}

/**
 * Chunk a document into smaller pieces for embedding
 * @param {string} document - Full document text
 * @param {number} chunkSize - Size of each chunk in characters (default: 500)
 * @param {number} overlap - Overlap between chunks in characters (default: 100)
 * @returns {Array<{text: string, index: number}>} - Array of text chunks with metadata
 */
function chunkDocument(document, chunkSize = 500, overlap = 100) {
    if (!document || typeof document !== 'string') {
        throw new Error('Invalid document for chunking');
    }

    const chunks = [];
    let index = 0;
    let position = 0;

    while (position < document.length) {
        const end = Math.min(position + chunkSize, document.length);
        const chunkText = document.slice(position, end).trim();

        if (chunkText.length > 0) {
            chunks.push({
                text: chunkText,
                index: index,
                startPos: position,
                endPos: end,
            });
            index++;
        }

        position += chunkSize - overlap;
    }

    console.log(`Document chunked into ${chunks.length} chunks (chunk size: ${chunkSize}, overlap: ${overlap})`);
    return chunks;
}

/**
 * Estimate token count for text (rough approximation: 1 token ≈ 4 characters)
 * @param {string} text - Text to estimate tokens for
 * @returns {number} - Estimated token count
 * @deprecated Use countTokens from tokenCounter.js for accurate counts
 */
function estimateTokens(text) {
    if (!text || typeof text !== 'string') {
        return 0;
    }
    // Rough approximation: 1 token ≈ 4 characters
    // This is conservative and works reasonably well for English text
    return Math.ceil(text.length / 4);
}

/**
 * Chunk conversation history using sliding window approach
 * Optimized for conversational data with speaker attribution
 * @param {Array<{speaker: string, message: string, timestamp?: number}>} turns - Array of conversation turns
 * @param {Object} options - Chunking options
 * @param {number} options.turnsPerChunk - Number of turns per chunk (default: 5, range: 4-6)
 * @param {number} options.overlapPercent - Overlap percentage (default: 0.25, range: 0.20-0.25)
 * @param {number} options.maxTokens - Maximum tokens per chunk (default: 256 for MiniLM-L6-v2)
 * @param {Function} options.tokenCounter - Optional async function to count tokens accurately
 * @returns {Promise<Array<{text: string, index: number, metadata: object}>>} - Array of chunks with metadata
 */
async function chunkConversationHistory(turns, options = {}) {
    if (!Array.isArray(turns) || turns.length === 0) {
        console.warn('Invalid or empty turns array for conversation chunking');
        return [];
    }

    const turnsPerChunk = options.turnsPerChunk || 5;
    const overlapPercent = options.overlapPercent || 0.25;
    const maxTokens = options.maxTokens || 256; // MiniLM-L6-v2 limit
    const tokenCounter = options.tokenCounter; // Optional accurate token counter

    // Calculate overlap in turns (20-25% overlap)
    const overlapTurns = Math.ceil(turnsPerChunk * overlapPercent);
    const step = turnsPerChunk - overlapTurns;

    const chunks = [];

    for (let i = 0; i < turns.length; i += step) {
        const windowTurns = turns.slice(i, i + turnsPerChunk);
        
        // Need at least 2 turns for meaningful context
        if (windowTurns.length < 2) {
            break;
        }

        // Preserve speaker attribution
        const content = windowTurns
            .map(turn => {
                const speaker = turn.speaker || 'Unknown';
                const message = turn.message || '';
                return `${speaker}: ${message}`;
            })
            .join('\n');

        // Count tokens (use accurate counter if provided, otherwise estimate)
        let tokenCount;
        if (tokenCounter && typeof tokenCounter === 'function') {
            tokenCount = await tokenCounter(content);
        } else {
            tokenCount = estimateTokens(content);
        }

        // If chunk exceeds token limit, split it recursively
        if (tokenCount > maxTokens && turnsPerChunk > 2) {
            // Reduce turns per chunk by 30% and retry
            const reducedTurns = Math.max(2, Math.floor(turnsPerChunk * 0.7));
            console.log(`Chunk exceeds ${maxTokens} tokens (actual: ${tokenCount}), reducing to ${reducedTurns} turns per chunk`);
            
            const subChunks = await chunkConversationHistory(
                windowTurns,
                { ...options, turnsPerChunk: reducedTurns }
            );
            
            // Adjust indices for sub-chunks
            subChunks.forEach(subChunk => {
                chunks.push({
                    ...subChunk,
                    index: chunks.length,
                    metadata: {
                        ...subChunk.metadata,
                        parentChunkIndex: i,
                        wasSplit: true
                    }
                });
            });
            continue;
        }

        // Extract metadata
        const speakers = [...new Set(windowTurns.map(t => t.speaker || 'Unknown'))];
        const timestampStart = windowTurns[0]?.timestamp;
        const timestampEnd = windowTurns[windowTurns.length - 1]?.timestamp;

        chunks.push({
            text: content,
            index: chunks.length,
            metadata: {
                turnRange: [i, Math.min(i + turnsPerChunk - 1, turns.length - 1)],
                turnCount: windowTurns.length,
                speakers: speakers,
                timestampStart: timestampStart,
                timestampEnd: timestampEnd,
                hasOverlap: i > 0,
                tokenCount: tokenCount,
                overlapTurns: i > 0 ? overlapTurns : 0
            }
        });
    }

    console.log(`Conversation chunked into ${chunks.length} chunks (${turnsPerChunk} turns/chunk, ${Math.round(overlapPercent * 100)}% overlap)`);
    return chunks;
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vec1 - First vector
 * @param {number[]} vec2 - Second vector
 * @returns {number} - Cosine similarity score (0 to 1)
 */
function cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
        throw new Error('Invalid vectors for similarity calculation');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Clean up the embedding pipeline
 */
async function cleanup() {
    if (embeddingPipeline) {
        console.log('Cleaning up embeddings model...');
        embeddingPipeline = null;
        isInitializing = false;
        initPromise = null;
        transformersModule = null;
    }
}

module.exports = {
    initializeEmbeddings,
    generateEmbedding,
    generateEmbeddings,
    chunkDocument,
    chunkConversationHistory,
    estimateTokens,
    cosineSimilarity,
    cleanup,
};
