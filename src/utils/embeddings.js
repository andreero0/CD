// embeddings.js - Local embeddings generation using @xenova/transformers
const { pipeline, env } = require('@xenova/transformers');

// Configure for Node.js/Electron environment
env.allowRemoteModels = true;
env.allowLocalModels = true;
env.backends.onnx.wasm.numThreads = 1; // Single thread for Electron compatibility

// Use ONNX runtime for Node.js
if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
    console.log('Running in Electron environment');
}

// Singleton pipeline instance for efficiency
let embeddingPipeline = null;
let isInitializing = false;
let initPromise = null;

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
    console.log('Initializing embeddings model: Xenova/all-MiniLM-L6-v2...');

    try {
        initPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            quantized: true, // Use quantized model for better performance
        });

        embeddingPipeline = await initPromise;
        console.log('Embeddings model initialized successfully');
        isInitializing = false;
        return embeddingPipeline;
    } catch (error) {
        console.error('Failed to initialize embeddings model:', error);
        isInitializing = false;
        initPromise = null;
        throw error;
    }
}

/**
 * Generate embedding for a single text chunk
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<Float32Array>} - 384-dimensional embedding vector
 */
async function generateEmbedding(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Invalid text input for embedding generation');
    }

    const pipeline = await initializeEmbeddings();

    try {
        // Generate embedding
        const output = await pipeline(text, {
            pooling: 'mean', // Mean pooling
            normalize: true, // Normalize embeddings for cosine similarity
        });

        // Extract the embedding vector
        const embedding = Array.from(output.data);

        console.log(`Generated embedding for text (${text.length} chars): ${embedding.length} dimensions`);
        return embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
}

/**
 * Generate embeddings for multiple text chunks in batch
 * @param {string[]} texts - Array of text chunks
 * @returns {Promise<Float32Array[]>} - Array of embedding vectors
 */
async function generateEmbeddings(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Invalid texts input for batch embedding generation');
    }

    const pipeline = await initializeEmbeddings();

    try {
        console.log(`Generating embeddings for ${texts.length} text chunks...`);

        // Process in batches to avoid memory issues
        const BATCH_SIZE = 32;
        const embeddings = [];

        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batch = texts.slice(i, Math.min(i + BATCH_SIZE, texts.length));
            console.log(`Processing batch ${i / BATCH_SIZE + 1}/${Math.ceil(texts.length / BATCH_SIZE)}`);

            // Generate embeddings for batch
            const batchEmbeddings = await Promise.all(
                batch.map(text => generateEmbedding(text))
            );

            embeddings.push(...batchEmbeddings);
        }

        console.log(`Generated ${embeddings.length} embeddings successfully`);
        return embeddings;
    } catch (error) {
        console.error('Error generating batch embeddings:', error);
        throw error;
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
    }
}

module.exports = {
    initializeEmbeddings,
    generateEmbedding,
    generateEmbeddings,
    chunkDocument,
    cosineSimilarity,
    cleanup,
};
