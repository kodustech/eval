import * as dotenv from 'dotenv';
import { Evaluator } from './Evaluator';
import { EvaluatorConfig } from './types';

// Carrega variáveis de ambiente
dotenv.config();

async function testSingleCase() {
  try {
    console.log('🧪 Testando evaluator com um caso simples...\n');

    // Configuração básica
    const config: EvaluatorConfig = {
      reviewerLLM: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: process.env.OPENAI_API_KEY || '',
        temperature: 0.1,
        maxTokens: 2000,
      },
      evaluatorLLM: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: process.env.OPENAI_API_KEY || '',
        temperature: 0.1,
        maxTokens: 2000,
      },
      testCases: []
    };

    const evaluator = new Evaluator(config);
    
    // Lista os test cases disponíveis
    const available = evaluator.getAvailableTestCases();
    console.log('📁 Test cases disponíveis:', available);
    
    if (available.length === 0) {
      console.log('❌ Nenhum test case encontrado na pasta examples/');
      return;
    }

    // Testa o primeiro disponível
    const testCase = available[0];
    console.log(`\n🎯 Testando: ${testCase}`);
    
    const results = await evaluator.evaluateAllTestCases([testCase]);
    
    if (results.length > 0) {
      const result = results[0];
      console.log('\n✅ Teste concluído!');
      console.log(`📊 Accuracy: ${result.accuracy.toFixed(1)}%`);
      console.log(`🎯 Matches: ${result.matchedSuggestions}/${result.totalSuggestions}`);
      console.log(`📝 Análise: ${result.detailedAnalysis.substring(0, 200)}...`);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    
    if (error instanceof Error && error.message.includes('API key')) {
      console.log('\n💡 Dica: Configure sua OPENAI_API_KEY no arquivo .env');
    }
  }
}

testSingleCase(); 