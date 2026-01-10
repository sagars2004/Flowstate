import Groq from 'groq-sdk';
import { GroqRateLimiter } from './rateLimiter.js';
import { RequestQueue } from './requestQueue.js';

export interface GroqConfig {
  apiKey: string;
  model8B: string;
  model70B: string;
  maxTokens: number;
  temperature: number;
}

export class GroqClient {
  private client: Groq;
  private config: GroqConfig;
  private rateLimiter: GroqRateLimiter;
  private requestQueue: RequestQueue<string>;

  constructor(config: GroqConfig) {
    this.config = config;
    this.client = new Groq({
      apiKey: config.apiKey,
    });
    this.rateLimiter = new GroqRateLimiter({
      tokensPerMinute: 5000, // Conservative limit
      requestsPerMinute: 25, // Conservative limit
      burstSize: 5,
    });
    this.requestQueue = new RequestQueue(this.rateLimiter, 50, 3, 5000);
  }

  /**
   * Fast inference using Llama 3.1 8B Instant
   * Ideal for real-time interventions and quick responses
   * Rate-limited and queued to prevent API limit violations
   */
  async generateFast(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
    const estimatedTokens = options?.maxTokens || this.config.maxTokens;

    return this.requestQueue.enqueue(
      async () => {
        try {
          const completion = await this.client.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: this.config.model8B,
            max_tokens: estimatedTokens,
            temperature: options?.temperature || this.config.temperature,
          });

          return completion.choices[0]?.message?.content || '';
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorObj = error as any;
          
          // Handle rate limit errors specifically
          if (errorMessage.includes('429') || errorMessage.includes('rate_limit') || errorObj?.status === 429) {
            // Extract retry-after if available
            const retryAfter = this.extractRetryAfter(errorObj);
            if (retryAfter) {
              console.warn(`⏳ Rate limit hit. Retry after ${retryAfter}s`);
              await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            }
            throw new Error(`Rate limit exceeded: ${errorMessage}`);
          }

          console.error('Groq 8B inference error:', error);
          throw new Error(`Groq 8B API error: ${errorMessage}`);
        }
      },
      {
        priority: 1, // Higher priority for fast model
        estimatedTokens,
      }
    );
  }

  /**
   * Extract retry-after value from error response
   */
  private extractRetryAfter(error: any): number | null {
    if (error?.response?.headers?.['retry-after']) {
      return parseInt(error.response.headers['retry-after'], 10);
    }
    if (error?.message?.match(/try again in ([\d.]+)s/i)) {
      const match = error.message.match(/try again in ([\d.]+)s/i);
      return match ? Math.ceil(parseFloat(match[1])) : null;
    }
    return null;
  }

  /**
   * Deep analysis using Llama 3.1 70B Versatile (or 8B as fallback)
   * Ideal for post-session analysis and comprehensive insights
   * Rate-limited and queued to prevent API limit violations
   */
  async generateDeep(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
    const estimatedTokens = options?.maxTokens || this.config.maxTokens;

    return this.requestQueue.enqueue(
      async () => {
        try {
          const completion = await this.client.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: this.config.model70B,
            max_tokens: estimatedTokens,
            temperature: options?.temperature || this.config.temperature,
          });

          return completion.choices[0]?.message?.content || '';
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorObj = error as any;
          
          // Handle rate limit errors
          if (errorMessage.includes('429') || errorMessage.includes('rate_limit') || errorObj?.status === 429) {
            const retryAfter = this.extractRetryAfter(errorObj);
            if (retryAfter) {
              console.warn(`⏳ Rate limit hit (70B). Retry after ${retryAfter}s`);
              await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            }
            throw new Error(`Rate limit exceeded: ${errorMessage}`);
          }
          
          // Check if it's a model deprecation error
          if (
            errorMessage.includes('decommissioned') ||
            errorMessage.includes('model_decommissioned') ||
            (errorObj?.response?.status === 400 && errorMessage.includes('model'))
          ) {
            console.warn(`⚠️  Model ${this.config.model70B} is decommissioned. Falling back to ${this.config.model8B} for deep analysis.`);
            console.warn(`   Please update GROQ_MODEL_70B environment variable to a supported model.`);
            console.warn(`   Check https://console.groq.com/docs/models for available models.`);
            
            // Fallback to 8B model with increased tokens for deeper analysis
            try {
              const fallbackTokens = Math.min(estimatedTokens * 2, 4096);
              const completion = await this.client.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: this.config.model8B,
                max_tokens: fallbackTokens,
                temperature: options?.temperature || this.config.temperature,
              });

              console.log(`✓ Successfully used ${this.config.model8B} as fallback for deep analysis`);
              return completion.choices[0]?.message?.content || '';
            } catch (fallbackError) {
              const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
              console.error('Groq fallback model also failed:', fallbackError);
              throw new Error(
                `Groq API error: Both models failed. 70B error: ${errorMessage}, 8B fallback error: ${fallbackMessage}`
              );
            }
          }
          
          console.error('Groq 70B inference error:', error);
          throw new Error(`Groq 70B API error: ${errorMessage}`);
        }
      },
      {
        priority: 0, // Lower priority for deep analysis (can wait)
        estimatedTokens,
      }
    );
  }

  /**
   * Generate with chat history for contextual conversations
   * Rate-limited and queued
   */
  async generateWithHistory(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    useFastModel: boolean = true,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<string> {
    const modelToUse = useFastModel ? this.config.model8B : this.config.model70B;
    const estimatedTokens = options?.maxTokens || this.config.maxTokens;

    return this.requestQueue.enqueue(
      async () => {
        try {
          const completion = await this.client.chat.completions.create({
            messages,
            model: modelToUse,
            max_tokens: estimatedTokens,
            temperature: options?.temperature || this.config.temperature,
          });

          return completion.choices[0]?.message?.content || '';
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorObj = error as any;
          
          // Handle rate limit errors
          if (errorMessage.includes('429') || errorMessage.includes('rate_limit') || errorObj?.status === 429) {
            const retryAfter = this.extractRetryAfter(errorObj);
            if (retryAfter) {
              console.warn(`⏳ Rate limit hit. Retry after ${retryAfter}s`);
              await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            }
            throw new Error(`Rate limit exceeded: ${errorMessage}`);
          }
          
          // Handle model deprecation for chat history
          if (
            errorMessage.includes('decommissioned') ||
            errorMessage.includes('model_decommissioned') ||
            (errorObj?.response?.status === 400 && errorMessage.includes('model'))
          ) {
            console.warn(`⚠️  Model ${modelToUse} is decommissioned. Falling back to ${this.config.model8B}.`);
            console.warn(`   Please update GROQ_MODEL_${useFastModel ? '8' : '70'}B environment variable.`);
            
            // Always fallback to 8B model
            try {
              const completion = await this.client.chat.completions.create({
                messages,
                model: this.config.model8B,
                max_tokens: estimatedTokens,
                temperature: options?.temperature || this.config.temperature,
              });

              return completion.choices[0]?.message?.content || '';
            } catch (fallbackError) {
              const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
              console.error('Groq fallback model also failed:', fallbackError);
              throw new Error(
                `Groq API error: Model ${modelToUse} failed and fallback failed: ${fallbackMessage}`
              );
            }
          }
          
          console.error('Groq chat history error:', error);
          throw new Error(`Groq API error: ${errorMessage}`);
        }
      },
      {
        priority: useFastModel ? 1 : 0,
        estimatedTokens,
      }
    );
  }

  /**
   * Get rate limiter stats (for monitoring)
   */
  getRateLimitStats(): { availableTokens: number; queueSize: number; timeUntilNextRequest: number } {
    return {
      availableTokens: this.rateLimiter.getAvailableTokens(),
      queueSize: this.requestQueue.getQueueSize(),
      timeUntilNextRequest: this.rateLimiter.getTimeUntilNextRequest(),
    };
  }
}
