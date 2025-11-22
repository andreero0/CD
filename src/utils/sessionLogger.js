/**
 * Session Logger Utility
 * Provides structured logging for transcript buffering system
 * Tracks debounce activity, buffer rejections, and context truncation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class SessionLogger {
    constructor() {
        this.logsDir = this.getLogsDir();
        this.currentLogFile = null;
        this.sessionStartTime = null;
        this.logsEnabled = true;
    }

    /**
     * Get the logs directory path based on OS
     * @returns {string} Path to logs directory
     */
    getLogsDir() {
        const platform = os.platform();
        let logsDir;

        if (platform === 'win32') {
            // Windows: %APPDATA%\prism-config\logs
            logsDir = path.join(os.homedir(), 'AppData', 'Roaming', 'prism-config', 'logs');
        } else if (platform === 'darwin') {
            // macOS: ~/Library/Application Support/prism-config/logs
            logsDir = path.join(os.homedir(), 'Library', 'Application Support', 'prism-config', 'logs');
        } else {
            // Linux and others: ~/.config/prism-config/logs
            logsDir = path.join(os.homedir(), '.config', 'prism-config', 'logs');
        }

        return logsDir;
    }

    /**
     * Ensure the logs directory exists
     */
    ensureLogsDir() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    /**
     * Start a new logging session
     * Creates a new log file for this session
     */
    startSession() {
        try {
            this.sessionStartTime = new Date();
            this.ensureLogsDir();

            // Create log file with timestamp
            const timestamp = this.sessionStartTime.toISOString().replace(/[:.]/g, '-');
            const fileName = `session-${timestamp}.log`;
            this.currentLogFile = path.join(this.logsDir, fileName);

            const startEntry = `[${this.sessionStartTime.toISOString()}] [Session] Started\n`;
            fs.writeFileSync(this.currentLogFile, startEntry, { flag: 'w' });

            console.log('[SessionLogger] Session started:', this.currentLogFile);
        } catch (error) {
            console.error('[SessionLogger] Error starting session:', error.message);
            this.logsEnabled = false;
        }
    }

    /**
     * End the current logging session
     */
    endSession() {
        if (!this.currentLogFile || !this.logsEnabled) return;

        try {
            const timestamp = new Date().toISOString();
            const endEntry = `[${timestamp}] [Session] Ended\n`;
            this.writeLog(endEntry);

            console.log('[SessionLogger] Session ended:', this.currentLogFile);
            this.currentLogFile = null;
            this.sessionStartTime = null;
        } catch (error) {
            console.error('[SessionLogger] Error ending session:', error.message);
        }
    }

    /**
     * Write a log entry to the current log file
     * @param {string} logEntry - The log entry to write
     */
    writeLog(logEntry) {
        if (!this.currentLogFile || !this.logsEnabled) {
            // Fall back to console if file logging is disabled
            console.log(logEntry);
            return;
        }

        try {
            // Ensure entry ends with newline
            const entry = logEntry.endsWith('\n') ? logEntry : logEntry + '\n';
            fs.appendFileSync(this.currentLogFile, entry);
        } catch (error) {
            console.error('[SessionLogger] Error writing log:', error.message);
            // Fall back to console
            console.log(logEntry);
        }
    }

    /**
     * Logs debounce activity
     * @param {string} action - Action (scheduled/cancelled/executed)
     * @param {number} delay - Delay in ms
     */
    logDebounce(action, delay) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [Debounce] ${action} (delay: ${delay}ms)`;
        this.writeLog(logEntry);
    }

    /**
     * Logs buffer rejection
     * @param {string} reason - Rejection reason
     * @param {number} wordCount - Current word count
     */
    logBufferRejection(reason, wordCount) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [Buffer Rejection] ${reason} (words: ${wordCount})`;
        this.writeLog(logEntry);
    }

    /**
     * Logs context truncation
     * @param {number} originalSize - Original size
     * @param {number} truncatedSize - Truncated size
     */
    logContextTruncation(originalSize, truncatedSize) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [Context Truncation] ${originalSize} → ${truncatedSize} chars`;
        this.writeLog(logEntry);
    }

    /**
     * Log a generic message with custom category
     * @param {string} category - Log category/type
     * @param {string} message - Log message
     */
    log(category, message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${category}] ${message}`;
        this.writeLog(logEntry);
    }

    /**
     * Get the current log file path
     * @returns {string|null} Path to current log file
     */
    getCurrentLogFile() {
        return this.currentLogFile;
    }

    /**
     * Get all log files in the logs directory
     * @returns {Array<string>} Array of log file paths
     */
    getLogFiles() {
        try {
            this.ensureLogsDir();
            const files = fs.readdirSync(this.logsDir);
            return files
                .filter(file => file.endsWith('.log'))
                .map(file => path.join(this.logsDir, file))
                .sort()
                .reverse(); // Most recent first
        } catch (error) {
            console.error('[SessionLogger] Error reading log files:', error.message);
            return [];
        }
    }

    /**
     * Read the contents of a log file
     * @param {string} filePath - Path to log file
     * @returns {string} Log file contents
     */
    readLogFile(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            console.error('[SessionLogger] Error reading log file:', error.message);
            return '';
        }
    }

    /**
     * Clear old log files (keep last N files)
     * @param {number} keepCount - Number of recent log files to keep
     */
    clearOldLogs(keepCount = 10) {
        try {
            const logFiles = this.getLogFiles();
            const filesToDelete = logFiles.slice(keepCount);

            filesToDelete.forEach(file => {
                try {
                    fs.unlinkSync(file);
                    console.log('[SessionLogger] Deleted old log:', file);
                } catch (error) {
                    console.error('[SessionLogger] Error deleting log:', error.message);
                }
            });

            if (filesToDelete.length > 0) {
                console.log(`[SessionLogger] Cleared ${filesToDelete.length} old log files`);
            }
        } catch (error) {
            console.error('[SessionLogger] Error clearing old logs:', error.message);
        }
    }

    /**
     * Enable or disable file logging
     * @param {boolean} enabled - Whether to enable logging
     */
    setLoggingEnabled(enabled) {
        this.logsEnabled = enabled;
        console.log('[SessionLogger] Logging', enabled ? 'enabled' : 'disabled');
    }
}

// Create singleton instance
const sessionLogger = new SessionLogger();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SessionLogger, sessionLogger };
}

// Expose to window for renderer process
if (typeof window !== 'undefined') {
    window.sessionLogger = sessionLogger;
}
