import { LLMConfig } from '../types';

export abstract class BaseLLM {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  abstract generateResponse(prompt: string): Promise<string>;

  protected validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error(`API key is required for ${this.config.provider}`);
    }
  }
} 