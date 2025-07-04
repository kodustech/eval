import fs from 'fs';
import path from 'path';

// Pasta que contém os exemplos em markdown
const EXAMPLES_DIR = path.resolve(__dirname, '..', 'examples');
// Pasta de saída
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

interface DatasetLine {
  inputs: {
    code: string;
    diff: string;
  };
  outputs: {
    suggestions: unknown;
  };
}

function* walkDirectory(dir: string): Generator<string> {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isFile() && file.endsWith('.md')) {
      yield filepath;
    }
  }
}

function extractBlock(content: string, lang: string): string | null {
  // Primeiro tenta com a linguagem específica (ex: ```json)
  const specificRegex = new RegExp("```" + lang + "\\n([\\s\\S]*?)```", 'm');
  const specificMatch = content.match(specificRegex);
  if (specificMatch) {
    return specificMatch[1].trim();
  }
  
  // Para json, tenta procurar seção ### suggestions.json seguida de ``` genérico
  if (lang === 'json') {
    const sectionRegex = /### suggestions\.json[\s\S]*?\n```\n([\s\S]*?)```/m;
    const sectionMatch = content.match(sectionRegex);
    if (sectionMatch) {
      return sectionMatch[1].trim();
    }
  }
  
  return null;
}

function extractFilesSection(content: string): string | null {
  // Procura pela seção ### files seguida por ``` (com espaços opcionais)
  const regex = /### files\s*\n\s*```\n([\s\S]*?)```/m;
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function buildDatasetForFolder(folderPath: string, folderName: string) {
  const lines: string[] = [];

  for (const filepath of walkDirectory(folderPath)) {
    const md = fs.readFileSync(filepath, 'utf8');

    const diffBlock = extractBlock(md, 'diff');
    const filesSection = extractFilesSection(md);
    const jsonBlock = extractBlock(md, 'json');

    if (!filesSection || !diffBlock || !jsonBlock) {
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
      inputs: { code: filesSection, diff: diffBlock },
      outputs: { suggestions }
    };

    lines.push(JSON.stringify(entry));
  }

  // Garante que a pasta de saída exista
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const outputPath = path.join(OUTPUT_DIR, `${folderName}.jsonl`);
  fs.writeFileSync(outputPath, lines.join('\n'));
  console.log(`✅ Dataset '${folderName}' gerado com ${lines.length} exemplos em ${outputPath}`);
}

function buildDatasets() {
  const folders = fs.readdirSync(EXAMPLES_DIR);
  
  for (const folder of folders) {
    const folderPath = path.join(EXAMPLES_DIR, folder);
    const stat = fs.statSync(folderPath);
    
    if (stat.isDirectory()) {
      buildDatasetForFolder(folderPath, folder);
    }
  }
}

buildDatasets(); 