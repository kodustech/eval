import OpenAI from 'openai';
import { BaseLLM } from './BaseLLM';
import { LLMConfig } from '../types';

export class OpenAILLM extends BaseLLM {
  private client: OpenAI;

  constructor(config: LLMConfig) {
    super(config);
    this.validateConfig();
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      // Modelos mais novos da série "o3" da OpenAI mudaram a nomenclatura de
      // `max_tokens` para `max_completion_tokens`. Ajustamos dinamicamente
      // para manter compatibilidade com modelos anteriores.

      const isO3Family = /^o3[-_]/i.test(this.config.model);

      const completionParams: any = {
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      if (!isO3Family) {
        completionParams.temperature = this.config.temperature || 0.1;
      }

      if (isO3Family) {
        completionParams.max_completion_tokens = this.config.maxTokens || 4000;
      } else {
        completionParams.max_tokens = this.config.maxTokens || 4000;
      }

      const completion = await this.client.chat.completions.create(
        completionParams
      );

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      return response.trim();
    } catch (error) {
      throw new Error(`OpenAI API error: ${error}`);
    }
  }
} 