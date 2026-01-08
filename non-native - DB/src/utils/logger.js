/**
 * Client-side debug logger
 */

const isDebugEnabled = process.env.NODE_ENV === 'development' || 
  localStorage.getItem('debug') === 'true';

export const logger = {
  debug(message, data) {
    if (isDebugEnabled) {
      const timestamp = new Date().toISOString();
      const dataStr = data ? ` ${JSON.stringify(data)}` : '';
      console.log(`[DEBUG] [${timestamp}] ${message}${dataStr}`);
    }
  },
  
  info(message, data) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    console.info(`[INFO] [${timestamp}] ${message}${dataStr}`);
  },
  
  warn(message, data) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    console.warn(`[WARN] [${timestamp}] ${message}${dataStr}`);
  },
  
  error(message, data) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    console.error(`[ERROR] [${timestamp}] ${message}${dataStr}`);
  }
};

