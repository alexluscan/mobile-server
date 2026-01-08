/**
 * User-friendly error message utility
 * Transforms raw error messages into friendly user-facing messages
 */

export function getFriendlyErrorMessage(error) {
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }

  const errorMessage = error.message || error.toString();
  const errorString = errorMessage.toLowerCase();

  // Network errors
  if (errorString.includes('network') || 
      errorString.includes('fetch') || 
      errorString.includes('failed to fetch') ||
      errorMessage.includes('ERR_NETWORK') ||
      errorMessage.includes('ERR_INTERNET_DISCONNECTED')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  // Timeout errors
  if (errorString.includes('timeout') || errorString.includes('timed out')) {
    return 'The request took too long. Please check your connection and try again.';
  }

  // Server errors (5xx)
  if (error.status === 500 || errorString.includes('500') || errorString.includes('internal server')) {
    return 'The server encountered an error. Please try again later.';
  }

  // Not found errors (4xx)
  if (error.status === 404 || errorString.includes('404') || errorString.includes('not found')) {
    return 'The requested item could not be found.';
  }

  // Validation errors (400)
  if (error.status === 400 || errorString.includes('400') || errorString.includes('bad request')) {
    const details = error.details || error.message;
    if (details && details !== errorMessage) {
      return `Invalid data: ${details}`;
    }
    return 'Invalid data provided. Please check your input and try again.';
  }

  // Unauthorized errors (401)
  if (error.status === 401 || errorString.includes('401') || errorString.includes('unauthorized')) {
    return 'You are not authorized to perform this action.';
  }

  // Forbidden errors (403)
  if (error.status === 403 || errorString.includes('403') || errorString.includes('forbidden')) {
    return 'You do not have permission to perform this action.';
  }

  // Database/Storage errors
  if (errorString.includes('database') || errorString.includes('indexeddb') || errorString.includes('storage')) {
    return 'Unable to save data locally. Please check your browser storage settings.';
  }

  // ID errors
  if (errorString.includes('id') && (errorString.includes('required') || errorString.includes('missing'))) {
    return 'An item identifier is required. Please try refreshing the page.';
  }

  // Connection errors
  if (errorString.includes('connection') || errorString.includes('connect')) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  // If we have a user-friendly message already, return it
  if (error.userMessage) {
    return error.userMessage;
  }

  // Generic fallback - hide technical details
  return 'Something went wrong. Please try again. If the problem persists, contact support.';
}

export function logError(operation, error, context = {}) {
  const friendlyMessage = getFriendlyErrorMessage(error);
  const errorDetails = {
    operation,
    error: error?.message || String(error),
    status: error?.status,
    stack: error?.stack,
    context,
    friendlyMessage
  };
  
  console.error(`[Client Error] ${operation}:`, errorDetails);
  return friendlyMessage;
}

