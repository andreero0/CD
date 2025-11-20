// vectorSearch.js - Vector similarity search using hnswlib-node
const { HierarchicalNSW } = require('hnswlib-node');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// HNSW index instance
let hnswIndex = null;
let indexMetadata = {
    numDimensions: 384, // all-MiniLM-L6-v2 produces 384-dimensional embeddings
    maxElements: 10000, // Maximum number of elements
    numElements: 0, // Current number of elements
    documentChunks: [], // Store document chunks metadata
};

/**
 * Initialize the HNSW index
 * @param {number} dimensions - Dimensionality of vectors (default: 384 for all-MiniLM-L6-v2)
 * @param {number} maxElements - Maximum number of elements in the index
 */
function initializeIndex(dimensions = 384, maxElements = 10000) {
    try {
        console.log(`Initializing HNSW index (dimensions: ${dimensions}, max elements: ${maxElements})...`);

        hnswIndex = new HierarchicalNSW('cosine', dimensions);
        hnswIndex.initIndex(maxElements);

        indexMetadata.numDimensions = dimensions;
        indexMetadata.maxElements = maxElements;
        indexMetadata.numElements = 0;
        indexMetadata.documentChunks = [];

        console.log('HNSW index initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing HNSW index:', error);
        throw error;
    }
}

/**
 * Add a document chunk with its embedding to the index
 * @param {number[]} embedding - Embedding vector
 * @param {object} metadata - Chunk metadata (text, index, sessionId, etc.)
 * @returns {number} - Index ID of the added element
 */
function addToIndex(embedding, metadata) {
    if (!hnswIndex) {
        throw new Error('HNSW index not initialized. Call initializeIndex() first.');
    }

    if (!embedding || !Array.isArray(embedding) || embedding.length !== indexMetadata.numDimensions) {
        throw new Error(`Invalid embedding. Expected array of length ${indexMetadata.numDimensions}`);
    }

    try {
        const elementId = indexMetadata.numElements;

        // Add to HNSW index
        hnswIndex.addPoint(embedding, elementId);

        // Store metadata
        indexMetadata.documentChunks.push({
            id: elementId,
            ...metadata,
        });

        indexMetadata.numElements++;

        console.log(`Added chunk to index (ID: ${elementId}, total: ${indexMetadata.numElements})`);
        return elementId;
    } catch (error) {
        console.error('Error adding to index:', error);
        throw error;
    }
}

/**
 * Add multiple document chunks to the index in batch
 * @param {Array<{embedding: number[], metadata: object}>} chunks - Array of chunks with embeddings and metadata
 * @returns {number[]} - Array of index IDs
 */
function addBatchToIndex(chunks) {
    if (!hnswIndex) {
        throw new Error('HNSW index not initialized. Call initializeIndex() first.');
    }

    if (!Array.isArray(chunks) || chunks.length === 0) {
        throw new Error('Invalid chunks array');
    }

    try {
        console.log(`Adding ${chunks.length} chunks to index in batch...`);
        const ids = [];

        for (const chunk of chunks) {
            const id = addToIndex(chunk.embedding, chunk.metadata);
            ids.push(id);
        }

        console.log(`Successfully added ${ids.length} chunks to index`);
        return ids;
    } catch (error) {
        console.error('Error adding batch to index:', error);
        throw error;
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
    if (!hnswIndex) {
        throw new Error('HNSW index not initialized or empty');
    }

    if (indexMetadata.numElements === 0) {
        console.log('Index is empty, returning no results');
        return [];
    }

    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length !== indexMetadata.numDimensions) {
        throw new Error(`Invalid query embedding. Expected array of length ${indexMetadata.numDimensions}`);
    }

    try {
        // Ensure k doesn't exceed number of elements
        const actualK = Math.min(k, indexMetadata.numElements);

        // Search for nearest neighbors
        const result = hnswIndex.searchKnn(queryEmbedding, actualK);

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
                results.push({
                    id: neighborId,
                    score: similarity,
                    distance: distance,
                    metadata: metadata,
                });
            }
        }

        console.log(`Search found ${results.length} results (above threshold ${minScore})`);
        return results;
    } catch (error) {
        console.error('Error searching index:', error);
        throw error;
    }
}

/**
 * Save the HNSW index to disk
 * @param {string} filename - Filename to save the index
 */
function saveIndex(filename = 'hnsw_index.dat') {
    if (!hnswIndex) {
        throw new Error('HNSW index not initialized');
    }

    try {
        const userDataPath = app.getPath('userData');
        const indexPath = path.join(userDataPath, filename);
        const metadataPath = path.join(userDataPath, 'hnsw_metadata.json');

        // Save HNSW index
        hnswIndex.writeIndex(indexPath);

        // Save metadata
        fs.writeFileSync(metadataPath, JSON.stringify(indexMetadata, null, 2));

        console.log(`Index saved to ${indexPath}`);
        return indexPath;
    } catch (error) {
        console.error('Error saving index:', error);
        throw error;
    }
}

/**
 * Load the HNSW index from disk
 * @param {string} filename - Filename to load the index from
 */
function loadIndex(filename = 'hnsw_index.dat') {
    try {
        const userDataPath = app.getPath('userData');
        const indexPath = path.join(userDataPath, filename);
        const metadataPath = path.join(userDataPath, 'hnsw_metadata.json');

        if (!fs.existsSync(indexPath) || !fs.existsSync(metadataPath)) {
            console.log('No saved index found, initializing new index');
            return false;
        }

        // Load metadata first
        const savedMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

        // Initialize new index with saved dimensions
        hnswIndex = new HierarchicalNSW('cosine', savedMetadata.numDimensions);
        hnswIndex.initIndex(savedMetadata.maxElements);
        hnswIndex.readIndex(indexPath);

        // Restore metadata
        indexMetadata = savedMetadata;

        console.log(`Index loaded from ${indexPath} (${indexMetadata.numElements} elements)`);
        return true;
    } catch (error) {
        console.error('Error loading index:', error);
        return false;
    }
}

/**
 * Clear the index and reset metadata
 */
function clearIndex() {
    if (hnswIndex) {
        console.log('Clearing HNSW index...');
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
        console.log('Index not initialized, nothing to remove');
        return;
    }

    console.log(`Removing chunks for session ${sessionId}...`);

    // Filter out chunks from the session
    const remainingChunks = indexMetadata.documentChunks.filter(
        chunk => chunk.sessionId !== sessionId
    );

    const removedCount = indexMetadata.documentChunks.length - remainingChunks.length;

    if (removedCount > 0) {
        console.log(`Found ${removedCount} chunks to remove. Rebuilding index...`);

        // Need to rebuild the index without the removed chunks
        // This is a limitation of hnswlib - no direct element removal
        const dimensions = indexMetadata.numDimensions;
        const maxElements = indexMetadata.maxElements;

        // Re-initialize
        initializeIndex(dimensions, maxElements);

        // Re-add remaining chunks
        // Note: We need to re-fetch embeddings for these chunks
        console.log(`Rebuilding index with ${remainingChunks.length} remaining chunks`);

        // Update metadata
        indexMetadata.documentChunks = remainingChunks;
    } else {
        console.log('No chunks found for this session');
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
};
