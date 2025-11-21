/**
 * Session Analytics Utility
 * Tracks real-time metrics for coaching sessions:
 * - Adherence score (how well user follows AI suggestions)
 * - Response time (time to respond to questions)
 * - Filler words detection and counting
 * - Turn count tracking
 * - Session duration
 */

class SessionAnalytics {
    constructor() {
        this.reset();
    }

    reset() {
        this.sessionStartTime = null;
        this.sessionEndTime = null;
        this.turns = [];
        this.suggestions = [];
        this.responseTimes = [];
        this.fillerWordCount = 0;
        this.totalFillerWords = {};
        this.adherenceScores = [];
        this.currentQuestionTime = null;
    }

    /**
     * Start a new analytics session
     */
    startSession() {
        this.reset();
        this.sessionStartTime = Date.now();
        console.log('[Analytics] Session started:', new Date(this.sessionStartTime).toISOString());
    }

    /**
     * End the current session
     */
    endSession() {
        this.sessionEndTime = Date.now();
        console.log('[Analytics] Session ended:', new Date(this.sessionEndTime).toISOString());
    }

    /**
     * Track a conversation turn
     * @param {string} speaker - Speaker identifier ('You', 'Interviewer', etc.)
     * @param {string} text - The spoken text
     * @param {number} timestamp - Timestamp of the turn
     */
    trackTurn(speaker, text, timestamp = Date.now()) {
        const turn = {
            speaker,
            text,
            timestamp,
            fillerWords: this.detectFillerWords(text)
        };

        this.turns.push(turn);

        // Track response time if this is user responding to interviewer
        if (speaker === 'You' && this.currentQuestionTime) {
            const responseTime = timestamp - this.currentQuestionTime;
            this.responseTimes.push(responseTime);
            this.currentQuestionTime = null;
        } else if (speaker !== 'You') {
            // Mark when interviewer asks question
            this.currentQuestionTime = timestamp;
        }

        console.log(`[Analytics] Turn tracked: ${speaker} - ${text.substring(0, 50)}...`);
        return turn;
    }

    /**
     * Track an AI suggestion
     * @param {string} suggestedText - What the AI suggested
     * @param {number} timestamp - When it was suggested
     * @param {number} confidenceScore - AI's confidence in the suggestion (0-1)
     */
    trackSuggestion(suggestedText, timestamp = Date.now(), confidenceScore = null) {
        const suggestion = {
            suggestedText,
            timestamp,
            confidenceScore,
            actualResponse: null,
            adherenceScore: null
        };

        this.suggestions.push(suggestion);
        console.log(`[Analytics] Suggestion tracked: ${suggestedText.substring(0, 50)}...`);
        return suggestion;
    }

    /**
     * Calculate adherence score between suggested and actual text
     * Uses a simple similarity algorithm based on word overlap
     * @param {string} suggested - The suggested text
     * @param {string} actual - The actual text spoken
     * @returns {number} Adherence score from 0-100
     */
    calculateAdherence(suggested, actual) {
        if (!suggested || !actual) return 0;

        // Normalize text: lowercase, remove punctuation, split into words
        const normalize = (text) => {
            return text
                .toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(word => word.length > 2); // Ignore short words
        };

        const suggestedWords = normalize(suggested);
        const actualWords = normalize(actual);

        if (suggestedWords.length === 0 || actualWords.length === 0) return 0;

        // Calculate word overlap using Jaccard similarity
        const suggestedSet = new Set(suggestedWords);
        const actualSet = new Set(actualWords);

        const intersection = new Set([...suggestedSet].filter(word => actualSet.has(word)));
        const union = new Set([...suggestedSet, ...actualSet]);

        const jaccardScore = (intersection.size / union.size) * 100;

        // Calculate sequential matching bonus (if words appear in similar order)
        let sequentialMatches = 0;
        let maxSequence = 0;
        let currentSequence = 0;

        for (let i = 0; i < suggestedWords.length; i++) {
            const word = suggestedWords[i];
            const actualIndex = actualWords.indexOf(word);
            if (actualIndex !== -1 && actualIndex >= currentSequence) {
                currentSequence++;
                maxSequence = Math.max(maxSequence, currentSequence);
                sequentialMatches++;
            } else {
                currentSequence = 0;
            }
        }

        const sequenceBonus = (maxSequence / Math.max(suggestedWords.length, actualWords.length)) * 20;

        // Final score: weighted combination
        const finalScore = Math.min(100, Math.round((jaccardScore * 0.7) + (sequenceBonus * 0.3)));

        console.log(`[Analytics] Adherence calculated: ${finalScore}% (Jaccard: ${jaccardScore.toFixed(1)}, Sequence: ${sequenceBonus.toFixed(1)})`);
        return finalScore;
    }

    /**
     * Match the most recent suggestion with the user's actual response
     * @param {string} actualResponse - What the user actually said
     */
    matchSuggestionToResponse(actualResponse) {
        // Find the most recent unmatched suggestion
        const unmatched = this.suggestions.filter(s => s.actualResponse === null);
        if (unmatched.length === 0) {
            console.log('[Analytics] No unmatched suggestions to match');
            return null;
        }

        const latestSuggestion = unmatched[unmatched.length - 1];
        const adherenceScore = this.calculateAdherence(latestSuggestion.suggestedText, actualResponse);

        latestSuggestion.actualResponse = actualResponse;
        latestSuggestion.adherenceScore = adherenceScore;

        this.adherenceScores.push(adherenceScore);

        console.log(`[Analytics] Matched suggestion with adherence: ${adherenceScore}%`);
        return {
            suggestion: latestSuggestion.suggestedText,
            actual: actualResponse,
            adherenceScore
        };
    }

    /**
     * Detect and count filler words in text
     * @param {string} text - Text to analyze
     * @returns {Object} Count of each filler word detected
     */
    detectFillerWords(text) {
        const fillerPatterns = {
            'um': /\b(um|umm|ummm)\b/gi,
            'uh': /\b(uh|uhh|uhhh)\b/gi,
            'like': /\b(like)\b/gi,
            'you know': /\b(you know)\b/gi,
            'basically': /\b(basically)\b/gi,
            'actually': /\b(actually)\b/gi,
            'literally': /\b(literally)\b/gi,
            'sort of': /\b(sort of|kind of)\b/gi,
            'I mean': /\b(I mean)\b/gi,
            'well': /\b(well)\b/gi,
        };

        const detected = {};
        let totalCount = 0;

        for (const [filler, pattern] of Object.entries(fillerPatterns)) {
            const matches = text.match(pattern);
            if (matches && matches.length > 0) {
                detected[filler] = matches.length;
                totalCount += matches.length;

                // Update global count
                this.totalFillerWords[filler] = (this.totalFillerWords[filler] || 0) + matches.length;
            }
        }

        this.fillerWordCount += totalCount;
        return detected;
    }

    /**
     * Calculate average response time in milliseconds
     * @returns {number} Average response time
     */
    calculateAverageResponseTime() {
        if (this.responseTimes.length === 0) return 0;
        const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
        return Math.round(sum / this.responseTimes.length);
    }

    /**
     * Calculate overall adherence score (0-100%)
     * @returns {number} Average adherence score
     */
    calculateOverallAdherence() {
        if (this.adherenceScores.length === 0) return 0;
        const sum = this.adherenceScores.reduce((acc, score) => acc + score, 0);
        return Math.round(sum / this.adherenceScores.length);
    }

    /**
     * Get turn counts by speaker
     * @returns {Object} Turn counts for each speaker
     */
    getTurnCounts() {
        const counts = {};
        this.turns.forEach(turn => {
            counts[turn.speaker] = (counts[turn.speaker] || 0) + 1;
        });
        return counts;
    }

    /**
     * Get session duration in milliseconds
     * @returns {number} Session duration
     */
    getSessionDuration() {
        if (!this.sessionStartTime) return 0;
        const endTime = this.sessionEndTime || Date.now();
        return endTime - this.sessionStartTime;
    }

    /**
     * Format duration to human-readable string
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Get real-time metrics for dashboard
     * @returns {Object} Current session metrics
     */
    getRealTimeMetrics() {
        const turnCounts = this.getTurnCounts();
        const duration = this.getSessionDuration();

        return {
            adherenceScore: this.calculateOverallAdherence(),
            averageResponseTime: this.calculateAverageResponseTime(),
            fillerWordCount: this.fillerWordCount,
            fillerWordBreakdown: { ...this.totalFillerWords },
            turnCounts,
            totalTurns: this.turns.length,
            sessionDuration: duration,
            sessionDurationFormatted: this.formatDuration(duration),
            suggestionCount: this.suggestions.length,
            matchedSuggestions: this.suggestions.filter(s => s.actualResponse !== null).length
        };
    }

    /**
     * Get suggestion history for post-session review
     * @returns {Array} Array of suggestion/response pairs
     */
    getSuggestionHistory() {
        return this.suggestions.map(s => ({
            timestamp: new Date(s.timestamp).toISOString(),
            suggested: s.suggestedText,
            actual: s.actualResponse,
            adherenceScore: s.adherenceScore,
            confidenceScore: s.confidenceScore
        }));
    }

    /**
     * Generate comprehensive session report
     * @returns {Object} Complete session report
     */
    generateSessionReport() {
        const metrics = this.getRealTimeMetrics();
        const turnCounts = this.getTurnCounts();

        const report = {
            sessionInfo: {
                startTime: this.sessionStartTime ? new Date(this.sessionStartTime).toISOString() : null,
                endTime: this.sessionEndTime ? new Date(this.sessionEndTime).toISOString() : null,
                duration: metrics.sessionDuration,
                durationFormatted: metrics.sessionDurationFormatted
            },
            metrics: {
                adherenceScore: metrics.adherenceScore,
                averageResponseTime: metrics.averageResponseTime,
                averageResponseTimeFormatted: this.formatDuration(metrics.averageResponseTime),
                totalFillerWords: metrics.fillerWordCount,
                fillerWordBreakdown: metrics.fillerWordBreakdown,
                totalTurns: metrics.totalTurns,
                turnCounts,
                suggestionCount: metrics.suggestionCount,
                matchedSuggestions: metrics.matchedSuggestions,
                unmatchedSuggestions: metrics.suggestionCount - metrics.matchedSuggestions
            },
            suggestions: this.getSuggestionHistory(),
            turns: this.turns.map(turn => ({
                speaker: turn.speaker,
                text: turn.text,
                timestamp: new Date(turn.timestamp).toISOString(),
                fillerWords: turn.fillerWords
            })),
            responseTimes: this.responseTimes.map((time, index) => ({
                index: index + 1,
                responseTime: time,
                responseTimeFormatted: this.formatDuration(time)
            })),
            adherenceHistory: this.adherenceScores.map((score, index) => ({
                index: index + 1,
                score
            }))
        };

        console.log('[Analytics] Session report generated');
        return report;
    }

    /**
     * Export session report as JSON string
     * @param {boolean} pretty - Whether to pretty-print JSON
     * @returns {string} JSON string of session report
     */
    exportAsJSON(pretty = true) {
        const report = this.generateSessionReport();
        return JSON.stringify(report, null, pretty ? 2 : 0);
    }

    /**
     * Calculate response time for a specific turn
     * @param {number} questionTimestamp - When question was asked
     * @param {number} answerTimestamp - When answer was given
     * @returns {number} Response time in milliseconds
     */
    calculateResponseTime(questionTimestamp, answerTimestamp) {
        return answerTimestamp - questionTimestamp;
    }
}

// Create singleton instance
const sessionAnalytics = new SessionAnalytics();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SessionAnalytics, sessionAnalytics };
}

// Expose to window for renderer process
if (typeof window !== 'undefined') {
    window.sessionAnalytics = sessionAnalytics;
}
