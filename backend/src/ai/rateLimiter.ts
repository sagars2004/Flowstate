/**
 * Rate limiter for Groq API calls
 * Prevents exceeding API rate limits with token bucket algorithm
 */

interface RateLimitConfig {
  tokensPerMinute: number; // Max tokens per minute
  requestsPerMinute: number; // Max requests per minute
  burstSize: number; // Max burst requests
}

export class GroqRateLimiter {
  private readonly config: RateLimitConfig;
  private tokens: number;
  private requests: number[];
  private lastRefill: number;
  private readonly minRequestInterval: number; // Minimum ms between requests
  private readonly sessionInterventions: Map<string, number>; // sessionId -> last intervention time

  constructor(config: Partial<RateLimitConfig> = {}) {
    // Conservative defaults based on Groq free tier limits
    // Free tier: 6000 TPM, ~30 requests/min
    this.config = {
      tokensPerMinute: config.tokensPerMinute || 5000, // Leave buffer
      requestsPerMinute: config.requestsPerMinute || 25, // Leave buffer
      burstSize: config.burstSize || 5,
    };

    this.tokens = this.config.tokensPerMinute;
    this.requests = [];
    this.lastRefill = Date.now();
    this.minRequestInterval = (60 * 1000) / this.config.requestsPerMinute; // ms between requests
    this.sessionInterventions = new Map();
  }

  /**
   * Check if a request can be made, and consume tokens if allowed
   */
  async acquire(estimatedTokens: number = 200): Promise<boolean> {
    const now = Date.now();
    this.refillTokens(now);

    // Check request rate limit
    this.cleanOldRequests(now);
    if (this.requests.length >= this.config.requestsPerMinute) {
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + 60000 - now;
      if (waitTime > 0) {
        console.warn(`⏳ Rate limit: Too many requests. Wait ${Math.ceil(waitTime / 1000)}s`);
        return false;
      }
    }

    // Check token limit
    if (this.tokens < estimatedTokens) {
      const tokensPerSecond = this.config.tokensPerMinute / 60;
      const waitTime = ((estimatedTokens - this.tokens) / tokensPerSecond) * 1000;
      console.warn(`⏳ Rate limit: Not enough tokens. Need ${estimatedTokens}, have ${Math.floor(this.tokens)}. Wait ${Math.ceil(waitTime / 1000)}s`);
      return false;
    }

    // Consume tokens and record request
    this.tokens -= estimatedTokens;
    this.requests.push(now);
    return true;
  }

  /**
   * Check if intervention can be sent for a session (throttle per session)
   */
  canSendIntervention(sessionId: string, minIntervalMs: number = 10 * 60 * 1000): boolean {
    const lastIntervention = this.sessionInterventions.get(sessionId);
    if (!lastIntervention) {
      return true;
    }

    const timeSinceLastIntervention = Date.now() - lastIntervention;
    if (timeSinceLastIntervention < minIntervalMs) {
      console.debug(`Intervention throttled for session ${sessionId}: ${Math.ceil((minIntervalMs - timeSinceLastIntervention) / 1000)}s remaining`);
      return false;
    }

    return true;
  }

  /**
   * Record that an intervention was sent
   */
  recordIntervention(sessionId: string): void {
    this.sessionInterventions.set(sessionId, Date.now());
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillTokens(now: number): void {
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 60000) * this.config.tokensPerMinute;
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.config.tokensPerMinute, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Remove requests older than 1 minute
   */
  private cleanOldRequests(now: number): void {
    const oneMinuteAgo = now - 60000;
    this.requests = this.requests.filter((time) => time > oneMinuteAgo);
  }

  /**
   * Get current token count (for debugging)
   */
  getAvailableTokens(): number {
    const now = Date.now();
    this.refillTokens(now);
    return Math.floor(this.tokens);
  }

  /**
   * Get time until next request can be made
   */
  getTimeUntilNextRequest(): number {
    if (this.requests.length < this.config.requestsPerMinute) {
      return 0;
    }

    const oldestRequest = this.requests[0];
    const waitTime = oldestRequest + 60000 - Date.now();
    return Math.max(0, waitTime);
  }

  /**
   * Clear intervention history for a session
   */
  clearSession(sessionId: string): void {
    this.sessionInterventions.delete(sessionId);
  }
}
