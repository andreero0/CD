// Response context tracking utility
// Captures questions, timing, and metadata for each response

class ResponseContext {
    constructor() {
        this.contexts = new Map(); // responseId -> context data
        this.questionQueue = []; // Pending questions awaiting responses
    }

    /**
     * Extract topic tags from question text
     * @param {string} text - The question text
     * @returns {Array<string>} - Array of topic tags
     */
    extractTags(text) {
        const tagPatterns = {
            'SQL': /\b(sql|database|query|select|insert|update|delete|join|table|postgres|mysql)\b/i,
            'Database': /\b(database|db|nosql|mongodb|redis|index|transaction)\b/i,
            'Algorithms': /\b(algorithm|complexity|time complexity|space complexity|big o|sorting|searching)\b/i,
            'Data Structures': /\b(array|linked list|tree|graph|hash|stack|queue|heap|binary|bst)\b/i,
            'JavaScript': /\b(javascript|js|node|react|vue|angular|promise|async|typescript)\b/i,
            'Python': /\b(python|django|flask|pandas|numpy|pip)\b/i,
            'Java': /\b(java|spring|maven|gradle|jvm)\b/i,
            'System Design': /\b(system design|architecture|scalability|load balancing|caching|microservices)\b/i,
            'Behavioral': /\b(experience|team|project|challenge|conflict|leadership|communication|tell me about)\b/i,
            'Networking': /\b(network|http|tcp|ip|dns|api|rest|websocket|protocol)\b/i,
            'Cloud': /\b(aws|azure|gcp|cloud|kubernetes|docker|container|s3|lambda)\b/i,
            'Security': /\b(security|authentication|authorization|encryption|vulnerability|ssl|oauth)\b/i,
            'Frontend': /\b(frontend|ui|ux|css|html|dom|browser|responsive)\b/i,
            'Backend': /\b(backend|server|api|endpoint|middleware|route)\b/i,
            'Testing': /\b(test|testing|unit test|integration|qa|mock|jest|junit)\b/i,
            'DevOps': /\b(devops|ci|cd|deployment|pipeline|jenkins|github actions)\b/i,
            'Mobile': /\b(mobile|android|ios|react native|swift|kotlin)\b/i,
            'Web': /\b(web|website|webapp|http|url|browser)\b/i,
        };

        const foundTags = [];
        for (const [tag, pattern] of Object.entries(tagPatterns)) {
            if (pattern.test(text)) {
                foundTags.push(tag);
            }
        }

        // If no specific tags found, add a generic tag
        if (foundTags.length === 0) {
            foundTags.push('General');
        }

        return foundTags;
    }

    /**
     * Capture a question that will be answered
     * @param {string} question - The question text
     * @returns {string} - Question ID
     */
    captureQuestion(question) {
        const questionId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.questionQueue.push({
            id: questionId,
            text: question,
            askedAt: Date.now(),
            tags: this.extractTags(question),
        });
        return questionId;
    }

    /**
     * Link a response to its question
     * @param {string} responseId - The response identifier
     * @param {string} responseText - The response text
     * @param {string} questionId - Optional question ID if known
     */
    linkResponse(responseId, responseText, questionId = null) {
        let questionData;

        if (questionId) {
            // Find specific question
            const index = this.questionQueue.findIndex(q => q.id === questionId);
            if (index !== -1) {
                questionData = this.questionQueue.splice(index, 1)[0];
            }
        } else if (this.questionQueue.length > 0) {
            // Use oldest pending question
            questionData = this.questionQueue.shift();
        }

        const now = Date.now();
        const context = {
            responseId,
            responseText,
            question: questionData ? questionData.text : 'Voice/Screen Question',
            askedAt: questionData ? questionData.askedAt : now,
            answeredAt: now,
            generationTime: questionData ? now - questionData.askedAt : 0,
            tags: questionData ? questionData.tags : this.extractTags(responseText),
        };

        this.contexts.set(responseId, context);
        return context;
    }

    /**
     * Get context for a response
     * @param {string} responseId
     * @returns {Object|null}
     */
    getContext(responseId) {
        return this.contexts.get(responseId) || null;
    }

    /**
     * Get all contexts
     * @returns {Array<Object>}
     */
    getAllContexts() {
        return Array.from(this.contexts.values());
    }

    /**
     * Format time ago (e.g., "2m ago", "30s ago")
     * @param {number} timestamp
     * @returns {string}
     */
    formatTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) {
            return `${seconds}s ago`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes}m ago`;
        } else if (seconds < 86400) {
            const hours = Math.floor(seconds / 3600);
            return `${hours}h ago`;
        } else {
            const days = Math.floor(seconds / 86400);
            return `${days}d ago`;
        }
    }

    /**
     * Format generation time (e.g., "2.3s", "1.2s")
     * @param {number} milliseconds
     * @returns {string}
     */
    formatGenerationTime(milliseconds) {
        if (milliseconds < 1000) {
            return `${milliseconds}ms`;
        }
        return `${(milliseconds / 1000).toFixed(1)}s`;
    }

    /**
     * Clear all contexts (for new session)
     */
    clear() {
        this.contexts.clear();
        this.questionQueue = [];
    }
}

// Create singleton instance
const responseContext = new ResponseContext();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ResponseContext, responseContext };
}

if (typeof window !== 'undefined') {
    window.responseContext = responseContext;
}
