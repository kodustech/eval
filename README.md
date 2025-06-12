# Code Review Evaluator

A lightweight TypeScript framework that checks whether your **prompt-engineered code review** is actually detecting the same issues you defined as ground-truth.

The project loads sample code, asks an LLM to review it, compares the answer with an expected JSON, and returns an accuracy score – all with one command.

> **Note** All example folders ship with **synthetic snippets** purposely crafted to mimic real-world bugs. They are **not** excerpts from client projects. Their only goal is to stress-test the review workflow and make it easy to iterate on prompts/metrics.

---

### Test-case folder structure

Each **example** is a sub-directory inside `examples/` and **must** contain exactly three files:

| file                | purpose                                                         |
|---------------------|-----------------------------------------------------------------|
| `file.(js|ts|jsx)`  | Original source code                                            |
| `diff.txt`          | Unified diff with your proposed changes                         |
| `suggestions.json`  | Ground-truth analysis in the expected JSON schema               |

> **Why both `file` and `diff`?**  The reviewer LLM receives *both* artefacts so it can see the current state **and** the intended patch, mimicking a typical pull-request review.

---

## 🚀 Quick Start

```bash
# 1 – install dependencies
npm install

# 2 – Provide API keys (.env in project root)
OPENAI_API_KEY=sk-…
GEMINI_API_KEY=…
ANTHROPIC_API_KEY=…

# 3 – Run full evaluation (build + exec)
npm start

# dev mode with flags
npm run dev -- --reps 3 --prompt ./prompts/my_reviewer.md
```

### CLI flags

| flag | shortcut | default | description |
|------|----------|---------|-------------|
| `--limit` | `-l` | all | Run only the first *N* examples |
| `--reps`  | `-r` | 1 | How many times to run each example (results averaged) |
| `--prompt`| `-p` | internal template | Path to a **custom reviewer prompt**. Must contain the placeholders `{file}` and `{diff}` |

Running will:
1. Detect every folder in `examples/`
2. Call the **reviewer** LLM for each sample
3. Feed both ground-truth & LLM answer to the **evaluator** LLM
4. Print per-case accuracy and a global summary
5. Write `evaluation_results.json` with the raw data

### 📦 Generate LangSmith Dataset

To create a JSONL dataset compatible with [LangSmith](https://smith.langchain.com/):

```bash
# build examples ➜ output/dataset.jsonl
npm run build:dataset
```

The script scans every folder inside `examples/`, grabs the code, diff, and ground-truth suggestions, then writes one JSON-encoded line per example to `output/dataset.jsonl`.

Each line follows this schema:

```jsonc
{
  "inputs": {
    "code": "<original source file>",
    "diff": "<unified diff patch>"
  },
  "outputs": {
    "suggestions": [{ /* reviewer issues as JSON */ }]
  }
}
```

You can now upload the resulting `dataset.jsonl` to LangSmith for prompt-quality tracking or further experimentation.

---

## ⚙️ Configuration

Everything is code-first – open (or copy) `src/index.ts` and edit the `EvaluatorConfig`:

```ts
const config: EvaluatorConfig = {
  // Which LLM reviews the code
  reviewerLLM: {
    provider: 'gemini',                // 'gemini' | 'openai' | 'claude'
    model: 'gemini-2.5-pro-preview-06-05',
    apiKey: process.env.GEMINI_API_KEY!,
    temperature: 0,
  },
  // Which LLM judges the review
  evaluatorLLM: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY!,
    temperature: 0,
  },
  // Optional: run only a subset of folders (default = all)
  testCases: ['api_request_manager', 'task_queue'],
};
```

Changing `provider` automatically switches to the right SDK thanks to `LLMFactory.ts`.

---

## 🧠 How It Works


1. **TestCaseLoader** reads each example and returns a typed object.
2. **Reviewer Prompt** (see `prompts.ts`) asks the first LLM to produce a JSON array of issues.
3. **Evaluator Prompt** compares that answer with ground-truth using a second LLM.
4. Accuracy is computed from the evaluator JSON and printed.

---

## 📤 Result Schema (`evaluation_results.json`)

```jsonc
[
  {
    "testCase": "api_request_manager",
    "overallMatch": true,
    "overallSimilarity": 93,
    "totalSuggestions": 5,
    "matchedSuggestions": 4,
    "accuracy": 80.0,
    "suggestionMatches": [
      {
        "groundTruth": {/* one suggestion */},
        "llmResponse": {/* matched suggestion or null */},
        "isMatch": true,
        "similarity": 95,
        "reasoning": "Both flagged missing retry on 500 errors…"
      }
    ],
    "detailedAnalysis": "…long string from evaluator LLM…"
  },
  "…more cases…"
]
```

---

## ➕ Adding New Examples

The dataset is intentionally minimal. Feel free to add more synthetic scenarios to cover edge cases we miss today:

1. Create `examples/<your_case>/`.
2. Drop `file.js`, `diff.txt`, `suggestions.json`.
3. Run `npm start` or `npm run dev` to see the impact.

---

## 🏷️ Project Scope

This repo **validates the review pipeline itself** – it is **not** a linting tool nor aims for full code-quality coverage. The objective is to make sure a prompt-engineered reviewer catches the *same* issues we have in our ground truth so we can:

1. Experiment with different prompt styles quickly (pass a new file with `--prompt`).
2. Benchmark LLM versions/providers side-by-side.
3. Gradually expand the dataset with tougher cases and measure progress.

---

## 🔍 Internals / Source Guide

| file                               | role |
|------------------------------------|------|
| `src/llm/BaseLLM.ts`               | common abstract class (validates config) |
| `src/llm/GeminiLLM.ts`             | Wrapper around **@google/genai** (`GoogleGenAI`) |
| `src/llm/OpenAILLM.ts`             | Wrapper around **openai** SDK (Chat Completions) |
| `src/llm/ClaudeLLM.ts`             | Wrapper around **@anthropic-ai/sdk** |
| `src/llm/LLMFactory.ts`            | `switch` that instantiates the correct wrapper |
| `src/prompts.ts`                   | Markdown prompt templates with JSON specs |
| `src/TestCaseLoader.ts`            | Filesystem helper to read examples |
| `src/Evaluator.ts`                 | The orchestrator (loads ➜ prompts ➜ calls LLMs ➜ aggregates) |

---

## 🛠️ NPM Scripts

| script         | what it does                                           |
|----------------|--------------------------------------------------------|
| `npm run dev`  | Run `src/index.ts` directly with ts-node               |
| `npm start`    | Compile TypeScript ➜ run compiled `dist/index.js`      |
| `npm run test:dev` | Quick sanity test on the first available example |
| `npm run build`| Compile TypeScript to `dist/`                          |

---

## License

MIT 