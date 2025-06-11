#!/usr/bin/env python3
"""
BugsJS Evaluator - Universal LLM Support
Funciona com qualquer modelo: OpenAI, Anthropic, Google, Local, etc.
"""
import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional, Protocol
from dataclasses import dataclass
from datetime import datetime
import requests
from abc import ABC, abstractmethod

# Carrega .env se existir
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("💡 Para usar .env, instale: pip install python-dotenv")


@dataclass
class EvaluationResult:
    """Resultado da avaliação de um arquivo"""
    bug_id: str
    file_path: str
    ground_truth_label: str
    predicted_label: Optional[str]
    detected_bug: bool
    correct_label: bool
    has_suggestions: bool
    ground_truth: Dict[str, Any]
    prediction: Dict[str, Any]
    model_name: str
    error: Optional[str] = None


class LLMProvider(ABC):
    """Interface para provedores de LLM"""
    
    @abstractmethod
    def call_api(self, prompt: str, model: str) -> Optional[str]:
        """Chama a API do provedor e retorna resposta em texto"""
        pass
    
    @abstractmethod
    def get_required_env_vars(self) -> List[str]:
        """Retorna lista de variáveis de ambiente necessárias"""
        pass


class OpenAIProvider(LLMProvider):
    """Provedor OpenAI (GPT-4, GPT-3.5, etc.)"""
    
    def get_required_env_vars(self) -> List[str]:
        return ["OPENAI_API_KEY"]
    
    def call_api(self, prompt: str, model: str = "gpt-4") -> Optional[str]:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("❌ OPENAI_API_KEY não configurada!")
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1
        }
        
        try:
            print(f"🔄 Chamando OpenAI {model}...")
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=data,
                timeout=60
            )
            
            if response.status_code != 200:
                print(f"❌ Erro HTTP {response.status_code}: {response.text}")
                return None
                
            result = response.json()
            return result['choices'][0]['message']['content']
            
        except Exception as e:
            print(f"❌ Erro OpenAI: {e}")
            return None


class AnthropicProvider(LLMProvider):
    """Provedor Anthropic (Claude)"""
    
    def get_required_env_vars(self) -> List[str]:
        return ["ANTHROPIC_API_KEY"]
    
    def call_api(self, prompt: str, model: str = "claude-3-sonnet-20240229") -> Optional[str]:
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("❌ ANTHROPIC_API_KEY não configurada!")
        
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }
        
        data = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 200000
        }
        
        try:
            print(f"🔄 Chamando Anthropic {model}...")
            response = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=data,
                timeout=60
            )
            
            if response.status_code != 200:
                print(f"❌ Erro HTTP {response.status_code}: {response.text}")
                return None
                
            result = response.json()
            return result['content'][0]['text']
            
        except Exception as e:
            print(f"❌ Erro Anthropic: {e}")
            return None


class GoogleProvider(LLMProvider):
    """Provedor Google (Gemini) usando google-genai"""
    
    def get_required_env_vars(self) -> List[str]:
        return ["GEMINI_API_KEY"]
    
    def call_api(self, prompt: str, model: str = "gemini-2.0-flash-exp") -> Optional[str]:
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("❌ GEMINI_API_KEY não configurada!")
        
        try:
            # Importa google-genai
            from google import genai
            from google.genai import types
        except ImportError:
            raise ImportError("❌ Instale: pip install google-genai")
        
        try:
            print(f"🔄 Chamando Google {model}...")
            
            client = genai.Client(api_key=api_key)
            
            contents = [
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=prompt)]
                )
            ]
            
            config = types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=200000  # Aumentado de 2000 para 4000
            )
            
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=config
            )
            
            if (response.candidates and 
                response.candidates[0].content and 
                response.candidates[0].content.parts):
                return response.candidates[0].content.parts[0].text
            else:
                # Debug para entender o problema
                finish_reason = getattr(response.candidates[0], 'finish_reason', None) if response.candidates else None
                if finish_reason == 'MAX_TOKENS':
                    print(f"❌ Resposta truncada (MAX_TOKENS). Prompt muito longo!")
                    return None
                else:
                    print(f"❌ Resposta inválida do Google. Finish reason: {finish_reason}")
                    print(f"❌ Response structure: candidates={len(response.candidates) if response.candidates else 0}")
                    return None
                
        except Exception as e:
            print(f"❌ Erro Google: {e}")
            return None


class OllamaProvider(LLMProvider):
    """Provedor Local (Ollama)"""
    
    def get_required_env_vars(self) -> List[str]:
        return []  # Ollama roda local, não precisa de API key
    
    def call_api(self, prompt: str, model: str = "codellama") -> Optional[str]:
        ollama_url = os.getenv('OLLAMA_URL', 'http://localhost:11434')
        
        data = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": 2000
            }
        }
        
        try:
            print(f"🔄 Chamando Ollama {model}...")
            response = requests.post(
                f"{ollama_url}/api/generate",
                json=data,
                timeout=120
            )
            
            if response.status_code != 200:
                print(f"❌ Erro HTTP {response.status_code}: {response.text}")
                return None
                
            result = response.json()
            return result['response']
            
        except Exception as e:
            print(f"❌ Erro Ollama: {e}")
            return None


class CustomProvider(LLMProvider):
    """Provedor customizado - implementar conforme necessário"""
    
    def get_required_env_vars(self) -> List[str]:
        return ["CUSTOM_API_KEY", "CUSTOM_API_URL"]
    
    def call_api(self, prompt: str, model: str = "custom-model") -> Optional[str]:
        # Implementar conforme sua API específica
        api_key = os.getenv('CUSTOM_API_KEY')
        api_url = os.getenv('CUSTOM_API_URL')
        
        if not api_key or not api_url:
            raise ValueError("❌ CUSTOM_API_KEY e CUSTOM_API_URL devem estar configuradas!")
        
        # Exemplo genérico - adaptar conforme necessário
        headers = {"Authorization": f"Bearer {api_key}"}
        data = {"model": model, "prompt": prompt}
        
        try:
            print(f"🔄 Chamando Custom API {model}...")
            response = requests.post(api_url, headers=headers, json=data, timeout=60)
            
            if response.status_code != 200:
                return None
                
            result = response.json()
            # Adaptar conforme formato da resposta da sua API
            return result.get('response', result.get('text', str(result)))
            
        except Exception as e:
            print(f"❌ Erro Custom API: {e}")
            return None


class BugsJSEvaluator:
    """Evaluator universal para qualquer modelo LLM"""
    
    # Registry de provedores disponíveis
    PROVIDERS = {
        'openai': OpenAIProvider(),
        'anthropic': AnthropicProvider(),
        'google': GoogleProvider(),
        'ollama': OllamaProvider(),
        'custom': CustomProvider()
    }
    
    def __init__(self, dataset_path: str, output_dir: str = "evaluation_results"):
        self.dataset_path = Path(dataset_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Carrega dataset
        with open(self.dataset_path, 'r', encoding='utf-8') as f:
            self.dataset = json.load(f)
        
        # Carrega prompt template
        self.prompt_template = self._load_prompt_template()
        
        print(f"✅ Dataset carregado: {len(self.dataset['bugs'])} bugs")
        
        # Estatísticas do dataset
        total_files = sum(len(bug['files']) for bug in self.dataset['bugs'])
        print(f"📁 Total de arquivos para avaliar: {total_files}")
    
    def _load_prompt_template(self) -> str:
        """Carrega o template do prompt Kody"""
        return """# Kody PR-Reviewer: Code Analysis System

## Mission
You are Kody PR-Reviewer, a senior engineer specialized in understanding and reviewing code. Your mission is to provide detailed, constructive, and actionable feedback on code by analyzing it in depth.

## Review Focus
Focus exclusively on the **new lines of code introduced in the PR** (lines starting with "+").
Only propose suggestions that strictly fall under **exactly one** of the following labels.
**These eight strings are the only valid values; never invent new labels.**

- 'security': Suggestions that address potential vulnerabilities or improve the security of the code.
- 'error_handling': Suggestions to improve the way errors and exceptions are handled.
- 'refactoring': Suggestions to restructure the code for better readability, maintainability, or modularity.
- 'performance_and_optimization': Suggestions that directly impact the speed or efficiency of the code.
- 'maintainability': Suggestions that make the code easier to maintain and extend in the future.
- 'potential_issues': Suggestions that identify clear bugs or demonstrable logical errors in the code. Only issues where evidence of the error is directly present and observable in the added lines of code. Do not speculate about hypothetical scenarios or what "might" happen if other parts of the system (not visible in the diff) behave in a certain way.
- 'code_style': Suggestions to improve the consistency and adherence to coding standards.
- 'documentation_and_comments': Suggestions related to improving code documentation.

IMPORTANT: Prioritize quality over quantity. Focus on issues that could meaningfully impact code quality, reliability, or maintainability. Pay special attention to changes that might cause runtime errors or unexpected behavior in production. Avoid trivial formatting issues or suggestions that don't add significant value.

## Analysis Guidelines
- **FOCUS ON EVIDENCE, NOT SPECULATION**: Base all suggestions, especially for 'potential_issues', strictly on the code provided in the diff. Do not raise issues that depend on external behavior not visible, runtime conditions not obvious from the code, or assumptions about the rest of the codebase. If you cannot *confirm* the issue with high certainty from the diff, do not suggest it. Lack of context is not permission to assume a worst-case scenario; it is a constraint to focus only on what is demonstrable.
- Understand the purpose of the PR.
- Focus exclusively on lines marked with '+' for suggestions.
- Only provide suggestions if they fall clearly into the categories mentioned. If none apply, produce no suggestions.
- Before finalizing a suggestion, ensure it is technically correct, logically sound, beneficial, **and based on clear evidence in the provided code diff.**
- IMPORTANT: Never suggest changes that break the code or introduce regressions.
- Keep your suggestions concise and clear:
  - Use simple, direct language.
  - Do not add unnecessary context or unrelated details.
  - If suggesting a refactoring (e.g., extracting common logic), state it briefly and conditionally, acknowledging limited code visibility.
  - Present one main idea per suggestion and avoid redundant or repetitive explanations.

## Analysis Process
Follow this step-by-step thinking:

1. **Identify Potential Issues by Category**:

2. **Validate Suggestions**:
   - If a suggestion does not fit one of these categories or lacks a strong justification, do not propose it.
   - Ensure you're referencing the correct line numbers where the issues actually appear.

3. **Ensure Internal Consistency**:
   - Ensure suggestions do not contradict each other or break the code.
   - If multiple issues are found, include all relevant high-quality suggestions.

4. **Validate Line Numbers**
  - Count only lines that start with "+" inside the relevant __new_block__.
  - Confirm that "relevantLinesStart" ≤ "relevantLinesEnd" and both indices exist.
  - If the count is wrong, fix or remove the suggestion before producing output.

## Code Under Review
Below is the file information to analyze:

Complete File Content:
{file_content}

Code Diff (PR Changes):
{diff_content}

## Understanding the Diff Format
- In this format, each block of code is separated into __new_block__ and __old_block__. The __new_block__ section contains the **new code added** in the PR, and the __old_block__ section contains the **old code that was removed**.
- Lines of code are prefixed with symbols ('+', '-', ' '). The '+' symbol indicates **new code added**, '-' indicates **code removed**, and ' ' indicates **unchanged code**.
- If referencing a specific line for a suggestion, ensure that the line number accurately reflects the line's relative position within the current __new_block__.
- Each line in the diff begins with its absolute file line number (e.g., "796 + ...").
- For relevantLinesStart and relevantLinesEnd you **must use exactly those absolute numbers**.
- If multiple consecutive "+" lines form one issue, use the first and last of those absolute numbers.

- Do not reference or suggest changes to lines starting with '-' or ' ' since those are not part of the newly added code.
- NEVER generate a suggestion for a line that does not appear in the codeDiff. If a line number is not part of the changes shown in the codeDiff with a '+' prefix, do not create any suggestions for it.

## Output Format
Your final output should be **ONLY** a JSON object with the following structure:

```json
{{
    "overallSummary": "Summary of the general changes made in the PR",
    "codeSuggestions": [
        {{
            "relevantFile": "path/to/file",
            "language": "programming_language",
            "suggestionContent": "Detailed and insightful suggestion",
            "existingCode": "Relevant new code from the PR",
            "improvedCode": "Improved proposal",
            "oneSentenceSummary": "Concise summary of the suggestion",
            "relevantLinesStart": "starting_line",
            "relevantLinesEnd": "ending_line",
            "label": "selected_label"
        }}
    ]
}}
```

##  Line-number constraints (MANDATORY)
• Numbering starts at **1** inside the corresponding __new_block__.
• relevantLinesStart = first "+" line that contains the issue.
• relevantLinesEnd   = last  "+" line that belongs to the same issue.
 Never use a number outside the __new_block__ range.
• If you cannot determine the correct numbers, discard the suggestion.

## Final Requirements
1. **Language**
   - Avoid suggesting documentation unless requested
   - Avoid comments in improvedCode unless it is necessary
   - Use pt-BR for all responses
2. **Important**
   - Return only the JSON object
   - Ensure valid JSON format
   - Your codeSuggestions array should include substantive recommendations when present, but can be empty if no meaningful improvements are identified.
   - Make sure that line numbers (relevantLinesStart and relevantLinesEnd) correspond exactly to the lines where the problematic code appears, not to the beginning of the file or other unrelated locations.
   - Note: No limit on number of suggestions."""
    
    def parse_model_string(self, model_string: str) -> tuple[str, str]:
        """
        Parse model string no formato 'provider:model' ou só 'model'
        Retorna (provider, model_name)
        """
        if ':' in model_string:
            provider, model = model_string.split(':', 1)
            return provider.lower(), model
        else:
            # Auto-detecta provider baseado no nome do modelo
            model_lower = model_string.lower()
            if 'gpt' in model_lower or 'openai' in model_lower:
                return 'openai', model_string
            elif 'claude' in model_lower:
                return 'anthropic', model_string
            elif 'gemini' in model_lower:
                return 'google', model_string
            elif 'llama' in model_lower or 'mistral' in model_lower:
                return 'ollama', model_string
            else:
                # Default para OpenAI se não conseguir detectar
                return 'openai', model_string
    
    def create_prompt(self, file_content: str, diff_content: str) -> str:
        """Cria prompt para o LLM"""
        return self.prompt_template.format(
            file_content=file_content,
            diff_content=diff_content
        )
    
    def call_llm(self, prompt: str, model_string: str) -> Optional[str]:
        """Chama LLM usando o provider apropriado"""
        provider_name, model_name = self.parse_model_string(model_string)
        
        if provider_name not in self.PROVIDERS:
            raise ValueError(f"❌ Provider '{provider_name}' não suportado. "
                           f"Disponíveis: {list(self.PROVIDERS.keys())}")
        
        provider = self.PROVIDERS[provider_name]
        
        # Verifica variáveis de ambiente necessárias
        required_vars = provider.get_required_env_vars()
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        
        if missing_vars:
            raise ValueError(f"❌ Variáveis de ambiente faltando para {provider_name}: {missing_vars}")
        
        return provider.call_api(prompt, model_name)
    
    def parse_llm_response(self, response_text: str) -> Optional[Dict[str, Any]]:
        """Parse da resposta do LLM para JSON"""
        try:
            # Remove possível markdown
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.rfind("```")
                response_text = response_text[start:end].strip()
            elif "```" in response_text:
                start = response_text.find("```") + 3
                end = response_text.rfind("```")
                response_text = response_text[start:end].strip()
            
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"❌ Erro ao parsear JSON: {e}")
            print(f"📄 Resposta recebida: {response_text[:500]}...")
            return None
    
    def evaluate_file(self, bug_id: str, file_data: Dict[str, Any], model_string: str) -> EvaluationResult:
        """Avalia um arquivo específico"""
        print(f"📋 Avaliando {bug_id}: {file_data['file_path']}")
        
        # Extrai ground truth
        ground_truth = file_data['ground_truth']
        gt_suggestions = ground_truth.get('codeSuggestions', [])
        
        if not gt_suggestions:
            print(f"  ⚠️  Sem ground truth para {file_data['file_path']}")
            return EvaluationResult(
                bug_id=bug_id,
                file_path=file_data['file_path'],
                ground_truth_label="none",
                predicted_label=None,
                detected_bug=False,
                correct_label=False,
                has_suggestions=False,
                ground_truth=ground_truth,
                prediction={},
                model_name=model_string,
                error="No ground truth available"
            )
        
        gt_label = gt_suggestions[0]['label']
        
        # Cria prompt
        prompt = self.create_prompt(
            file_data['file_content'],
            file_data['diff_content']
        )
        
        # Chama LLM
        llm_response_text = self.call_llm(prompt, model_string)
        
        if not llm_response_text:
            return EvaluationResult(
                bug_id=bug_id,
                file_path=file_data['file_path'],
                ground_truth_label=gt_label,
                predicted_label=None,
                detected_bug=False,
                correct_label=False,
                has_suggestions=False,
                ground_truth=ground_truth,
                prediction={"input_prompt": prompt},  # Salva prompt mesmo se falhou
                model_name=model_string,
                error="LLM API failed"
            )
        
        # Parse da resposta
        llm_response = self.parse_llm_response(llm_response_text)
        
        if not llm_response:
            return EvaluationResult(
                bug_id=bug_id,
                file_path=file_data['file_path'],
                ground_truth_label=gt_label,
                predicted_label=None,
                detected_bug=False,
                correct_label=False,
                has_suggestions=False,
                ground_truth=ground_truth,
                prediction={
                    "raw_response": llm_response_text,
                    "input_prompt": prompt  # Salva prompt mesmo se parsing falhou
                },
                model_name=model_string,
                error="Failed to parse JSON response"
            )
        
        # Analisa resposta
        predicted_suggestions = llm_response.get('codeSuggestions', [])
        has_suggestions = len(predicted_suggestions) > 0
        detected_bug = has_suggestions
        
        predicted_label = None
        correct_label = False
        
        if predicted_suggestions:
            predicted_label = predicted_suggestions[0]['label']
            correct_label = (predicted_label == gt_label)
        
        print(f"  🎯 GT: {gt_label} | Pred: {predicted_label} | Correto: {correct_label}")
        
        # Adiciona prompt ao resultado para análise
        llm_response['input_prompt'] = prompt
        
        return EvaluationResult(
            bug_id=bug_id,
            file_path=file_data['file_path'],
            ground_truth_label=gt_label,
            predicted_label=predicted_label,
            detected_bug=detected_bug,
            correct_label=correct_label,
            has_suggestions=has_suggestions,
            ground_truth=ground_truth,
            prediction=llm_response,
            model_name=model_string
        )
    
    def run_evaluation(self, model_string: str, max_files: int = None) -> List[EvaluationResult]:
        """Executa avaliação completa"""
        print(f"\n🚀 Iniciando avaliação com modelo: {model_string}")
        
        results = []
        file_count = 0
        
        for bug in self.dataset['bugs']:
            bug_id = bug['bug_id']
            
            for file_data in bug['files']:
                if max_files and file_count >= max_files:
                    break
                
                result = self.evaluate_file(bug_id, file_data, model_string)
                results.append(result)
                file_count += 1
            
            if max_files and file_count >= max_files:
                break
        
        print(f"\n📊 Avaliação concluída: {len(results)} arquivos")
        return results
    
    def calculate_metrics(self, results: List[EvaluationResult]) -> Dict[str, Any]:
        """Calcula métricas de avaliação"""
        total = len(results)
        
        # Filtra resultados válidos (sem erro)
        valid_results = [r for r in results if r.error is None]
        valid_count = len(valid_results)
        
        if valid_count == 0:
            return {"error": "No valid results to calculate metrics"}
        
        # Métricas principais
        detected_bugs = sum(1 for r in valid_results if r.detected_bug)
        correct_labels = sum(1 for r in valid_results if r.correct_label)
        
        # Taxa de detecção de bugs
        bug_detection_rate = detected_bugs / valid_count
        
        # Accuracy de labels (só conta quando detectou algo)
        detected_results = [r for r in valid_results if r.detected_bug]
        label_accuracy = (
            sum(1 for r in detected_results if r.correct_label) / len(detected_results)
            if detected_results else 0
        )
        
        # Distribuição de labels
        gt_labels = {}
        pred_labels = {}
        
        for result in valid_results:
            # Ground truth
            gt_label = result.ground_truth_label
            gt_labels[gt_label] = gt_labels.get(gt_label, 0) + 1
            
            # Predicted
            if result.predicted_label:
                pred_label = result.predicted_label
                pred_labels[pred_label] = pred_labels.get(pred_label, 0) + 1
        
        return {
            'model': results[0].model_name if results else "unknown",
            'total_files': total,
            'valid_files': valid_count,
            'bug_detection_rate': round(bug_detection_rate, 3),
            'label_accuracy': round(label_accuracy, 3),
            'bugs_detected': detected_bugs,
            'correct_labels': correct_labels,
            'ground_truth_distribution': gt_labels,
            'predicted_distribution': pred_labels,
            'error_rate': round((total - valid_count) / total, 3) if total > 0 else 0
        }
    
    def analyze_detailed_comparison(self, results: List[EvaluationResult]) -> Dict[str, Any]:
        """Análise detalhada das suggestions geradas vs ground truth"""
        comparisons = []
        
        for result in results:
            if result.error or not result.has_suggestions:
                continue
                
            gt_suggestions = result.ground_truth.get('codeSuggestions', [])
            pred_suggestions = result.prediction.get('codeSuggestions', [])
            
            if not gt_suggestions or not pred_suggestions:
                continue
            
            gt_suggestion = gt_suggestions[0]  # Primeira suggestion
            pred_suggestion = pred_suggestions[0]  # Primeira suggestion
            
            comparison = {
                'bug_id': result.bug_id,
                'file_path': result.file_path,
                'labels_match': gt_suggestion['label'] == pred_suggestion['label'],
                'ground_truth': {
                    'label': gt_suggestion['label'],
                    'summary': gt_suggestion.get('oneSentenceSummary', ''),
                    'content': gt_suggestion.get('suggestionContent', ''),
                    'existing_code': gt_suggestion.get('existingCode', ''),
                    'improved_code': gt_suggestion.get('improvedCode', ''),
                    'lines': f"{gt_suggestion.get('relevantLinesStart', '')}-{gt_suggestion.get('relevantLinesEnd', '')}"
                },
                'predicted': {
                    'label': pred_suggestion['label'],
                    'summary': pred_suggestion.get('oneSentenceSummary', ''),
                    'content': pred_suggestion.get('suggestionContent', ''),
                    'existing_code': pred_suggestion.get('existingCode', ''),
                    'improved_code': pred_suggestion.get('improvedCode', ''),
                    'lines': f"{pred_suggestion.get('relevantLinesStart', '')}-{pred_suggestion.get('relevantLinesEnd', '')}"
                }
            }
            
            comparisons.append(comparison)
        
        return {
            'total_comparisons': len(comparisons),
            'labels_matched': sum(1 for c in comparisons if c['labels_match']),
            'detailed_comparisons': comparisons
        }
    
    def save_detailed_analysis(self, results: List[EvaluationResult], model_name: str) -> str:
        """Salva análise detalhada das suggestions"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_model_name = model_name.replace(':', '_')
        
        analysis = self.analyze_detailed_comparison(results)
        
        # Cria relatório focado na comparação
        comparison_report = {
            'metadata': {
                'model': model_name,
                'analysis_date': timestamp,
                'total_files': len(results)
            },
            'summary': {
                'total_comparisons': analysis['total_comparisons'],
                'labels_matched': analysis['labels_matched'],
                'label_accuracy': round(analysis['labels_matched'] / analysis['total_comparisons'], 3) if analysis['total_comparisons'] > 0 else 0
            },
            'detailed_comparisons': analysis['detailed_comparisons']
        }
        
        # Salva arquivo de comparação detalhada
        comparison_file = self.output_dir / f"detailed_comparison_{safe_model_name}_{timestamp}.json"
        with open(comparison_file, 'w', encoding='utf-8') as f:
            json.dump(comparison_report, f, indent=2, ensure_ascii=False)
        
        return str(comparison_file)
    
    def save_results(self, results: List[EvaluationResult], metrics: Dict[str, Any]) -> str:
        """Salva resultados da avaliação"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_name = results[0].model_name.replace(':', '_') if results else "unknown"
        
        # Converte resultados para dict
        results_dict = []
        for result in results:
            result_dict = {
                'bug_id': result.bug_id,
                'file_path': result.file_path,
                'ground_truth_label': result.ground_truth_label,
                'predicted_label': result.predicted_label,
                'detected_bug': result.detected_bug,
                'correct_label': result.correct_label,
                'has_suggestions': result.has_suggestions,
                'error': result.error,
                # NOVO: Salva suggestions completas para comparação
                'ground_truth_suggestions': result.ground_truth.get('codeSuggestions', []),
                'predicted_suggestions': result.prediction.get('codeSuggestions', []),
                'ground_truth_summary': result.ground_truth.get('overallSummary', ''),
                'predicted_summary': result.prediction.get('overallSummary', ''),
                'input_prompt': result.prediction.get('input_prompt', ''),  # NOVO: Prompt enviado
                'raw_llm_response': result.prediction  # Resposta completa do LLM
            }
            results_dict.append(result_dict)
        
        # Relatório final
        report = {
            'metadata': {
                'model': model_name,
                'dataset': str(self.dataset_path),
                'evaluation_date': timestamp,
                'total_files_evaluated': len(results)
            },
            'metrics': metrics,
            'detailed_results': results_dict
        }
        
        # Salva
        output_file = self.output_dir / f"evaluation_{model_name}_{timestamp}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        return str(output_file)
    
    def save_results(self, results: List[EvaluationResult], metrics: Dict[str, Any]) -> str:
        """Salva resultados da avaliação"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_name = results[0].model_name.replace(':', '_') if results else "unknown"
        
        # Converte resultados para dict
        results_dict = []
        for result in results:
            result_dict = {
                'bug_id': result.bug_id,
                'file_path': result.file_path,
                'ground_truth_label': result.ground_truth_label,
                'predicted_label': result.predicted_label,
                'detected_bug': result.detected_bug,
                'correct_label': result.correct_label,
                'has_suggestions': result.has_suggestions,
                'error': result.error,
                # NOVO: Salva suggestions completas para comparação
                'ground_truth_suggestions': result.ground_truth.get('codeSuggestions', []),
                'predicted_suggestions': result.prediction.get('codeSuggestions', []),
                'ground_truth_summary': result.ground_truth.get('overallSummary', ''),
                'predicted_summary': result.prediction.get('overallSummary', ''),
                'raw_llm_response': result.prediction  # Resposta completa do LLM
            }
            results_dict.append(result_dict)
        
        # Relatório final
        report = {
            'metadata': {
                'model': model_name,
                'dataset': str(self.dataset_path),
                'evaluation_date': timestamp,
                'total_files_evaluated': len(results)
            },
            'metrics': metrics,
            'detailed_results': results_dict
        }
        
        # Salva
        output_file = self.output_dir / f"evaluation_{model_name}_{timestamp}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        return str(output_file)
    
    def print_summary(self, metrics: Dict[str, Any]):
        """Imprime resumo da avaliação"""
        print(f"\n📈 RESUMO DA AVALIAÇÃO - {metrics.get('model', 'Unknown')}")
        print(f"{'='*60}")
        print(f"📁 Arquivos avaliados: {metrics['valid_files']}/{metrics['total_files']}")
        print(f"🎯 Taxa de detecção de bugs: {metrics['bug_detection_rate']:.1%}")
        print(f"✅ Accuracy de labels: {metrics['label_accuracy']:.1%}")
        print(f"🐛 Bugs detectados: {metrics['bugs_detected']}")
        print(f"🎯 Labels corretos: {metrics['correct_labels']}")
        print(f"❌ Taxa de erro: {metrics['error_rate']:.1%}")
        
        print(f"\n📊 Distribuição Ground Truth:")
        for label, count in metrics['ground_truth_distribution'].items():
            print(f"  {label}: {count}")
        
        print(f"\n🔮 Distribuição Predições:")
        for label, count in metrics['predicted_distribution'].items():
            print(f"  {label}: {count}")
    
    @classmethod
    def list_providers(cls):
        """Lista provedores disponíveis"""
        print("🤖 Provedores LLM Disponíveis:")
        for name, provider in cls.PROVIDERS.items():
            env_vars = provider.get_required_env_vars()
            env_status = "✅" if all(os.getenv(var) for var in env_vars) else f"❌ Faltando: {env_vars}"
            print(f"  {name}: {env_status}")


def main():
    """Função principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='BugsJS Evaluator - Universal LLM Support')
    parser.add_argument('--dataset', required=True,
                       help='Caminho para bugsjs_with_groundtruth.json')
    parser.add_argument('--model', required=True,
                       help='Modelo no formato "provider:model" ou "model" (ex: openai:gpt-4, claude-3-sonnet)')
    parser.add_argument('--max-files', type=int,
                       help='Máximo de arquivos para avaliar (para testes)')
    parser.add_argument('--output', default='evaluation_results',
                       help='Diretório de saída')
    parser.add_argument('--list-providers', action='store_true',
                       help='Lista provedores disponíveis e status das API keys')
    
    args = parser.parse_args()
    
    if args.list_providers:
        BugsJSEvaluator.list_providers()
        return
    
    # Executa avaliação
    evaluator = BugsJSEvaluator(args.dataset, args.output)
    results = evaluator.run_evaluation(args.model, max_files=args.max_files)
    metrics = evaluator.calculate_metrics(results)
    
    # Salva relatórios
    summary_file = evaluator.save_results(results, metrics)
    detailed_file = evaluator.save_detailed_analysis(results, args.model)
    
    # Exibe resultados
    evaluator.print_summary(metrics)
    
    print(f"\n✅ Relatórios salvos:")
    print(f"  📊 Resumo: {summary_file}")
    print(f"  🔍 Comparação detalhada: {detailed_file}")


if __name__ == "__main__":
    main()