// ragStorage.js - IndexedDB storage for RAG system (embeddings and chunks)
// This file handles storage for document embeddings and chunks in the renderer process

/**
 * Check if we're in a browser environment with IndexedDB support
 */
function isBrowserEnvironment() {
    return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

/**
 * Initialize IndexedDB for RAG storage
 * Stores embeddings and document chunks separately from conversation history
 */
let ragDB = null;

async function initRAGStorage() {
    // Only initialize if in browser environment
    if (!isBrowserEnvironment()) {
        console.warn('[RAG Storage] IndexedDB not available, skipping initialization');
        return null;
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open('RAGStorage', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            ragDB = request.result;
            console.log('RAG storage initialized successfully');
            resolve(ragDB);
        };

        request.onupgradeneeded = event => {
            const db = event.target.result;

            // Create embeddings store
            if (!db.objectStoreNames.contains('embeddings')) {
                const embeddingsStore = db.createObjectStore('embeddings', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                embeddingsStore.createIndex('sessionId', 'sessionId', { unique: false });
                embeddingsStore.createIndex('chunkIndex', 'chunkIndex', { unique: false });
                embeddingsStore.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('Created embeddings object store');
            }

            // Create document chunks store
            if (!db.objectStoreNames.contains('chunks')) {
                const chunksStore = db.createObjectStore('chunks', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                chunksStore.createIndex('sessionId', 'sessionId', { unique: false });
                chunksStore.createIndex('embeddingId', 'embeddingId', { unique: true });
                chunksStore.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('Created chunks object store');
            }
        };
    });
}

/**
 * Save an embedding to IndexedDB
 * @param {object} embeddingData - Embedding data object
 * @returns {Promise<number>} - ID of saved embedding
 */
async function saveEmbedding(embeddingData) {
    if (!isBrowserEnvironment()) {
        console.warn('[RAG Storage] IndexedDB not available, skipping save');
        return null;
    }

    if (!ragDB) {
        await initRAGStorage();
    }

    if (!ragDB) {
        console.warn('[RAG Storage] Failed to initialize database');
        return null;
    }

    const transaction = ragDB.transaction(['embeddings'], 'readwrite');
    const store = transaction.objectStore('embeddings');

    return new Promise((resolve, reject) => {
        const request = store.add({
            ...embeddingData,
            timestamp: Date.now(),
        });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * Save multiple embeddings in batch
 * @param {Array<object>} embeddingsData - Array of embedding data objects
 * @returns {Promise<number[]>} - Array of IDs
 */
async function saveBatchEmbeddings(embeddingsData) {
    if (!isBrowserEnvironment()) {
        console.warn('[RAG Storage] IndexedDB not available, skipping batch save');
        return [];
    }

    if (!ragDB) {
        await initRAGStorage();
    }

    if (!ragDB) {
        console.warn('[RAG Storage] Failed to initialize database');
        return [];
    }

    const transaction = ragDB.transaction(['embeddings'], 'readwrite');
    const store = transaction.objectStore('embeddings');

    const ids = [];
    const timestamp = Date.now();

    return new Promise((resolve, reject) => {
        let completed = 0;

        for (const embeddingData of embeddingsData) {
            const request = store.add({
                ...embeddingData,
                timestamp: timestamp,
            });

            request.onsuccess = () => {
                ids.push(request.result);
                completed++;
                if (completed === embeddingsData.length) {
                    resolve(ids);
                }
            };

            request.onerror = () => reject(request.error);
        }
    });
}

/**
 * Get embeddings for a specific session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} - Array of embeddings
 */
async function getSessionEmbeddings(sessionId) {
    if (!isBrowserEnvironment()) {
        console.warn('[RAG Storage] IndexedDB not available, returning empty array');
        return [];
    }

    if (!ragDB) {
        await initRAGStorage();
    }

    if (!ragDB) {
        console.warn('[RAG Storage] Failed to initialize database');
        return [];
    }

    const transaction = ragDB.transaction(['embeddings'], 'readonly');
    const store = transaction.objectStore('embeddings');
    const index = store.index('sessionId');

    return new Promise((resolve, reject) => {
        const request = index.getAll(sessionId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * Save a document chunk to IndexedDB
 * @param {object} chunkData - Chunk data object
 * @returns {Promise<number>} - ID of saved chunk
 */
async function saveChunk(chunkData) {
    if (!isBrowserEnvironment()) {
        console.warn('[RAG Storage] IndexedDB not available, skipping chunk save');
        return null;
    }

    if (!ragDB) {
        await initRAGStorage();
    }

    if (!ragDB) {
        console.warn('[RAG Storage] Failed to initialize database');
        return null;
    }

    const transaction = ragDB.transaction(['chunks'], 'readwrite');
    const store = transaction.objectStore('chunks');

    return new Promise((resolve, reject) => {
        const request = store.add({
            ...chunkData,
            timestamp: Date.now(),
        });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * Save multiple chunks in batch
 * @param {Array<object>} chunksData - Array of chunk data objects
 * @returns {Promise<number[]>} - Array of IDs
 */
async function saveBatchChunks(chunksData) {
    if (!isBrowserEnvironment()) {
        console.warn('[RAG Storage] IndexedDB not available, skipping batch chunk save');
        return [];
    }

    if (!ragDB) {
        await initRAGStorage();
    }

    if (!ragDB) {
        console.warn('[RAG Storage] Failed to initialize database');
        return [];
    }

    const transaction = ragDB.transaction(['chunks'], 'readwrite');
    const store = transaction.objectStore('chunks');

    const ids = [];
    const timestamp = Date.now();

    return new Promise((resolve, reject) => {
        let completed = 0;

        for (const chunkData of chunksData) {
            const request = store.add({
                ...chunkData,
                timestamp: timestamp,
            });

            request.onsuccess = () => {
                ids.push(request.result);
                completed++;
                if (completed === chunksData.length) {
                    resolve(ids);
                }
            };

            request.onerror = () => reject(request.error);
        }
    });
}

/**
 * Get chunks for a specific session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} - Array of chunks
 */
async function getSessionChunks(sessionId) {
    if (!isBrowserEnvironment()) {
        console.warn('[RAG Storage] IndexedDB not available, returning empty array');
        return [];
    }

    if (!ragDB) {
        await initRAGStorage();
    }

    if (!ragDB) {
        console.warn('[RAG Storage] Failed to initialize database');
        return [];
    }

    const transaction = ragDB.transaction(['chunks'], 'readonly');
    const store = transaction.objectStore('chunks');
    const index = store.index('sessionId');

    return new Promise((resolve, reject) => {
        const request = index.getAll(sessionId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * Get a chunk by its embedding ID
 * @param {number} embeddingId - Embedding ID
 * @returns {Promise<object>} - Chunk object
 */
async function getChunkByEmbeddingId(embeddingId) {
    if (!isBrowserEnvironment()) {
        console.warn('[RAG Storage] IndexedDB not available, returning null');
        return null;
    }

    if (!ragDB) {
        await initRAGStorage();
    }

    if (!ragDB) {
        console.warn('[RAG Storage] Failed to initialize database');
        return null;
    }

    const transaction = ragDB.transaction(['chunks'], 'readonly');
    const store = transaction.objectStore('chunks');
    const index = store.index('embeddingId');

    return new Promise((resolve, reject) => {
        const request = index.get(embeddingId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * Delete all embeddings and chunks for a session
 * @param {string} sessionId - Session ID to delete
 */
async function deleteSessionData(sessionId) {
    if (!isBrowserEnvironment()) {
        console.warn('[RAG Storage] IndexedDB not available, skipping delete');
        return;
    }

    if (!ragDB) {
        await initRAGStorage();
    }

    if (!ragDB) {
        console.warn('[RAG Storage] Failed to initialize database');
        return;
    }

    const transaction = ragDB.transaction(['embeddings', 'chunks'], 'readwrite');
    const embeddingsStore = transaction.objectStore('embeddings');
    const chunksStore = transaction.objectStore('chunks');

    return new Promise((resolve, reject) => {
        // Delete from embeddings
        const embeddingsIndex = embeddingsStore.index('sessionId');
        const embeddingsRequest = embeddingsIndex.getAllKeys(sessionId);

        embeddingsRequest.onsuccess = () => {
            const keys = embeddingsRequest.result;
            keys.forEach(key => embeddingsStore.delete(key));

            // Delete from chunks
            const chunksIndex = chunksStore.index('sessionId');
            const chunksRequest = chunksIndex.getAllKeys(sessionId);

            chunksRequest.onsuccess = () => {
                const chunkKeys = chunksRequest.result;
                chunkKeys.forEach(key => chunksStore.delete(key));
                console.log(`Deleted ${keys.length} embeddings and ${chunkKeys.length} chunks for session ${sessionId}`);
                resolve();
            };

            chunksRequest.onerror = () => reject(chunksRequest.error);
        };

        embeddingsRequest.onerror = () => reject(embeddingsRequest.error);
    });
}

/**
 * Clear all RAG data (embeddings and chunks)
 */
async function clearAllRAGData() {
    if (!isBrowserEnvironment()) {
        console.warn('[RAG Storage] IndexedDB not available, skipping clear');
        return;
    }

    if (!ragDB) {
        await initRAGStorage();
    }

    if (!ragDB) {
        console.warn('[RAG Storage] Failed to initialize database');
        return;
    }

    const transaction = ragDB.transaction(['embeddings', 'chunks'], 'readwrite');
    const embeddingsStore = transaction.objectStore('embeddings');
    const chunksStore = transaction.objectStore('chunks');

    return new Promise((resolve, reject) => {
        const embeddingsRequest = embeddingsStore.clear();
        const chunksRequest = chunksStore.clear();

        let completed = 0;

        embeddingsRequest.onsuccess = () => {
            completed++;
            if (completed === 2) {
                console.log('All RAG data cleared');
                resolve();
            }
        };

        chunksRequest.onsuccess = () => {
            completed++;
            if (completed === 2) {
                console.log('All RAG data cleared');
                resolve();
            }
        };

        embeddingsRequest.onerror = () => reject(embeddingsRequest.error);
        chunksRequest.onerror = () => reject(chunksRequest.error);
    });
}

/**
 * Get storage statistics
 */
async function getRAGStorageStats() {
    if (!isBrowserEnvironment()) {
        console.warn('[RAG Storage] IndexedDB not available, returning zero stats');
        return {
            embeddingsCount: 0,
            chunksCount: 0,
        };
    }

    if (!ragDB) {
        await initRAGStorage();
    }

    if (!ragDB) {
        console.warn('[RAG Storage] Failed to initialize database');
        return {
            embeddingsCount: 0,
            chunksCount: 0,
        };
    }

    const transaction = ragDB.transaction(['embeddings', 'chunks'], 'readonly');
    const embeddingsStore = transaction.objectStore('embeddings');
    const chunksStore = transaction.objectStore('chunks');

    return new Promise((resolve, reject) => {
        const embeddingsCountRequest = embeddingsStore.count();
        const chunksCountRequest = chunksStore.count();

        Promise.all([
            new Promise((res, rej) => {
                embeddingsCountRequest.onsuccess = () => res(embeddingsCountRequest.result);
                embeddingsCountRequest.onerror = () => rej(embeddingsCountRequest.error);
            }),
            new Promise((res, rej) => {
                chunksCountRequest.onsuccess = () => res(chunksCountRequest.result);
                chunksCountRequest.onerror = () => rej(chunksCountRequest.error);
            })
        ])
        .then(([embeddingsCount, chunksCount]) => {
            resolve({
                embeddingsCount,
                chunksCount,
            });
        })
        .catch(reject);
    });
}

// Initialize RAG storage when module loads (browser environment only)
if (isBrowserEnvironment()) {
    initRAGStorage().catch(console.error);
}

// Export for both CommonJS (Node.js) and browser global scope
const exportedFunctions = {
    initRAGStorage,
    saveEmbedding,
    saveBatchEmbeddings,
    getSessionEmbeddings,
    saveChunk,
    saveBatchChunks,
    getSessionChunks,
    getChunkByEmbeddingId,
    deleteSessionData,
    clearAllRAGData,
    getRAGStorageStats,
};

// Browser global scope export
if (typeof window !== 'undefined') {
    window.deleteSessionData = deleteSessionData;
    window.clearAllRAGData = clearAllRAGData;
}

// CommonJS export for Node.js/tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportedFunctions;
}
