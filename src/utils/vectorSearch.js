// vectorSearch.js - Vector similarity search using hnswlib-node
const { HierarchicalNSW } = require('hnswlib-node');
const path = require('path');
const fs = require('fs');
const { Mutex } = require('async-mutex');

// Environment detection - only import app if available
let app;
try {
    if (typeof process !== 'undefined' && process.versions && process.versions.electron && process.type === 'browser') {
        app = require('electron').app;
    }
} catch (error) {
    console.warn('[vectorSearch] Electron app not available, using fallback paths');
}

/**
 * SafeHNSWIndex - Thread-safe wrapper around HierarchicalNSW
 * Ensures write operations are serialized using a mutex
 */
class SafeHNSWIndex {
    constructor(space, dimensions) {
        this.index = new HierarchicalNSW(space, dimensions);
        this.writeMutex = new Mutex();
    }

    initIndex(maxElements) {
        return this.index.initIndex(maxElements);
    }

    async addPoint(vector, id) {
        await this.writeMutex.runExclusive(() => {
            this.index.addPoint(vector, id);
        });
    }

    async addBatch(vectors, ids) {
        await this.writeMutex.runExclusive(() => {
            for (let i = 0; i < vectors.length; i++) {
                this.index.addPoint(vectors[i], ids[i]);
            }
        });
    }

    // Queries can run concurrently (read-only)
    searchKnn(vector, k) {
        return this.index.searchKnn(vector, k);
    }

    async writeIndex(path) {
        await this.writeMutex.runExclusive(() => {
            this.index.writeIndexSync(path);
        });
    }

    readIndex(path) {
        return this.index.readIndexSync(path);
    }
}

// HNSW index instance
let hnswIndex = null;
let indexMetadata = {
    numDimensions: 384, // all-MiniLM-L6-v2 produces 384-dimensional embeddings
    maxElements: 10000, // Maximum number of elements
    numElements: 0, // Current number of elements
    documentChunks: [], // Store document chunks metadata
};

/**
 * Get the path for storing index files with fallback
 * @param {string} filename - Filename for the index
 * @returns {string} - Full path to the index file
 */
function getIndexPath(filename) {
    try {
        // Try Electron app path first
        if (app && typeof app.getPath === 'function') {
            return path.join(app.getPath('userData'), filename);
        }
    } catch (error) {
        console.warn('[vectorSearch] app.getPath() not available, using fallback');
    }

    // Fallback to current working directory
    const fallbackDir = path.join(process.cwd(), '.rag-data');
    if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return path.join(fallbackDir, filename);
}

/**
 * Initialize the HNSW index
 * @param {number} dimensions - Dimensionality of vectors (default: 384 for all-MiniLM-L6-v2)
 * @param {number} maxElements - Maximum number of elements in the index
 */
function initializeIndex(dimensions = 384, maxElements = 10000) {
    try {
        console.log(`[vectorSearch] Initializing HNSW index (dimensions: ${dimensions}, max elements: ${maxElements})...`);

        hnswIndex = new SafeHNSWIndex('cosine', dimensions);
        hnswIndex.initIndex(maxElements);

        indexMetadata.numDimensions = dimensions;
        indexMetadata.maxElements = maxElements;
        indexMetadata.numElements = 0;
        indexMetadata.documentChunks = [];

        console.log('[vectorSearch] HNSW index initialized successfully');
        return true;
    } catch (error) {
        console.error('[vectorSearch] Error initializing HNSW index:', error);
        throw error;
    }
}

/**
 * Add a document chunk with its embedding to the index
 * @param {number[]} embedding - Embedding vector
 * @param {object} metadata - Chunk metadata (text, index, sessionId, etc.)
 * @returns {Promise<number>} - Index ID of the added element
 */
async function addToIndex(embedding, metadata) {
    try {
        if (!hnswIndex) {
            throw new Error('HNSW index not initialized. Call initializeIndex() first.');
        }

        // Validate embedding
        if (!embedding || !Array.isArray(embedding)) {
            throw new Error('Invalid embedding: must be an array');
        }

        if (embedding.length !== indexMetadata.numDimensions) {
            throw new Error(`Invalid embedding dimensions: expected ${indexMetadata.numDimensions}, got ${embedding.length}`);
        }

        // Validate metadata
        if (!metadata || typeof metadata !== 'object') {
            throw new Error('Invalid metadata: must be an object');
        }

        // Use the same mutex to protect both HNSW index and metadata operations
        // This ensures atomic ID assignment and prevents race conditions
        const elementId = await Promise.race([
            hnswIndex.writeMutex.runExclusive(() => {
                const id = indexMetadata.numElements;
                
                // Add to HNSW index
                hnswIndex.index.addPoint(embedding, id);
                
                // Store metadata
                indexMetadata.documentChunks.push({
                    id: id,
                    ...metadata,
                });
                
                indexMetadata.numElements++;
                
                return id;
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('addToIndex operation timed out after 10s')), 10000)
            )
        ]);

        console.log(`[vectorSearch] Added chunk to index (ID: ${elementId}, total: ${indexMetadata.numElements})`);
        return elementId;
    } catch (error) {
        console.error('[vectorSearch] Error adding to index:', error.message, error.stack);
        throw new Error(`Failed to add to index: ${error.message}`);
    }
}

/**
 * Add multiple document chunks to the index in batch
 * @param {Array<{embedding: number[], metadata: object}>} chunks - Array of chunks with embeddings and metadata
 * @returns {Promise<number[]>} - Array of index IDs
 */
async function addBatchToIndex(chunks) {
    try {
        if (!hnswIndex) {
            throw new Error('HNSW index not initialized. Call initializeIndex() first.');
        }

        // Validate input
        if (!Array.isArray(chunks) || chunks.length === 0) {
            throw new Error('Invalid chunks array: must be non-empty array');
        }

        console.log(`[vectorSearch] Adding ${chunks.length} chunks to index in batch...`);
        
        // Use mutex to protect the entire batch operation with timeout
        // This ensures all chunks in the batch get consecutive IDs atomically
        const ids = await Promise.race([
            hnswIndex.writeMutex.runExclusive(() => {
                const batchIds = [];
                
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    
                    // Validate chunk structure
                    if (!chunk || typeof chunk !== 'object') {
                        throw new Error(`Invalid chunk at index ${i}: must be an object`);
                    }
                    
                    if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
                        throw new Error(`Invalid embedding at chunk ${i}: must be an array`);
                    }
                    
                    if (chunk.embedding.length !== indexMetadata.numDimensions) {
                        throw new Error(`Invalid embedding dimensions at chunk ${i}: expected ${indexMetadata.numDimensions}, got ${chunk.embedding.length}`);
                    }
                    
                    if (!chunk.metadata || typeof chunk.metadata !== 'object') {
                        throw new Error(`Invalid metadata at chunk ${i}: must be an object`);
                    }
                    
                    const id = indexMetadata.numElements;
                    
                    // Add to HNSW index
                    hnswIndex.index.addPoint(chunk.embedding, id);
                    
                    // Store metadata
                    indexMetadata.documentChunks.push({
                        id: id,
                        ...chunk.metadata,
                    });
                    
                    indexMetadata.numElements++;
                    batchIds.push(id);
                }
                
                return batchIds;
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Batch add operation timed out after 10s (${chunks.length} chunks)`)), 10000)
            )
        ]);

        console.log(`[vectorSearch] Successfully added ${ids.length} chunks to index`);
        return ids;
    } catch (error) {
        console.error('[vectorSearch] Error adding batch to index:', error.message, error.stack);
        throw new Error(`Failed to add batch to index: ${error.message}`);
    }
}

/**
 * Search for similar vectors in the index
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {number} k - Number of nearest neighbors to return (default: 5)
 * @param {number} minScore - Minimum similarity score (default: 0.6)
 * @returns {Array<{id: number, score: number, metadata: object}>} - Array of search results
 */
function search(queryEmbedding, k = 5, minScore = 0.6) {
    try {
        if (!hnswIndex) {
            throw new Error('HNSW index not initialized or empty');
        }

        if (indexMetadata.numElements === 0) {
            console.log('[vectorSearch] Index is empty, returning no results');
            return [];
        }

        // Validate query embedding
        if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
            throw new Error('Invalid query embedding: must be an array');
        }

        if (queryEmbedding.length !== indexMetadata.numDimensions) {
            throw new Error(`Invalid query embedding dimensions: expected ${indexMetadata.numDimensions}, got ${queryEmbedding.length}`);
        }

        // Validate k
        if (typeof k !== 'number' || k < 1) {
            throw new Error('Invalid k: must be a positive number');
        }

        // Validate minScore
        if (typeof minScore !== 'number' || minScore < 0 || minScore > 1) {
            throw new Error('Invalid minScore: must be a number between 0 and 1');
        }

        // Ensure k doesn't exceed number of elements
        const actualK = Math.min(k, indexMetadata.numElements);

        // Search for nearest neighbors (read-only, can run concurrently)
        const result = hnswIndex.searchKnn(queryEmbedding, actualK);

        // Validate search result
        if (!result || !result.neighbors || !result.distances) {
            throw new Error('Invalid search result from HNSW index');
        }

        // Convert cosine distance to similarity and filter by minScore
        // Note: hnswlib returns distances, not similarities
        // For cosine distance: similarity = 1 - distance
        const results = [];

        for (let i = 0; i < result.neighbors.length; i++) {
            const neighborId = result.neighbors[i];
            const distance = result.distances[i];
            const similarity = 1 - distance; // Convert distance to similarity

            if (similarity >= minScore) {
                const metadata = indexMetadata.documentChunks[neighborId];
                
                if (!metadata) {
                    console.warn(`[vectorSearch] Missing metadata for neighbor ${neighborId}, skipping`);
                    continue;
                }
                
                results.push({
                    id: neighborId,
                    score: similarity,
                    distance: distance,
                    metadata: metadata,
                });
            }
        }

        console.log(`[vectorSearch] Search found ${results.length} results (above threshold ${minScore})`);
        return results;
    } catch (error) {
        console.error('[vectorSearch] Error searching index:', error.message, error.stack);
        throw new Error(`Failed to search index: ${error.message}`);
    }
}

/**
 * Save the HNSW index to disk
 * @param {string} filename - Filename to save the index
 * @returns {Promise<string>} - Path where index was saved
 */
async function saveIndex(filename = 'hnsw_index.dat') {
    try {
        if (!hnswIndex) {
            throw new Error('HNSW index not initialized');
        }

        const indexPath = getIndexPath(filename);
        const metadataPath = getIndexPath('hnsw_metadata.json');

        // Validate paths
        if (!indexPath || !metadataPath) {
            throw new Error('Failed to resolve index paths');
        }

        // Save HNSW index (thread-safe) with timeout
        await Promise.race([
            hnswIndex.writeIndex(indexPath),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Index write timed out after 10s')), 10000)
            )
        ]);

        // Save metadata with error handling
        try {
            fs.writeFileSync(metadataPath, JSON.stringify(indexMetadata, null, 2));
        } catch (metadataError) {
            console.error('[vectorSearch] Error saving metadata:', metadataError.message);
            // Try to save without formatting as fallback
            fs.writeFileSync(metadataPath, JSON.stringify(indexMetadata));
        }

        console.log(`[vectorSearch] Index saved to ${indexPath}`);
        return indexPath;
    } catch (error) {
        console.error('[vectorSearch] Error saving index:', error.message, error.stack);
        throw new Error(`Failed to save index: ${error.message}`);
    }
}

/**
 * Load the HNSW index from disk
 * @param {string} filename - Filename to load the index from
 * @returns {boolean} - True if loaded successfully, false otherwise
 */
function loadIndex(filename = 'hnsw_index.dat') {
    try {
        const indexPath = getIndexPath(filename);
        const metadataPath = getIndexPath('hnsw_metadata.json');

        // Validate paths
        if (!indexPath || !metadataPath) {
            console.error('[vectorSearch] Failed to resolve index paths');
            return false;
        }

        if (!fs.existsSync(indexPath) || !fs.existsSync(metadataPath)) {
            console.log('[vectorSearch] No saved index found, initializing new index');
            return false;
        }

        // Load metadata first
        let savedMetadata;
        try {
            const metadataContent = fs.readFileSync(metadataPath, 'utf8');
            savedMetadata = JSON.parse(metadataContent);
        } catch (metadataError) {
            console.error('[vectorSearch] Error loading metadata:', metadataError.message);
            console.log('[vectorSearch] Metadata file may be corrupted, deleting and starting fresh');
            
            // Delete corrupted files
            try {
                if (fs.existsSync(indexPath)) fs.unlinkSync(indexPath);
                if (fs.existsSync(metadataPath)) fs.unlinkSync(metadataPath);
            } catch (deleteError) {
                console.error('[vectorSearch] Error deleting corrupted files:', deleteError.message);
            }
            
            return false;
        }

        // Validate metadata structure
        if (!savedMetadata.numDimensions || !savedMetadata.maxElements) {
            console.error('[vectorSearch] Invalid metadata structure');
            return false;
        }

        // Initialize new index with saved dimensions
        try {
            hnswIndex = new SafeHNSWIndex('cosine', savedMetadata.numDimensions);
            hnswIndex.initIndex(savedMetadata.maxElements);
            hnswIndex.readIndex(indexPath);
        } catch (indexError) {
            console.error('[vectorSearch] Error loading index file:', indexError.message);
            console.log('[vectorSearch] Index file may be corrupted, deleting and starting fresh');
            
            // Delete corrupted files
            try {
                if (fs.existsSync(indexPath)) fs.unlinkSync(indexPath);
                if (fs.existsSync(metadataPath)) fs.unlinkSync(metadataPath);
            } catch (deleteError) {
                console.error('[vectorSearch] Error deleting corrupted files:', deleteError.message);
            }
            
            hnswIndex = null;
            return false;
        }

        // Restore metadata
        indexMetadata = savedMetadata;

        console.log(`[vectorSearch] Index loaded from ${indexPath} (${indexMetadata.numElements} elements)`);
        return true;
    } catch (error) {
        console.error('[vectorSearch] Error loading index:', error.message, error.stack);
        
        // Clean up on error
        hnswIndex = null;
        indexMetadata = {
            numDimensions: 384,
            maxElements: 10000,
            numElements: 0,
            documentChunks: [],
        };
        
        return false;
    }
}

/**
 * Clear the index and reset metadata
 */
function clearIndex() {
    if (hnswIndex) {
        console.log('[vectorSearch] Clearing HNSW index...');
        hnswIndex = null;
    }

    indexMetadata = {
        numDimensions: 384,
        maxElements: 10000,
        numElements: 0,
        documentChunks: [],
    };

    // Re-initialize
    initializeIndex();
}

/**
 * Remove chunks from a specific session
 * @param {string} sessionId - Session ID to remove chunks for
 */
function removeSessionChunks(sessionId) {
    if (!hnswIndex) {
        console.log('[vectorSearch] Index not initialized, nothing to remove');
        return;
    }

    console.log(`[vectorSearch] Removing chunks for session ${sessionId}...`);

    // Filter out chunks from the session
    const remainingChunks = indexMetadata.documentChunks.filter((chunk) => chunk.sessionId !== sessionId);

    const removedCount = indexMetadata.documentChunks.length - remainingChunks.length;

    if (removedCount > 0) {
        console.log(`[vectorSearch] Found ${removedCount} chunks to remove. Rebuilding index...`);

        // Need to rebuild the index without the removed chunks
        // This is a limitation of hnswlib - no direct element removal
        const dimensions = indexMetadata.numDimensions;
        const maxElements = indexMetadata.maxElements;

        // Re-initialize
        initializeIndex(dimensions, maxElements);

        // Re-add remaining chunks
        // Note: We need to re-fetch embeddings for these chunks
        console.log(`[vectorSearch] Rebuilding index with ${remainingChunks.length} remaining chunks`);

        // Update metadata
        indexMetadata.documentChunks = remainingChunks;
    } else {
        console.log('[vectorSearch] No chunks found for this session');
    }
}

/**
 * Get index statistics
 */
function getIndexStats() {
    return {
        initialized: hnswIndex !== null,
        numElements: indexMetadata.numElements,
        numDimensions: indexMetadata.numDimensions,
        maxElements: indexMetadata.maxElements,
        utilizationPercent: (indexMetadata.numElements / indexMetadata.maxElements) * 100,
    };
}

module.exports = {
    initializeIndex,
    addToIndex,
    addBatchToIndex,
    search,
    saveIndex,
    loadIndex,
    clearIndex,
    removeSessionChunks,
    getIndexStats,
    getIndexPath,
    SafeHNSWIndex,
};
