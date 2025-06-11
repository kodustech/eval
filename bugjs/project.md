# Status do Projeto: BugsJS Dataset Converter

## 🎯 Objetivo do Projeto

Criar um sistema completo para converter o dataset BugsJS para o formato do prompt Kody PR-Reviewer e avaliar as respostas geradas.

### Resultado Desejado

1. **Converter BugsJS** → Formato do prompt Kody PR-Reviewer
2. **Gerar datasets**:
   - Input para o prompt (código + diff)
   - Ground truth para validação (respostas esperadas)
3. **Criar evaluator** para comparar respostas vs ground truth

## 📁 Estrutura do Projeto

```
~/dev/kodus/evaluator/bugjs/
├── converter.py              # Script de conversão (CRIADO)
├── datasets/                 # Outputs (auto-gerado)
├── venv/                     # Ambiente Python
└── requirements.txt          # pandas

~/dev/bug-dataset/            # BugsJS clonado
├── Projects/[project]/       # CSVs com metadados
│   ├── [project]_bugs.csv   # Info dos bugs
│   └── [project]_commands.csv
└── main.py                  # Framework BugsJS
```

## 📊 Estrutura dos Dados

### BugsJS CSV (Descoberta)
```csv
ID;Bug category;Bugfix patterns;Number of tests;...
1;incorrect feature implementation --> incorrect data processing;IF-APCJ,IF-CC,IF-RBR;247;...
```

### Formato do Prompt Kody (Target)
```
Complete File Content:
[código JavaScript completo]

Code Diff (PR Changes):
## file: 'path/file.js'
@@ -46,7 +46,11 @@
__new hunk__
1 +        if (resolver.isNotCacheable()) {
2 +            return that._resolve(resolver, logger);
__old hunk__
-        // If force flag is used, bypass cache
```

### Ground Truth (Target)
```json
{
  "overallSummary": "Bug Bower-1: Correção...",
  "codeSuggestions": [{
    "relevantFile": "bower/lib/core/PackageRepository.js",
    "language": "javascript",
    "suggestionContent": "Correção: incorrect feature implementation",
    "existingCode": "// código removido",
    "improvedCode": "if (resolver.isNotCacheable()) {...}",
    "oneSentenceSummary": "Corrigir potential issues",
    "relevantLinesStart": "4",
    "relevantLinesEnd": "6",
    "label": "potential_issues"
  }]
}
```

## ✅ O Que Funciona

1. **Conversão básica funcionando**:
   - ✅ Lê CSVs do BugsJS corretamente
   - ✅ Faz checkout buggy/fixed via `python3 main.py`
   - ✅ Encontra arquivos .js modificados (exclui testes)
   - ✅ Gera diff no formato correto do prompt
   - ✅ Mapeia categorias BugsJS → labels do prompt
   - ✅ Cria 3 arquivos de saída

2. **Mapeamento de categorias**:
   ```python
   'incorrect feature implementation' → 'potential_issues'
   'error handling' → 'error_handling'
   'security' → 'security'
   'performance' → 'performance_and_optimization'
   ```

3. **Arquivos gerados**:
   - `bugsjs_with_groundtruth.json` - Dataset completo
   - `bugsjs_input_only.json` - Só inputs para prompt
   - `bugsjs_groundtruth_only.json` - Só ground truths

## 🐛 Problema Atual (CRÍTICO)

### Sintoma
```bash
🔍 Ground truth criado: 1 suggestions    # ✅ Criação OK
🎯 Tem ground_truth: False               # ❌ Não salva!
📋 Debug: 0 ground truths encontrados    # ❌ Lista vazia
```

### Diagnóstico
- Ground truth é **criado** na função `create_ground_truth()`
- Ground truth **não é salvo** no objeto `converted_files`
- Resultado: arquivos sem ground truth, evaluator não funciona

### Possível Causa
Suspeita de que o ground truth está sendo perdido entre:
1. `create_ground_truth()` → retorna objeto correto
2. `converted_files.append()` → adiciona ao array
3. Coleta final → `'ground_truth' in file_data` retorna False

### Logs de Debug
```
✓ Bower: 3 bugs
🐛 Bug Bower-1
  📁 60 arquivos .js encontrados (sem testes)
  📝 5 arquivos modificados
  🔍 Ground truth criado: 1 suggestions  ← AQUI CRIA
  🔍 Ground truth criado: 1 suggestions
  (...)
🔍 Bug Bower-1: 5 arquivos
  📁 Arquivo: bower/lib/core/PackageRepository.js
  🎯 Tem ground_truth: False              ← AQUI PERDE
```

## 🔧 Tentativas de Correção

1. **Mudança na condição de filtro**: ❌ Não resolveu
2. **Copy.deepcopy() para evitar referência**: ❌ Não resolveu  
3. **Reorganizar ordem de coleta**: ❌ Não resolveu
4. **Debug detalhado**: ✅ Identificou o ponto de falha

## 📝 Próximos Passos

### Investigação Necessária
1. **Debug na função `process_bug()`**:
   - Verificar se `ground_truth` está no objeto antes do `append()`
   - Adicionar print do objeto completo antes de adicionar ao array

2. **Verificar estrutura de dados**:
   - Confirmar se `converted_files.append()` está preservando o `ground_truth`
   - Verificar se há alguma manipulação posterior que remove o campo

### Correção Provável
```python
# Adicionar debug no process_bug():
converted_files.append({
    'file_path': file_data['path'],
    'file_content': file_data['fixed_content'],
    'diff_content': prompt_diff,
    'ground_truth': ground_truth
})

# Debug imediato
print(f"DEBUG: converted_files[-1] keys: {converted_files[-1].keys()}")
print(f"DEBUG: has ground_truth: {'ground_truth' in converted_files[-1]}")
```

## 🚀 Roadmap Completo

### Fase 1: Corrigir Converter ⚠️ (ATUAL)
- [ ] Resolver bug do ground truth
- [ ] Testar com múltiplos projetos
- [ ] Validar formato de saída

### Fase 2: Criar Evaluator
- [ ] Carregar predictions + ground truth
- [ ] Métricas de avaliação:
  - Accuracy de labels
  - BLEU score para texto
  - Exact match para código
- [ ] Relatório de performance

### Fase 3: Teste End-to-End
- [ ] Dataset BugsJS → Prompt → Evaluator
- [ ] Benchmark de diferentes modelos
- [ ] Análise de resultados

## 🛠️ Comandos de Teste

```bash
# Ambiente
cd ~/dev/kodus/evaluator/bugjs/
source venv/bin/activate

# Teste individual
python converter.py --bugsjs-path ~/dev/bug-dataset --projects Bower --max-bugs 1

# Conversão completa
python converter.py --bugsjs-path ~/dev/bug-dataset --projects Bower Express --max-bugs 5
```

## 📋 Dados de Teste Disponíveis

| Projeto | Bugs Totais | Status |
|---------|-------------|---------|
| Bower | 3 | ✅ Testado |
| Eslint | 333 | ✅ Testado |
| Express | 27 | ✅ Testado |
| Hessian.js | 9 | ✅ Testado |
| Outros | ~80 | ⏳ Pendente |

## 🎯 Critério de Sucesso

**Converter funcionando quando**:
```bash
📋 Debug: 5 ground truths encontrados    # > 0 ✅
```

**Sistema completo quando**:
- Converter gera ground truth correto
- Evaluator compara predictions vs ground truth
- Métricas de avaliação funcionam
- Pipeline completo: BugsJS → Prompt → Evaluator → Relatório