/**
 * Conversation State Machine
 *
 * Tracks the coaching feedback loop by maintaining state between:
 * - What the AI suggests
 * - What the user actually says
 * - How well they match
 *
 * This enables the AI to provide real-time corrections and monitoring.
 */

// State machine states
const STATES = {
    IDLE: 'IDLE',                   // No active conversation
    SUGGESTING: 'SUGGESTING',       // AI just provided a suggestion
    MONITORING: 'MONITORING',       // User is speaking, AI is monitoring
    EVALUATING: 'EVALUATING',       // AI is evaluating user's response
};

class ConversationStateMachine {
    constructor() {
        this.state = STATES.IDLE;
        this.currentSuggestion = null;
        this.actualResponse = null;
        this.turnHistory = [];
        this.turnIdCounter = 0;
    }

    /**
     * Get current state
     * @returns {string} Current state
     */
    getState() {
        return this.state;
    }

    /**
     * Set state
     * @param {string} newState - New state to transition to
     */
    setState(newState) {
        if (!Object.values(STATES).includes(newState)) {
            console.error(`Invalid state: ${newState}`);
            return;
        }

        const oldState = this.state;
        this.state = newState;
        console.log(`[State Machine] ${oldState} → ${newState}`);
    }

    /**
     * Track a new suggestion from the AI
     * @param {string} text - The suggested text
     * @param {string} speaker - The speaker label (e.g., 'AI', 'Coach')
     * @returns {object} The suggestion object with metadata
     */
    trackSuggestion(text, speaker = 'AI') {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            console.warn('[State Machine] Attempted to track empty suggestion');
            return null;
        }

        const turnId = ++this.turnIdCounter;

        this.currentSuggestion = {
            text: text.trim(),
            timestamp: Date.now(),
            speaker: speaker,
            turnId: turnId,
        };

        // Clear previous actual response when new suggestion is made
        this.actualResponse = null;

        // Transition to SUGGESTING state
        this.setState(STATES.SUGGESTING);

        console.log(`[State Machine] Tracked suggestion #${turnId}: "${this.currentSuggestion.text.substring(0, 50)}..."`);

        return this.currentSuggestion;
    }

    /**
     * Get the current suggestion
     * @returns {object|null} The current suggestion or null if none
     */
    getCurrentSuggestion() {
        return this.currentSuggestion;
    }

    /**
     * Compare the user's actual response against the current suggestion
     * @param {string} actualText - What the user actually said
     * @returns {object} Comparison result with adherence score and analysis
     */
    compareResponse(actualText) {
        if (!actualText || typeof actualText !== 'string' || actualText.trim().length === 0) {
            console.warn('[State Machine] Attempted to compare empty response');
            return null;
        }

        if (!this.currentSuggestion) {
            console.warn('[State Machine] No current suggestion to compare against');
            return {
                actualText: actualText.trim(),
                timestamp: Date.now(),
                adherence: 0,
                analysis: 'No suggestion available to compare',
                hasSuggestion: false,
            };
        }

        // Transition to MONITORING state when user speaks
        this.setState(STATES.MONITORING);

        const adherence = this._calculateAdherence(this.currentSuggestion.text, actualText);

        this.actualResponse = {
            text: actualText.trim(),
            timestamp: Date.now(),
            adherence: adherence,
            turnId: this.currentSuggestion.turnId,
        };

        // Add to turn history for tracking
        this.turnHistory.push({
            turnId: this.currentSuggestion.turnId,
            suggestion: this.currentSuggestion.text,
            actual: actualText.trim(),
            adherence: adherence,
            timestamp: Date.now(),
        });

        // Keep history limited to last 10 turns
        if (this.turnHistory.length > 10) {
            this.turnHistory.shift();
        }

        console.log(`[State Machine] Response adherence: ${adherence}%`);

        return {
            suggestion: this.currentSuggestion.text,
            actualText: actualText.trim(),
            timestamp: this.actualResponse.timestamp,
            adherence: adherence,
            analysis: this._getAdherenceAnalysis(adherence),
            hasSuggestion: true,
        };
    }

    /**
     * Calculate adherence score between suggestion and actual response
     * Uses a simple word overlap algorithm (0-100)
     * @private
     * @param {string} suggested - The suggested text
     * @param {string} actual - The actual text spoken
     * @returns {number} Adherence score 0-100
     */
    _calculateAdherence(suggested, actual) {
        try {
            // Normalize both strings: lowercase, remove punctuation, split into words
            const normalize = (str) => str
                .toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(word => word.length > 0);

            const suggestedWords = normalize(suggested);
            const actualWords = normalize(actual);

            if (suggestedWords.length === 0 || actualWords.length === 0) {
                return 0;
            }

            // Calculate word overlap
            const suggestedSet = new Set(suggestedWords);
            const actualSet = new Set(actualWords);

            let matchCount = 0;
            for (const word of actualSet) {
                if (suggestedSet.has(word)) {
                    matchCount++;
                }
            }

            // Calculate adherence as percentage of overlap
            // Average the overlap from both perspectives (suggested → actual, actual → suggested)
            const suggestedCoverage = matchCount / suggestedSet.size;
            const actualCoverage = matchCount / actualSet.size;
            const adherence = ((suggestedCoverage + actualCoverage) / 2) * 100;

            return Math.round(Math.min(100, Math.max(0, adherence)));
        } catch (error) {
            console.error('[State Machine] Error calculating adherence:', error);
            return 0;
        }
    }

    /**
     * Get a human-readable analysis of the adherence score
     * @private
     * @param {number} adherence - Adherence score 0-100
     * @returns {string} Analysis description
     */
    _getAdherenceAnalysis(adherence) {
        if (adherence >= 80) {
            return 'Excellent adherence - user followed suggestion very closely';
        } else if (adherence >= 60) {
            return 'Good adherence - user followed key points with some variation';
        } else if (adherence >= 40) {
            return 'Moderate adherence - user partially followed suggestion';
        } else if (adherence >= 20) {
            return 'Low adherence - user deviated significantly from suggestion';
        } else {
            return 'Minimal adherence - user did not follow suggestion';
        }
    }

    /**
     * Get the turn history
     * @returns {Array} Array of turn objects
     */
    getTurnHistory() {
        return this.turnHistory;
    }

    /**
     * Clear all state (useful for starting new sessions)
     */
    reset() {
        this.state = STATES.IDLE;
        this.currentSuggestion = null;
        this.actualResponse = null;
        this.turnHistory = [];
        this.turnIdCounter = 0;
        console.log('[State Machine] Reset to initial state');
    }

    /**
     * Get summary of current coaching state
     * @returns {object} Summary object
     */
    getSummary() {
        return {
            state: this.state,
            hasSuggestion: this.currentSuggestion !== null,
            hasResponse: this.actualResponse !== null,
            currentTurnId: this.currentSuggestion?.turnId || null,
            historyLength: this.turnHistory.length,
        };
    }
}

// Export singleton instance and STATES
const conversationState = new ConversationStateMachine();

module.exports = {
    conversationState,
    STATES,
    ConversationStateMachine, // Export class for testing
};
