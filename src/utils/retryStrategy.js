/**
 * Retry Strategy with Exponential Backoff
 * Implements exponential backoff for retry attempts with configurable limits
 */

class RetryStrategy {
    /**
     * Create a new RetryStrategy instance
     * @param {Object} options - Configuration options
     * @param {number} options.maxAttempts - Maximum number of retry attempts (default: 3)
     * @param {number} options.baseDelay - Base delay in milliseconds (default: 1000)
     * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 10000)
     */
    constructor(options = {}) {
        this.maxAttempts = options.maxAttempts || 3;
        this.baseDelay = options.baseDelay || 1000; // 1 second
        this.maxDelay = options.maxDelay || 10000; // 10 seconds
        this.attempts = 0;
    }

    /**
     * Get the next delay duration using exponential backoff
     * Formula: min(baseDelay * 2^attempts, maxDelay)
     * Sequence: 1s, 2s, 4s, 8s, capped at 10s
     * @returns {number} Delay in milliseconds
     */
    getNextDelay() {
        const delay = Math.min(this.baseDelay * Math.pow(2, this.attempts), this.maxDelay);
        this.attempts++;
        return delay;
    }

    /**
     * Check if another retry attempt should be made
     * @returns {boolean} True if more attempts are available
     */
    shouldRetry() {
        return this.attempts < this.maxAttempts;
    }

    /**
     * Reset the retry counter to start fresh
     */
    reset() {
        this.attempts = 0;
    }

    /**
     * Get the current attempt count
     * @returns {number} Current number of attempts
     */
    getAttemptCount() {
        return this.attempts;
    }
}

module.exports = RetryStrategy;
