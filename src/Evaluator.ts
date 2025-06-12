import { BaseLLM } from './llm/BaseLLM';
import { LLMFactory } from './llm/LLMFactory';
import { TestCaseLoader } from './TestCaseLoader';
import { createReviewerPrompt, createEvaluatorPrompt } from './prompts';
import { 
  EvaluatorConfig, 
  TestCase, 
  LLMResponse, 
  EvaluationResult,
  GroundTruth,
  EvaluatorResponse 
} from './types';

import * as fs from 'fs';
import * as path from 'path';

export class Evaluator {
  private reviewerLLM: BaseLLM;
  private evaluatorLLM: BaseLLM;
  private testCaseLoader: TestCaseLoader;
  private outputDir: string;

  constructor(config: EvaluatorConfig) {
    this.reviewerLLM = LLMFactory.createLLM(config.reviewerLLM);
    this.evaluatorLLM = LLMFactory.createLLM(config.evaluatorLLM);
    this.testCaseLoader = new TestCaseLoader();

    this.outputDir = config.outputDir || path.join('output', 'latest');

    // Garante que o diretório base exista
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  async evaluateSingleTestCase(testCase: TestCase): Promise<EvaluationResult> {
    try {
      console.log(`\n🔍 Avaliando: ${testCase.name}`);

      // 1. Gera o prompt para review
      const reviewPrompt = createReviewerPrompt(testCase.file, testCase.diff);
      
      // Pasta específica do teste
      const testOutputDir = path.join(this.outputDir, testCase.name);
      fs.mkdirSync(testOutputDir, { recursive: true });

      // Salva o prompt enviado
      fs.writeFileSync(path.join(testOutputDir, 'prompt.md'), reviewPrompt);

      // 2. Chama o LLM reviewer
      console.log('  📝 Chamando LLM reviewer...');
      const llmResponseText = await this.reviewerLLM.generateResponse(reviewPrompt);
      
      // Salva a resposta bruta do LLM
      fs.writeFileSync(path.join(testOutputDir, 'response.md'), llmResponseText);

      // 3. Parse da resposta do LLM
      const llmResponse = this.parseLLMResponse(llmResponseText);
      
      // 4. Compara com ground truth usando evaluator LLM
      console.log('  ⚖️ Comparando com ground truth...');
      const evaluation = await this.compareWithGroundTruth(
        testCase.groundTruth,
        llmResponse,
        testCase.name
      );
      
      console.log(`  ✅ Accuracy: ${evaluation.accuracy.toFixed(1)}%`);
      
      return evaluation;
    } catch (error) {
      console.error(`❌ Erro ao avaliar ${testCase.name}:`, error);
      throw error;
    }
  }

  async evaluateAllTestCases(testCaseNames?: string[]): Promise<EvaluationResult[]> {
    let testCases: TestCase[];
    
    if (testCaseNames && testCaseNames.length > 0) {
      testCases = [];
      for (const name of testCaseNames) {
        try {
          const testCase = await this.testCaseLoader.loadTestCase(name);
          testCases.push(testCase);
        } catch (error) {
          console.warn(`⚠️ Falha ao carregar test case ${name}: ${error}`);
        }
      }
    } else {
      testCases = await this.testCaseLoader.loadAllTestCases();
    }

    console.log(`\n🚀 Iniciando avaliação de ${testCases.length} test cases...`);

    const results: EvaluationResult[] = [];
    
    for (const testCase of testCases) {
      try {
        const result = await this.evaluateSingleTestCase(testCase);
        results.push(result);
      } catch (error) {
        console.error(`❌ Falha em ${testCase.name}:`, error);
      }
    }

    this.printSummary(results);
    return results;
  }

  private async compareWithGroundTruth(
    groundTruth: GroundTruth,
    llmResponse: LLMResponse,
    testCaseName: string
  ): Promise<EvaluationResult> {
    try {
      const evaluatorPrompt = createEvaluatorPrompt(
        JSON.stringify(groundTruth, null, 2),
        JSON.stringify(llmResponse, null, 2)
      );

      const evaluationText = await this.evaluatorLLM.generateResponse(evaluatorPrompt);
      const evaluationData = this.parseEvaluationResponse(evaluationText);

      return {
        testCase: testCaseName,
        overallMatch: evaluationData.overallMatch,
        overallSimilarity: evaluationData.overallSimilarity,
        suggestionMatches: evaluationData.suggestionMatches.map((match: any) => ({
          groundTruth: groundTruth.codeSuggestions[match.groundTruthIndex],
          llmResponse: match.llmResponseIndex !== null 
            ? llmResponse.codeSuggestions[match.llmResponseIndex] 
            : null,
          isMatch: match.isMatch,
          similarity: match.similarity,
          reasoning: match.reasoning
        })),
        totalSuggestions: evaluationData.totalSuggestions,
        matchedSuggestions: evaluationData.matchedSuggestions,
        accuracy: evaluationData.accuracy,
        detailedAnalysis: evaluationData.detailedAnalysis
      };
    } catch (error) {
      throw new Error(`Erro na comparação: ${error}`);
    }
  }

  private parseLLMResponse(responseText: string): LLMResponse {
    try {
      // Extrai JSON do texto da resposta
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Nenhum JSON encontrado na resposta');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Erro ao fazer parse da resposta do LLM: ${error}\nResposta: ${responseText}`);
    }
  }

  private parseEvaluationResponse(responseText: string): EvaluatorResponse {
    try {
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Nenhum JSON encontrado na resposta do evaluator');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Erro ao fazer parse da resposta do evaluator: ${error}\nResposta: ${responseText}`);
    }
  }

  private printSummary(results: EvaluationResult[]): void {
    if (results.length === 0) {
      console.log('\n❌ Nenhum resultado para exibir');
      return;
    }

    const totalAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
    const totalMatched = results.reduce((sum, r) => sum + r.matchedSuggestions, 0);
    const totalSuggestions = results.reduce((sum, r) => sum + r.totalSuggestions, 0);

    console.log('\n📊 RESUMO DA AVALIAÇÃO');
    console.log('=====================================');
    console.log(`📈 Accuracy Média: ${totalAccuracy.toFixed(1)}%`);
    console.log(`🎯 Sugestões Matched: ${totalMatched}/${totalSuggestions} (${((totalMatched/totalSuggestions)*100).toFixed(1)}%)`);
    console.log(`📋 Test Cases: ${results.length}`);
    
    console.log('\n📝 Detalhes por Test Case:');
    results.forEach(result => {
      console.log(`  • ${result.testCase}: ${result.accuracy.toFixed(1)}% (${result.matchedSuggestions}/${result.totalSuggestions})`);
    });
  }

  getAvailableTestCases(): string[] {
    return this.testCaseLoader.getAvailableExamples();
  }
} 