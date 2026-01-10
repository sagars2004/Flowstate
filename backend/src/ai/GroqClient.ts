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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Groq 8B inference error:', error);
      throw new Error(`Groq 8B API error: ${errorMessage}`);
    }
  }

  /**
   * Deep analysis using Llama 3.1 70B Versatile (or 8B as fallback)
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorObj = error as any;
      
      // Check if it's a model deprecation error
      if (
        errorMessage.includes('decommissioned') ||
        errorMessage.includes('model_decommissioned') ||
        (errorObj?.response?.status === 400 && errorMessage.includes('model'))
      ) {
        console.warn(`⚠️  Model ${this.config.model70B} is decommissioned. Falling back to ${this.config.model8B} for deep analysis.`);
        console.warn(`   Please update GROQ_MODEL_70B environment variable to a supported model.`);
        console.warn(`   Check https://console.groq.com/docs/models for available models.`);
        console.warn(`   Common alternatives: llama-3.3-70b-versatile, llama-3.1-70b-versatile (new version)`);
        
        // Fallback to 8B model with increased tokens for deeper analysis
        try {
          const completion = await this.client.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: this.config.model8B,
            max_tokens: Math.min((options?.maxTokens || this.config.maxTokens) * 2, 4096), // Use more tokens but cap at 4096
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
  }

  /**
   * Generate with chat history for contextual conversations
   */
  async generateWithHistory(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    useFastModel: boolean = true,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<string> {
    const modelToUse = useFastModel ? this.config.model8B : this.config.model70B;
    
    try {
      const completion = await this.client.chat.completions.create({
        messages,
        model: modelToUse,
        max_tokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorObj = error as any;
      
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
            max_tokens: options?.maxTokens || this.config.maxTokens,
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
  }
}
