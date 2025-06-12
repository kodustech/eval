import fs from 'fs';
import path from 'path';

// Pasta que contém os exemplos em markdown
const EXAMPLES_DIR = path.resolve(__dirname, '..', 'examples');
// Caminho de saída padrão
const OUTPUT_PATH = path.resolve(__dirname, '..', 'output', 'dataset.jsonl');

interface DatasetLine {
  inputs: {
    code: string;
    diff: string;
  };
  outputs: {
    suggestions: unknown;
  };
}

function* walk(dir: string): Generator<string> {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      yield* walk(filepath);
    } else if (file.endsWith('.md')) {
      yield filepath;
    }
  }
}

function extractBlock(content: string, lang: string): string | null {
  const regex = new RegExp("```" + lang + "\\n([\\s\\S]*?)```", 'm');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function buildDataset() {
  const lines: string[] = [];

  for (const filepath of walk(EXAMPLES_DIR)) {
    const md = fs.readFileSync(filepath, 'utf8');

    const diffBlock = extractBlock(md, 'diff');
    const codeBlock = extractBlock(md, 'javascript');
    const jsonBlock = extractBlock(md, 'json');

    if (!codeBlock || !diffBlock || !jsonBlock) {
      console.warn(`⏩  Pulando '${filepath}' (blocos não encontrados).`);
      continue;
    }

    let suggestions: unknown;
    try {
      suggestions = JSON.parse(jsonBlock);
    } catch (e) {
      console.warn(`⚠️  JSON inválido em '${filepath}': ${(e as Error).message}`);
      continue;
    }

    const entry: DatasetLine = {
      inputs: { code: codeBlock, diff: diffBlock },
      outputs: { suggestions }
    };

    lines.push(JSON.stringify(entry));
  }

  // Garante que a pasta de saída exista
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'));
  console.log(`✅ Dataset gerado com ${lines.length} exemplos em ${OUTPUT_PATH}`);
}

buildDataset(); 