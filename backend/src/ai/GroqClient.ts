import Groq from 'groq-sdk';

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

  constructor(config: GroqConfig) {
    this.config = config;
    this.client = new Groq({
      apiKey: config.apiKey,
    });
  }

  /**
   * Fast inference using Llama 3.1 8B Instant
   * Ideal for real-time interventions and quick responses
   */
  async generateFast(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: this.config.model8B,
        max_tokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Groq 8B inference error:', error);
      throw new Error(`Groq 8B API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deep analysis using Llama 3.1 70B Versatile
   * Ideal for post-session analysis and comprehensive insights
   */
  async generateDeep(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: this.config.model70B,
        max_tokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Groq 70B inference error:', error);
      throw new Error(`Groq 70B API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate with chat history for contextual conversations
   */
  async generateWithHistory(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    useFastModel: boolean = true,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        messages,
        model: useFastModel ? this.config.model8B : this.config.model70B,
        max_tokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Groq chat history error:', error);
      throw new Error(`Groq API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
