/**
 * Validates if a string is a valid UUID v4 format
 */
export function isValidUserId(userId: string): boolean {
  // UUID v4 format validation
  const uuidV4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(userId);
}

/**
 * Validates if a string is a valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates if a string is a valid session ID format
 */
export function isValidSessionId(sessionId: string): boolean {
  // Session IDs are typically alphanumeric with optional hyphens/underscores
  const sessionIdRegex = /^[a-zA-Z0-9_-]{8,64}$/;
  return sessionIdRegex.test(sessionId);
}

/**
 * Validates if a string is a valid client ID format
 */
export function isValidClientId(clientId: string): boolean {
  // Client IDs are typically alphanumeric with optional hyphens/underscores
  const clientIdRegex = /^[a-zA-Z0-9_-]{1,64}$/;
  return clientIdRegex.test(clientId);
}
