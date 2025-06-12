import { GoogleGenAI } from '@google/genai';
import { BaseLLM } from './BaseLLM';
import { LLMConfig } from '../types';

export class GeminiLLM extends BaseLLM {
  private client: GoogleGenAI;

  constructor(config: LLMConfig) {
    super(config);
    this.validateConfig();
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const contents = [
        {
          role: 'user' as const,
          parts: [{ text: prompt }],
        },
      ];

      const stream = await this.client.models.generateContentStream({
        model: this.config.model,
        config: {
          responseMimeType: 'text/plain',
        },
        contents,
      });

      let result = '';
      for await (const chunk of stream) {
        if (chunk.text) {
          result += chunk.text;
        }
      }

      return result.trim();
    } catch (error) {
      throw new Error(`Gemini API error: ${error}`);
    }
  }
} 