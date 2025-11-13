/**
 * Logger utility for frontend debugging and observability
 *
 * Provides structured logging with levels: DEBUG, INFO, WARN, ERROR
 * All logs include timestamp for correlation with backend logs
 */

const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

class Logger {
    constructor(minLevel = LogLevel.INFO) {
        this.minLevel = minLevel;
    }

    /**
     * Format timestamp consistently with Python backend
     */
    _formatTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * Internal logging function
     */
    _log(level, levelName, message, context = null) {
        if (level < this.minLevel) {
            return;
        }

        const timestamp = this._formatTimestamp();
        const prefix = `${timestamp} [${levelName}]`;

        // Choose appropriate console method
        const consoleMethod = {
            [LogLevel.DEBUG]: console.debug,
            [LogLevel.INFO]: console.info,
            [LogLevel.WARN]: console.warn,
            [LogLevel.ERROR]: console.error
        }[level] || console.log;

        if (context) {
            consoleMethod(`${prefix} ${message}`, context);
        } else {
            consoleMethod(`${prefix} ${message}`);
        }
    }

    /**
     * Log debug-level message (verbose details for development)
     */
    debug(message, context = null) {
        this._log(LogLevel.DEBUG, 'DEBUG', message, context);
    }

    /**
     * Log info-level message (normal operational messages)
     */
    info(message, context = null) {
        this._log(LogLevel.INFO, 'INFO', message, context);
    }

    /**
     * Log warning-level message (potential issues)
     */
    warn(message, context = null) {
        this._log(LogLevel.WARN, 'WARN', message, context);
    }

    /**
     * Log error-level message (errors requiring attention)
     */
    error(message, context = null) {
        this._log(LogLevel.ERROR, 'ERROR', message, context);
    }

    /**
     * Set minimum log level
     */
    setLevel(level) {
        this.minLevel = level;
    }
}

// Create singleton logger instance
// Default to INFO level (change to DEBUG for verbose logging)
const logger = new Logger(LogLevel.INFO);

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.Logger = Logger;
    window.LogLevel = LogLevel;
    window.logger = logger;
}
