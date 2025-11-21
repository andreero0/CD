/**
 * Audio Correlation System
 *
 * Provides correlation ID tracking for audio chunks to solve the speaker attribution
 * race condition. Instead of using timestamps (which cause 50% miss rate due to
 * 1500ms transcription delay vs 1000ms attribution window), we use correlation IDs
 * that map directly from audio chunk to transcription result.
 *
 * Key Features:
 * - Unique correlation IDs for each audio chunk
 * - Maps correlation IDs to audio source (mic/system) and timestamp
 * - Automatic cleanup of expired entries (5 second timeout)
 * - Memory-efficient circular buffer approach
 */

// Map of correlationId -> { source, timestamp, expiresAt }
const correlationMap = new Map();

// Configuration
const EXPIRY_TIMEOUT = 5000; // 5 seconds - correlation IDs expire after this time
const CLEANUP_INTERVAL = 2000; // Run cleanup every 2 seconds

// Cleanup timer reference
let cleanupTimer = null;

/**
 * Generates a unique correlation ID for an audio chunk
 * Format: timestamp_random to ensure uniqueness and sortability
 *
 * @returns {string} Unique correlation ID
 */
function generateCorrelationId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11); // 9 character random string
    return `${timestamp}_${random}`;
}

/**
 * Tracks an audio chunk with its correlation ID and source
 *
 * @param {string} correlationId - The unique correlation ID for this audio chunk
 * @param {string} source - Audio source: 'mic' or 'system'
 * @param {number} timestamp - Optional timestamp (defaults to now)
 */
function trackAudioChunk(correlationId, source, timestamp = Date.now()) {
    // Validate inputs
    if (!correlationId || typeof correlationId !== 'string') {
        console.error('[AudioCorrelation] Invalid correlationId:', correlationId);
        return;
    }

    if (source !== 'mic' && source !== 'system') {
        console.error('[AudioCorrelation] Invalid source:', source, '- must be "mic" or "system"');
        return;
    }

    const expiresAt = Date.now() + EXPIRY_TIMEOUT;

    correlationMap.set(correlationId, {
        source,
        timestamp,
        expiresAt
    });

    // Start cleanup timer if not already running
    if (!cleanupTimer) {
        startCleanupTimer();
    }

    // Log for debugging (can be removed in production)
    if (process.env.DEBUG_CORRELATION) {
        console.log(`[AudioCorrelation] Tracked: ${correlationId} -> ${source} (total: ${correlationMap.size})`);
    }
}

/**
 * Resolves a correlation ID to its audio source
 * Removes the entry from the map after resolution to prevent memory leaks
 *
 * @param {string} correlationId - The correlation ID to resolve
 * @returns {{ source: string, timestamp: number } | null} Audio source info or null if not found/expired
 */
function resolveCorrelationId(correlationId) {
    if (!correlationId || typeof correlationId !== 'string') {
        console.error('[AudioCorrelation] Invalid correlationId for resolution:', correlationId);
        return null;
    }

    const entry = correlationMap.get(correlationId);

    if (!entry) {
        if (process.env.DEBUG_CORRELATION) {
            console.log(`[AudioCorrelation] No entry found for: ${correlationId}`);
        }
        return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
        if (process.env.DEBUG_CORRELATION) {
            console.log(`[AudioCorrelation] Entry expired for: ${correlationId}`);
        }
        correlationMap.delete(correlationId);
        return null;
    }

    // Resolve and remove from map (one-time use)
    const result = {
        source: entry.source,
        timestamp: entry.timestamp
    };

    correlationMap.delete(correlationId);

    if (process.env.DEBUG_CORRELATION) {
        console.log(`[AudioCorrelation] Resolved: ${correlationId} -> ${result.source} (remaining: ${correlationMap.size})`);
    }

    return result;
}

/**
 * Cleanup expired correlation IDs to prevent memory leaks
 * Runs periodically based on CLEANUP_INTERVAL
 */
function cleanupExpiredEntries() {
    const now = Date.now();
    let removedCount = 0;

    for (const [correlationId, entry] of correlationMap.entries()) {
        if (now > entry.expiresAt) {
            correlationMap.delete(correlationId);
            removedCount++;
        }
    }

    if (removedCount > 0 && process.env.DEBUG_CORRELATION) {
        console.log(`[AudioCorrelation] Cleanup: removed ${removedCount} expired entries (remaining: ${correlationMap.size})`);
    }

    // Stop cleanup timer if map is empty
    if (correlationMap.size === 0 && cleanupTimer) {
        stopCleanupTimer();
    }
}

/**
 * Starts the periodic cleanup timer
 */
function startCleanupTimer() {
    if (cleanupTimer) return; // Already running

    cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);

    if (process.env.DEBUG_CORRELATION) {
        console.log('[AudioCorrelation] Cleanup timer started');
    }
}

/**
 * Stops the periodic cleanup timer
 */
function stopCleanupTimer() {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;

        if (process.env.DEBUG_CORRELATION) {
            console.log('[AudioCorrelation] Cleanup timer stopped');
        }
    }
}

/**
 * Clears all correlation data (useful for session cleanup)
 */
function clearAll() {
    correlationMap.clear();
    stopCleanupTimer();

    if (process.env.DEBUG_CORRELATION) {
        console.log('[AudioCorrelation] All data cleared');
    }
}

/**
 * Gets statistics about the correlation map (for debugging)
 *
 * @returns {{ size: number, oldestTimestamp: number | null }}
 */
function getStats() {
    let oldestTimestamp = null;

    for (const entry of correlationMap.values()) {
        if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
            oldestTimestamp = entry.timestamp;
        }
    }

    return {
        size: correlationMap.size,
        oldestTimestamp
    };
}

module.exports = {
    generateCorrelationId,
    trackAudioChunk,
    resolveCorrelationId,
    clearAll,
    getStats,
    // Export for testing
    _internal: {
        correlationMap,
        EXPIRY_TIMEOUT,
        CLEANUP_INTERVAL
    }
};
