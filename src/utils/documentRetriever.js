// documentRetriever.js - Document retrieval and formatting for AI context
// Runs in main process, communicates with renderer to fetch documents from IndexedDB

const { BrowserWindow } = require('electron');

// Document cache to avoid repeated fetching
let documentCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get all documents from IndexedDB (via renderer process)
 * @returns {Promise<Array>} Array of documents
 */
async function getAllDocuments() {
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length === 0) {
            console.warn('[DocumentRetriever] No browser windows available for document retrieval');
            return [];
        }

        // Execute code in renderer to fetch documents from IndexedDB with timeout
        const documents = await Promise.race([
            windows[0].webContents.executeJavaScript(`
                (async function() {
                    try {
                        // Import documentDB module
                        const { documentDB } = await import('./utils/documentDB.js');

                        // Get all documents
                        const docs = await documentDB.getAllDocuments();
                        console.log('Retrieved', docs.length, 'documents from IndexedDB');
                        return docs;
                    } catch (error) {
                        console.error('Error fetching documents from IndexedDB:', error);
                        return [];
                    }
                })()
            `),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Document retrieval timed out after 10s')), 10000)
            )
        ]);

        // Validate result
        if (!Array.isArray(documents)) {
            console.error('[DocumentRetriever] Invalid documents result, expected array');
            return [];
        }

        return documents;
    } catch (error) {
        console.error('[DocumentRetriever] Error retrieving documents:', error.message, error.stack);
        return [];
    }
}

/**
 * Get documents with caching
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Promise<Array>} Array of documents
 */
async function getCachedDocuments(forceRefresh = false) {
    const now = Date.now();

    // Return cached documents if valid
    if (!forceRefresh && documentCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
        console.log('Using cached documents');
        return documentCache;
    }

    // Fetch fresh documents
    console.log('Fetching documents from IndexedDB...');
    const documents = await getAllDocuments();

    // Update cache
    documentCache = documents;
    cacheTimestamp = now;

    return documents;
}

/**
 * Clear document cache
 */
function clearDocumentCache() {
    documentCache = null;
    cacheTimestamp = null;
    console.log('Document cache cleared');
}

/**
 * Estimate tokens for a string (simple heuristic: ~4 chars per token)
 * @param {string} text - Text to estimate
 * @returns {number} Token count
 */
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

/**
 * Format a single document for AI context
 * @param {Object} doc - Document object
 * @param {number} maxTokens - Max tokens for this document
 * @returns {string} Formatted document text
 */
function formatDocument(doc, maxTokens = null) {
    if (!doc) return '';

    // Use the full text if available, otherwise concatenate chunks
    let text = doc.text || '';

    if (!text && doc.chunks && doc.chunks.length > 0) {
        text = doc.chunks.map(chunk => chunk.text).join('\n\n');
    }

    // Truncate if exceeds max tokens
    if (maxTokens && text) {
        const tokens = estimateTokens(text);
        if (tokens > maxTokens) {
            // Truncate to max tokens (rough estimate)
            const targetLength = maxTokens * 4;
            text = text.substring(0, targetLength) + '\n\n... [truncated]';
        }
    }

    // Format as XML-like structure for clear parsing
    const fileName = doc.fileName || 'Unknown';
    const type = doc.type || 'document';

    return `<document name="${fileName}" type="${type}" pages="${doc.numPages || 'N/A'}" tokens="${doc.totalTokens || 'N/A'}">
${text}
</document>`;
}

/**
 * Format all documents for AI context
 * @param {Object} options - Formatting options
 * @returns {Promise<string>} Formatted documents text
 */
async function formatAllDocuments(options = {}) {
    const {
        maxTotalTokens = 10000,     // Max tokens for all documents combined
        maxTokensPerDoc = 3000,     // Max tokens per individual document
        forceRefresh = false,       // Force refresh document cache
    } = options;

    try {
        // Get all documents with timeout
        const documents = await Promise.race([
            getCachedDocuments(forceRefresh),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Document fetch timed out after 10s')), 10000)
            )
        ]);

        if (!documents || documents.length === 0) {
            console.log('[DocumentRetriever] No documents available for context');
            return '';
        }

        console.log(`[DocumentRetriever] Formatting ${documents.length} document(s) for AI context...`);

        // Validate options
        if (typeof maxTotalTokens !== 'number' || maxTotalTokens < 1) {
            console.warn('[DocumentRetriever] Invalid maxTotalTokens, using default');
            maxTotalTokens = 10000;
        }

        if (typeof maxTokensPerDoc !== 'number' || maxTokensPerDoc < 1) {
            console.warn('[DocumentRetriever] Invalid maxTokensPerDoc, using default');
            maxTokensPerDoc = 3000;
        }

        // Calculate total tokens available per document
        const tokensPerDoc = Math.min(
            maxTokensPerDoc,
            Math.floor(maxTotalTokens / documents.length)
        );

        // Format each document with error handling
        const formattedDocs = [];
        for (const doc of documents) {
            try {
                const formatted = formatDocument(doc, tokensPerDoc);
                if (formatted) {
                    formattedDocs.push(formatted);
                }
            } catch (formatError) {
                console.error('[DocumentRetriever] Error formatting document:', formatError.message);
                // Continue with other documents
            }
        }

        if (formattedDocs.length === 0) {
            console.log('[DocumentRetriever] No documents could be formatted');
            return '';
        }

        // Combine all documents
        const combinedText = formattedDocs.join('\n\n');

        // Check if we exceeded max total tokens
        const totalTokens = estimateTokens(combinedText);

        if (totalTokens > maxTotalTokens) {
            console.warn(`[DocumentRetriever] Documents exceed max tokens (${totalTokens} > ${maxTotalTokens}), truncating...`);

            // Truncate to fit max total tokens
            const targetLength = maxTotalTokens * 4;
            const truncated = combinedText.substring(0, targetLength);

            return `<documents>
${truncated}
... [additional documents truncated]
</documents>`;
        }

        console.log(`[DocumentRetriever] Formatted ${formattedDocs.length} document(s) (${totalTokens} estimated tokens)`);

        return `<documents>
${combinedText}
</documents>`;
    } catch (error) {
        console.error('[DocumentRetriever] Error formatting documents:', error.message, error.stack);
        return '';
    }
}

/**
 * Get document summary (metadata only, no full text)
 * @returns {Promise<Object>} Document summary
 */
async function getDocumentSummary() {
    try {
        const documents = await getCachedDocuments();

        return {
            count: documents.length,
            totalPages: documents.reduce((sum, doc) => sum + (doc.numPages || 0), 0),
            totalTokens: documents.reduce((sum, doc) => sum + (doc.totalTokens || 0), 0),
            types: [...new Set(documents.map(doc => doc.type))],
            fileNames: documents.map(doc => doc.fileName),
        };
    } catch (error) {
        console.error('Error getting document summary:', error);
        return {
            count: 0,
            totalPages: 0,
            totalTokens: 0,
            types: [],
            fileNames: [],
        };
    }
}

/**
 * Check if documents are available
 * @returns {Promise<boolean>} True if documents exist
 */
async function hasDocuments() {
    try {
        const documents = await getCachedDocuments();
        return documents && documents.length > 0;
    } catch (error) {
        console.error('Error checking for documents:', error);
        return false;
    }
}

module.exports = {
    getAllDocuments,
    getCachedDocuments,
    clearDocumentCache,
    formatDocument,
    formatAllDocuments,
    getDocumentSummary,
    hasDocuments,
};
