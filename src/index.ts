import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Evaluator } from './Evaluator';
import { EvaluatorConfig } from './types';

// --- parse CLI args simples
const cliArgs = process.argv.slice(2);
let limit: number | undefined;
let repetitions = 1;
let customPromptPath: string | undefined;

const limitFlags = ['--limit', '-l'];
const repFlags = ['--reps', '-r'];
const promptFlags = ['--prompt', '-p'];
for (let i = 0; i < cliArgs.length; i++) {
  if (limitFlags.includes(cliArgs[i]) && cliArgs[i + 1]) {
    limit = parseInt(cliArgs[i + 1], 10);
  }
  if (repFlags.includes(cliArgs[i]) && cliArgs[i + 1]) {
    repetitions = Math.max(1, parseInt(cliArgs[i + 1], 10));
  }
  if (promptFlags.includes(cliArgs[i]) && cliArgs[i + 1]) {
    customPromptPath = cliArgs[i + 1];
  }
}

// Carrega variáveis de ambiente
dotenv.config();

async function main() {
  try {
    // Diretório base de saída
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join('output', timestamp);
    fs.mkdirSync(outputDir, { recursive: true });

    // Configuração do evaluator
    const config: EvaluatorConfig = {
      // LLM que vai fazer a review do código
      reviewerLLM: {
        provider: 'gemini', // ou 'gemini' ou 'claude'
        model: 'gemini-2.5-pro-preview-06-05',
        apiKey: process.env.GOOGLE_AI_API_KEY || '',
        temperature: 0.1,
        maxTokens: 20000,
      },
      // LLM que vai avaliar se a review está correta
      evaluatorLLM: {
        provider: 'openai', // ou 'gemini' ou 'claude'
        model: 'o3-2025-04-16',
        apiKey: process.env.OPEN_AI_APIKEY || '',
        temperature: 0.1,
        maxTokens: 20000,
      },
      testCases: [], // será preenchido dinamicamente
      outputDir,
      reviewerPromptPath: customPromptPath,
    };

    console.log('🚀 Iniciando Code Review Evaluator');
    
    const evaluator = new Evaluator(config);
    
    // Lista test cases disponíveis
    const availableTestCases = evaluator.getAvailableTestCases();
    console.log('\n📁 Test cases disponíveis:', availableTestCases);

    // Define quais test cases serão executados
    let selected: string[] | undefined = undefined;
    if (typeof limit === 'number' && limit > 0) {
      selected = availableTestCases.slice(0, limit);
      console.log(`\n🔢 Limitando execução aos primeiros ${limit} test cases.`);
    }

    // Executa avaliação
    const results = await evaluator.evaluateAllTestCases(selected, repetitions);
    
    // Salva resultados
    console.log('\n💾 Salvando resultados...');
    fs.writeFileSync(
      path.join(outputDir, 'evaluation_results.json'),
      JSON.stringify(results, null, 2)
    );
    
    console.log(`✅ Resultados salvos em evaluation_results.json (repetitions=${repetitions})`);
    console.log(`📑 Execuções por teste: ${repetitions}`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

// Permite execução direta ou importação
if (require.main === module) {
  main();
}

export { Evaluator } from './Evaluator';
export * from './types'; 