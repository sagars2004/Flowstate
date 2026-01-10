/**
 * Request queue for handling rate-limited API calls
 * Queues requests when rate limited and processes them when capacity is available
 */

interface QueuedRequest<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

export class RequestQueue<T> {
  private queue: QueuedRequest<T>[] = [];
  private processing = false;
  private readonly maxQueueSize: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    private rateLimiter: { acquire: (tokens?: number) => Promise<boolean> },
    maxQueueSize: number = 50,
    maxRetries: number = 3,
    retryDelay: number = 5000
  ) {
    this.maxQueueSize = maxQueueSize;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Add a request to the queue
   */
  async enqueue(
    execute: () => Promise<T>,
    options: {
      priority?: number;
      estimatedTokens?: number;
      maxRetries?: number;
    } = {}
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Check queue size
      if (this.queue.length >= this.maxQueueSize) {
        reject(new Error('Request queue is full. Please try again later.'));
        return;
      }

      const request: QueuedRequest<T> = {
        id: `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        execute,
        resolve,
        reject,
        priority: options.priority || 0,
        timestamp: Date.now(),
        retries: 0,
        maxRetries: options.maxRetries || this.maxRetries,
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.queue.findIndex((r) => r.priority < request.priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      // Start processing if not already processing
      if (!this.processing) {
        void this.processQueue();
      }
    });
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue[0];

      // Check rate limit
      const canProceed = await this.rateLimiter.acquire(200); // Default token estimate

      if (!canProceed) {
        // Wait before retrying
        const waitTime = 2000; // 2 seconds
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      // Remove from queue
      this.queue.shift();

      // Execute request
      try {
        const result = await request.execute();
        request.resolve(result);
      } catch (error) {
        // Check if it's a rate limit error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRateLimit = errorMessage.includes('429') || errorMessage.includes('rate_limit');

        if (isRateLimit && request.retries < request.maxRetries) {
          // Retry after delay
          request.retries++;
          const delay = this.retryDelay * Math.pow(2, request.retries - 1); // Exponential backoff
          console.warn(`Rate limit hit. Retrying request ${request.id} in ${delay}ms (attempt ${request.retries}/${request.maxRetries})`);

          setTimeout(() => {
            this.queue.unshift(request); // Add back to front of queue
            void this.processQueue();
          }, delay);
        } else {
          // Max retries reached or non-rate-limit error
          request.reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }

    this.processing = false;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue.forEach((request) => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}
