// ragIpc.js - IPC handlers for RAG system
// Exposes RAG functionality to renderer process via IPC

const { ipcMain } = require('electron');
const {
    initializeRAG,
    processConversationHistory,
    retrieveContext,
    processNewTurn,
    clearSessionData,
    getRAGStats,
    resetRAG,
} = require('./ragController');

/**
 * Setup IPC handlers for RAG system
 */
function setupRAGIpcHandlers() {
    console.log('Setting up RAG IPC handlers...');

    // Initialize RAG system
    ipcMain.handle('rag-initialize', async (event) => {
        try {
            const success = await initializeRAG();
            return { success };
        } catch (error) {
            console.error('Error initializing RAG:', error);
            return { success: false, error: error.message };
        }
    });

    // Process conversation history
    ipcMain.handle('rag-process-history', async (event, sessionId, conversationHistory) => {
        try {
            const result = await processConversationHistory(sessionId, conversationHistory);
            return result;
        } catch (error) {
            console.error('Error processing conversation history:', error);
            return { success: false, error: error.message };
        }
    });

    // Retrieve context for a question
    ipcMain.handle('rag-retrieve-context', async (event, question, sessionId, options) => {
        try {
            const result = await retrieveContext(question, sessionId, options);
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
    });

    // Process a new conversation turn
    ipcMain.handle('rag-process-turn', async (event, sessionId, turn) => {
        try {
            const result = await processNewTurn(sessionId, turn);
            return result;
        } catch (error) {
            console.error('Error processing turn:', error);
            return { success: false, error: error.message };
        }
    });

    // Clear session data
    ipcMain.handle('rag-clear-session', async (event, sessionId) => {
        try {
            const result = await clearSessionData(sessionId);
            return result;
        } catch (error) {
            console.error('Error clearing session data:', error);
            return { success: false, error: error.message };
        }
    });

    // Get RAG statistics
    ipcMain.handle('rag-get-stats', async (event) => {
        try {
            const stats = getRAGStats();
            return { success: true, stats };
        } catch (error) {
            console.error('Error getting RAG stats:', error);
            return { success: false, error: error.message };
        }
    });

    // Reset RAG system
    ipcMain.handle('rag-reset', async (event) => {
        try {
            await resetRAG();
            return { success: true };
        } catch (error) {
            console.error('Error resetting RAG:', error);
            return { success: false, error: error.message };
        }
    });

    console.log('RAG IPC handlers set up successfully');
}

module.exports = {
    setupRAGIpcHandlers,
};
