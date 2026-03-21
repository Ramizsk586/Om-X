/**
 * Safely serialize structured log metadata.
 * @param {unknown} details Supplemental log details.
 * @returns {string} String payload that can be appended to a log line.
 */
function stringifyDetails(details) {
  if (details == null) return '';
  if (typeof details === 'string') return ` ${details}`;

  try {
    return ` ${JSON.stringify(details)}`;
  } catch (_) {
    return ' [unserializable-details]';
  }
}

/**
 * Format a machine-readable log line.
 * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'} level Log severity level.
 * @param {string} moduleName Logical module name.
 * @param {string} message Human-readable log message.
 * @param {unknown} [details] Optional structured metadata.
 * @returns {string} Formatted log line.
 */
function formatLogLine(level, moduleName, message, details) {
  return `[${new Date().toISOString()}] [${level}] [${moduleName}] ${message}${stringifyDetails(details)}`;
}

/**
 * Create a structured logger for a server module.
 * @param {string} moduleName Module or subsystem name.
 * @returns {{debug(message: string, details?: unknown): void, info(message: string, details?: unknown): void, warn(message: string, details?: unknown): void, error(message: string, details?: unknown): void}} Logger facade.
 */
function createLogger(moduleName) {
  return {
    debug(message, details) {
      if (process.env.NODE_ENV === 'production') return;
      console.debug(formatLogLine('DEBUG', moduleName, message, details));
    },
    info(message, details) {
      console.info(formatLogLine('INFO', moduleName, message, details));
    },
    warn(message, details) {
      console.warn(formatLogLine('WARN', moduleName, message, details));
    },
    error(message, details) {
      console.error(formatLogLine('ERROR', moduleName, message, details));
    }
  };
}

module.exports = {
  createLogger,
  formatLogLine
};
