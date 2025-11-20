// ragClient.js - Client-side wrapper for RAG system (renderer process)
// Provides easy-to-use functions for interacting with RAG via IPC

const { ipcRenderer } = require('electron');

/**
 * Initialize the RAG system
 * @returns {Promise<boolean>} - Success status
 */
async function initializeRAG() {
    try {
        const result = await ipcRenderer.invoke('rag-initialize');
        return result.success;
    } catch (error) {
        console.error('Error initializing RAG:', error);
        return false;
    }
}

/**
 * Process conversation history with RAG
 * @param {string} sessionId - Session ID
 * @param {Array} conversationHistory - Conversation history
 * @returns {Promise<object>} - Processing result
 */
async function processConversationHistory(sessionId, conversationHistory) {
    try {
        const result = await ipcRenderer.invoke('rag-process-history', sessionId, conversationHistory);
        return result;
    } catch (error) {
        console.error('Error processing conversation history:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Retrieve context for a question using RAG
 * @param {string} question - User's question
 * @param {string} sessionId - Session ID
 * @param {object} options - Retrieval options
 * @returns {Promise<object>} - Retrieved context
 */
async function retrieveContext(question, sessionId, options = {}) {
    try {
        const result = await ipcRenderer.invoke('rag-retrieve-context', question, sessionId, options);
        return result;
    } catch (error) {
        console.error('Error retrieving context:', error);
        return {
            usedRAG: false,
            fallback: true,
            reason: 'Error during retrieval',
            error: error.message,
        };
    }
}

/**
 * Process a new conversation turn with RAG
 * @param {string} sessionId - Session ID
 * @param {object} turn - Conversation turn
 * @returns {Promise<object>} - Processing result
 */
async function processNewTurn(sessionId, turn) {
    try {
        const result = await ipcRenderer.invoke('rag-process-turn', sessionId, turn);
        return result;
    } catch (error) {
        console.error('Error processing turn:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Clear RAG data for a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<object>} - Result
 */
async function clearSessionData(sessionId) {
    try {
        const result = await ipcRenderer.invoke('rag-clear-session', sessionId);
        return result;
    } catch (error) {
        console.error('Error clearing session data:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get RAG system statistics
 * @returns {Promise<object>} - RAG statistics
 */
async function getRAGStats() {
    try {
        const result = await ipcRenderer.invoke('rag-get-stats');
        return result;
    } catch (error) {
        console.error('Error getting RAG stats:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Reset the RAG system
 * @returns {Promise<boolean>} - Success status
 */
async function resetRAG() {
    try {
        const result = await ipcRenderer.invoke('rag-reset');
        return result.success;
    } catch (error) {
        console.error('Error resetting RAG:', error);
        return false;
    }
}

// Export functions
if (typeof window !== 'undefined') {
    // Make available globally in renderer process
    window.ragClient = {
        initializeRAG,
        processConversationHistory,
        retrieveContext,
        processNewTurn,
        clearSessionData,
        getRAGStats,
        resetRAG,
    };
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
