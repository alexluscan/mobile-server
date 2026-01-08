/**
 * Server-side logger with debug capabilities
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLogLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : LOG_LEVELS.DEBUG;

function formatLog(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const dataStr = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
  return `[${timestamp}] ${level} ${message}${dataStr}`;
}

export const logger = {
  debug(message, data) {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      console.log(formatLog('DEBUG', message, data));
    }
  },
  
  info(message, data) {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.log(formatLog('INFO', message, data));
    }
  },
  
  warn(message, data) {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      console.warn(formatLog('WARN', message, data));
    }
  },
  
  error(message, data) {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      console.error(formatLog('ERROR', message, data));
    }
  }
};

