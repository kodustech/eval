import * as fs from 'fs';
import * as path from 'path';
import { TestCase, GroundTruth } from './types';

export class TestCaseLoader {
  private examplesDir: string;

  constructor(examplesDir: string = './examples') {
    this.examplesDir = examplesDir;
  }

  async loadTestCase(exampleName: string): Promise<TestCase> {
    const examplePath = path.join(this.examplesDir, exampleName);
    
    if (!fs.existsSync(examplePath)) {
      throw new Error(`Example not found: ${exampleName}`);
    }

    // Carrega o arquivo de código
    const filePath = this.findCodeFile(examplePath);
    const file = fs.readFileSync(filePath, 'utf-8');

    // Carrega o diff
    const diffPath = path.join(examplePath, 'diff.txt');
    if (!fs.existsSync(diffPath)) {
      throw new Error(`Diff file not found for example: ${exampleName}`);
    }
    const diff = fs.readFileSync(diffPath, 'utf-8');

    // Carrega as suggestions (ground truth)
    const suggestionsPath = path.join(examplePath, 'suggestions.json');
    if (!fs.existsSync(suggestionsPath)) {
      throw new Error(`Suggestions file not found for example: ${exampleName}`);
    }
    const suggestionsContent = fs.readFileSync(suggestionsPath, 'utf-8');
    const groundTruth: GroundTruth = JSON.parse(suggestionsContent);

    return {
      name: exampleName,
      file,
      diff,
      groundTruth,
    };
  }

  async loadAllTestCases(): Promise<TestCase[]> {
    const examples = this.getAvailableExamples();
    const testCases: TestCase[] = [];

    for (const example of examples) {
      try {
        const testCase = await this.loadTestCase(example);
        testCases.push(testCase);
      } catch (error) {
        console.warn(`Failed to load test case ${example}: ${error}`);
      }
    }

    return testCases;
  }

  getAvailableExamples(): string[] {
    if (!fs.existsSync(this.examplesDir)) {
      throw new Error(`Examples directory not found: ${this.examplesDir}`);
    }

    return fs.readdirSync(this.examplesDir)
      .filter(item => {
        const itemPath = path.join(this.examplesDir, item);
        return fs.statSync(itemPath).isDirectory();
      });
  }

  private findCodeFile(examplePath: string): string {
    const possibleFiles = ['file.js', 'file.jsx', 'file.ts', 'file.tsx'];
    
    for (const fileName of possibleFiles) {
      const filePath = path.join(examplePath, fileName);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }

    throw new Error(`No code file found in ${examplePath}`);
  }
} 