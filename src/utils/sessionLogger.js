const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SessionLogger {
    constructor() {
        this.logDir = null; // Lazy initialization
        this.currentLogFile = null;
        this.currentSession = null;
        this.logStream = null;
        this.hasCleanedUp = false; // Track if cleanup has run
    }

    // Lazy initialize log directory (called when first needed)
    getLogDirectory() {
        if (!this.logDir) {
            try {
                this.logDir = path.join(app.getPath('userData'), 'session-logs');
                this.ensureLogDirectory();
            } catch (error) {
                console.error('[SessionLogger] Error getting log directory:', error.message);
                // Fallback to temp directory
                this.logDir = path.join(require('os').tmpdir(), 'prism-session-logs');
                this.ensureLogDirectory();
            }
        }
        return this.logDir;
    }

    ensureLogDirectory() {
        if (this.logDir && !fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
            console.log('[SessionLogger] Created session logs directory:', this.logDir);
        }
    }

    startNewSession() {
        // Close previous session if exists
        this.endSession();

        // Ensure log directory is initialized
        const logDir = this.getLogDirectory();

        // Cleanup old logs (only on first session start when app is ready)
        if (!this.hasCleanedUp) {
            this.cleanupOldLogs();
            this.hasCleanedUp = true;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.currentSession = `session_${timestamp}`;
        this.currentLogFile = path.join(logDir, `${this.currentSession}.log`);

        // Create write stream
        this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });

        // Write session header
        this.write('='.repeat(80));
        this.write(`SESSION STARTED: ${new Date().toISOString()}`);
        this.write(`Platform: ${process.platform}`);
        this.write(`Node Version: ${process.version}`);
        this.write(`App Version: ${app.getVersion()}`);
        this.write('='.repeat(80));
        this.write('');

        console.log(`[SessionLogger] Started new session: ${this.currentLogFile}`);
        console.log(`[SessionLogger] Logs will be saved to: ${this.currentLogFile}`);

        return this.currentLogFile;
    }

    write(message) {
        if (!this.logStream) {
            return;
        }

        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ${message}\n`;

        this.logStream.write(logLine);
    }

    log(category, message) {
        const formattedMessage = `[${category}] ${message}`;
        console.log(formattedMessage);
        this.write(formattedMessage);
    }

    error(category, error) {
        const errorMessage = error instanceof Error ? error.stack : String(error);
        const formattedMessage = `[${category}] ERROR: ${errorMessage}`;
        console.error(formattedMessage);
        this.write(formattedMessage);
    }

    logTranscriptBuffer(reason, words, preview) {
        const message = `[Transcript Buffer] Sending buffered speech (${reason}, ${words} words): "${preview}"`;
        console.log(message);
        this.write(message);
    }

    logContextInjection(trigger) {
        const message = `[Context Injection] Sent to AI (trigger: ${trigger})`;
        console.log(message);
        this.write(message);
    }

    logAIResponse(action, preview) {
        const message = `[AI Response] ${action}: ${preview}`;
        console.log(message);
        this.write(message);
    }

    logStateTransition(from, to, reason) {
        const message = `[State Machine] ${from} → ${to} ${reason ? `(${reason})` : ''}`;
        console.log(message);
        this.write(message);
    }

    endSession() {
        if (this.logStream) {
            this.write('');
            this.write('='.repeat(80));
            this.write(`SESSION ENDED: ${new Date().toISOString()}`);
            this.write('='.repeat(80));

            this.logStream.end();
            this.logStream = null;
            console.log(`[SessionLogger] Session ended: ${this.currentLogFile}`);
        }

        this.currentSession = null;
        this.currentLogFile = null;
    }

    getCurrentLogFile() {
        return this.currentLogFile;
    }

    // Cleanup old log files (keep last 50 sessions)
    cleanupOldLogs() {
        const logDir = this.getLogDirectory();
        if (!logDir) return;

        try {
            const files = fs.readdirSync(logDir)
                .filter(file => file.startsWith('session_') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(logDir, file),
                    mtime: fs.statSync(path.join(logDir, file)).mtime.getTime()
                }))
                .sort((a, b) => b.mtime - a.mtime);

            // Keep last 50, delete the rest
            const filesToDelete = files.slice(50);

            filesToDelete.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                    console.log(`[SessionLogger] Deleted old log: ${file.name}`);
                } catch (err) {
                    console.error(`[SessionLogger] Failed to delete ${file.name}:`, err.message);
                }
            });

            if (filesToDelete.length > 0) {
                console.log(`[SessionLogger] Cleaned up ${filesToDelete.length} old log files`);
            }
        } catch (err) {
            console.error('[SessionLogger] Error during cleanup:', err.message);
        }
    }

    // Get list of recent log files
    getRecentLogs(count = 10) {
        const logDir = this.getLogDirectory();
        if (!logDir) return [];

        try {
            const files = fs.readdirSync(logDir)
                .filter(file => file.startsWith('session_') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(logDir, file),
                    size: fs.statSync(path.join(logDir, file)).size,
                    mtime: fs.statSync(path.join(logDir, file)).mtime
                }))
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
                .slice(0, count);

            return files;
        } catch (err) {
            console.error('[SessionLogger] Error getting recent logs:', err.message);
            return [];
        }
    }
}

// Create singleton instance
const sessionLogger = new SessionLogger();

module.exports = sessionLogger;
