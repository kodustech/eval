export interface CodeSuggestion {
  relevantFile: string;
  language: string;
  suggestionContent: string;
  existingCode: string;
  improvedCode: string;
  oneSentenceSummary: string;
  relevantLinesStart: number;
  relevantLinesEnd: number;
  label: string;
}

export interface GroundTruth {
  overallSummary: string;
  codeSuggestions: CodeSuggestion[];
}

export interface TestCase {
  name: string;
  file: string;
  diff: string;
  groundTruth: GroundTruth;
}

export interface LLMResponse {
  overallSummary: string;
  codeSuggestions: CodeSuggestion[];
}

export interface EvaluationResult {
  testCase: string;
  overallMatch: boolean;
  overallSimilarity: number;
  suggestionMatches: SuggestionMatch[];
  totalSuggestions: number;
  matchedSuggestions: number;
  accuracy: number;
  detailedAnalysis: string;
}

export interface SuggestionMatch {
  groundTruth: CodeSuggestion;
  llmResponse: CodeSuggestion | null;
  isMatch: boolean;
  similarity: number;
  reasoning: string;
}

export type LLMProvider = 'gemini' | 'openai' | 'claude';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export interface EvaluatorConfig {
  reviewerLLM: LLMConfig;
  evaluatorLLM: LLMConfig;
  testCases: string[]; // Array of example names
  outputDir?: string; // Diretório de saída para resultados
}

export interface EvaluatorResponse {
  overallMatch: boolean;
  overallSimilarity: number;
  suggestionMatches: {
    groundTruthIndex: number;
    llmResponseIndex: number | null;
    isMatch: boolean;
    similarity: number;
    reasoning: string;
  }[];
  totalSuggestions: number;
  matchedSuggestions: number;
  accuracy: number;
  detailedAnalysis: string;
} 