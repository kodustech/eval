declare module '@google/genai' {
  export interface GoogleGenAIOptions {
    apiKey: string;
  }

  // Estrutura simplificada apenas para compilação
  export class GoogleGenAI {
    constructor(options: GoogleGenAIOptions);

    models: {
      generateContentStream(args: any): AsyncIterable<{ text?: string }>;
    };
  }
} 