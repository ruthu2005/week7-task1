/**
 * Token Blacklist Store for JWT Invalidation upon Logout
 * Stores revoked JWTs until their natural expiration timestamp.
 */
class TokenBlacklist {
  constructor() {
    this.blacklistedTokens = new Map(); // token -> expiry timestamp in ms

    // Periodic cleanup of expired tokens every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000);

    // Prevent interval from keeping the Node process alive during tests
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Add a token to the blacklist
   * @param {string} token - The raw JWT token string
   * @param {number} expInSeconds - Expiry timestamp in seconds (from JWT payload `exp`)
   */
  add(token, expInSeconds) {
    if (!token) return;
    // If exp is provided, calculate expiration time; otherwise default to 24 hours
    const expiryTime = expInSeconds ? expInSeconds * 1000 : Date.now() + 24 * 60 * 60 * 1000;
    this.blacklistedTokens.set(token, expiryTime);
  }

  /**
   * Check if a token is revoked / blacklisted
   * @param {string} token - The raw JWT token string
   * @returns {boolean}
   */
  isBlacklisted(token) {
    if (!token || !this.blacklistedTokens.has(token)) return false;

    const expiryTime = this.blacklistedTokens.get(token);
    if (Date.now() > expiryTime) {
      this.blacklistedTokens.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Cleanup expired tokens from the blacklist map
   */
  cleanup() {
    const now = Date.now();
    for (const [token, expiryTime] of this.blacklistedTokens.entries()) {
      if (now > expiryTime) {
        this.blacklistedTokens.delete(token);
      }
    }
  }

  /**
   * Clear all tokens (useful for testing)
   */
  clear() {
    this.blacklistedTokens.clear();
  }

  /**
   * Get total count of blacklisted tokens
   */
  count() {
    return this.blacklistedTokens.size;
  }
}

export const tokenBlacklist = new TokenBlacklist();
