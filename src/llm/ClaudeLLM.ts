import Anthropic from '@anthropic-ai/sdk';
import { BaseLLM } from './BaseLLM';
import { LLMConfig } from '../types';

export class ClaudeLLM extends BaseLLM {
  private client: Anthropic;

  constructor(config: LLMConfig) {
    super(config);
    this.validateConfig();
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 4000,
        temperature: this.config.temperature || 0.1,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text.trim();
      }

      throw new Error('No text response from Claude');
    } catch (error) {
      throw new Error(`Claude API error: ${error}`);
    }
  }
} 