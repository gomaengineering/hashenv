/**
 * Secure logging utility
 * Prevents logging of sensitive information
 */

const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /credential/i,
  /auth/i,
];

/**
 * Sanitize log data to prevent sensitive information leakage
 */
export function sanitizeLogData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Don't log if it looks like a password or token
    if (data.length > 100) {
      return '[Large data omitted]';
    }
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return '[Buffer]';
  }

  const sanitized: any = Array.isArray(data) ? [] : {};

  for (const [key, value] of Object.entries(data)) {
    // Check if key contains sensitive keywords
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value)) {
      sanitized[key] = sanitizeLogData(value);
    } else if (Buffer.isBuffer(value)) {
      sanitized[key] = '[Buffer]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Secure error logger
 */
export function logError(error: Error, context?: Record<string, any>): void {
  const sanitizedContext = context ? sanitizeLogData(context) : {};
  
  console.error('Error:', {
    message: error.message,
    name: error.name,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    context: sanitizedContext,
    timestamp: new Date().toISOString(),
  });
}
