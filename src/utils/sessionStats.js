// Session statistics tracking module

class SessionStats {
    constructor() {
        this.reset();
    }

    reset() {
        this.startTime = null;
        this.endTime = null;
        this.responses = [];
        this.totalTokens = 0;
        this.topics = new Map(); // topic name -> count
    }

    start() {
        this.reset();
        this.startTime = Date.now();
    }

    end() {
        this.endTime = Date.now();
    }

    addResponse(response) {
        this.responses.push({
            text: response,
            timestamp: Date.now(),
        });
    }

    addTokens(count) {
        this.totalTokens += count;
    }

    // Simple topic extraction from responses
    extractTopics(response) {
        // Common technical topics to look for
        const topicPatterns = {
            'SQL': /\b(sql|database|query|select|insert|update|delete|join|table)\b/i,
            'Algorithms': /\b(algorithm|complexity|time complexity|space complexity|big o|sorting|searching)\b/i,
            'Data Structures': /\b(array|linked list|tree|graph|hash|stack|queue|heap)\b/i,
            'JavaScript': /\b(javascript|js|node|react|vue|angular|promise|async)\b/i,
            'Python': /\b(python|django|flask|pandas|numpy)\b/i,
            'System Design': /\b(system design|architecture|scalability|load balancing|caching|microservices)\b/i,
            'Behavioral': /\b(experience|team|project|challenge|conflict|leadership|communication)\b/i,
            'Networking': /\b(network|http|tcp|ip|dns|api|rest|websocket)\b/i,
            'Cloud': /\b(aws|azure|gcp|cloud|kubernetes|docker|container)\b/i,
            'Security': /\b(security|authentication|authorization|encryption|vulnerability)\b/i,
        };

        const foundTopics = [];
        for (const [topic, pattern] of Object.entries(topicPatterns)) {
            if (pattern.test(response)) {
                foundTopics.push(topic);
            }
        }

        return foundTopics;
    }

    analyzeResponse(response) {
        this.addResponse(response);

        // Extract and count topics
        const topics = this.extractTopics(response);
        topics.forEach(topic => {
            const count = this.topics.get(topic) || 0;
            this.topics.set(topic, count + 1);
        });
    }

    getDuration() {
        if (!this.startTime) return '0m 0s';

        const endTime = this.endTime || Date.now();
        const durationMs = endTime - this.startTime;
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes === 0) {
            return `${remainingSeconds}s`;
        }
        return `${minutes}m ${remainingSeconds}s`;
    }

    getTopTopics(limit = 5) {
        const topicsArray = Array.from(this.topics.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);

        return topicsArray;
    }

    getTotalResponses() {
        return this.responses.length;
    }

    getUnsavedCount() {
        // Since we don't track individual saved responses during the session,
        // all responses are considered unsaved until the session is saved to history
        // This is displayed as a warning in the SessionEndDialog
        return this.responses.length;
    }

    getSummary() {
        return {
            duration: this.getDuration(),
            totalResponses: this.getTotalResponses(),
            unsavedResponses: this.getUnsavedCount(),
            topics: this.getTopTopics(),
            tokenUsage: this.totalTokens,
        };
    }

    // Export session data for history
    exportSession() {
        return {
            startTime: this.startTime,
            endTime: this.endTime || Date.now(),
            duration: this.getDuration(),
            responses: this.responses,
            topics: Array.from(this.topics.entries()).map(([name, count]) => ({ name, count })),
            totalTokens: this.totalTokens,
        };
    }
}

// Create singleton instance
const sessionStats = new SessionStats();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SessionStats, sessionStats };
}

if (typeof window !== 'undefined') {
    window.sessionStats = sessionStats;
}
