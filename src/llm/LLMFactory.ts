import { BaseLLM } from './BaseLLM';
import { GeminiLLM } from './GeminiLLM';
import { OpenAILLM } from './OpenAILLM';
import { ClaudeLLM } from './ClaudeLLM';
import { LLMConfig } from '../types';

export class LLMFactory {
  static createLLM(config: LLMConfig): BaseLLM {
    switch (config.provider) {
      case 'gemini':
        return new GeminiLLM(config);
      case 'openai':
        return new OpenAILLM(config);
      case 'claude':
        return new ClaudeLLM(config);
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }
} 