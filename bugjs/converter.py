#!/usr/bin/env python3
"""
Conversor BugsJS para formato do prompt Kody PR-Reviewer
Baseado na estrutura real descoberta - VERSÃO CORRIGIDA
"""
import json
import os
import pandas as pd
from pathlib import Path
import subprocess
import re
import tempfile
import difflib
import copy
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime


class BugsJSConverter:
    """Conversor cuidadoso para BugsJS → formato do prompt"""
    
    def __init__(self, bugsjs_path: str, output_dir: str = "datasets"):
        self.bugsjs_path = Path(bugsjs_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Validação rigorosa da estrutura
        self.projects_dir = self.bugsjs_path / "Projects"
        self.main_py = self.bugsjs_path / "main.py"
        
        if not self.projects_dir.exists():
            raise FileNotFoundError(f"❌ Projects/ não encontrado em {self.bugsjs_path}")
        
        if not self.main_py.exists():
            raise FileNotFoundError(f"❌ main.py não encontrado em {self.bugsjs_path}")
        
        # Projetos validados
        self.projects = [
            'Bower', 'Eslint', 'Express', 'Hessian.js', 'Hexo',
            'Karma', 'Mongoose', 'Node-redis', 'Pencilblue', 'Shields'
        ]
        
        # Mapeamento EXATO das categorias BugsJS → labels do prompt
        self.category_mapping = {
            'incorrect feature implementation': 'potential_issues',
            'incomplete feature implementation': 'potential_issues',
            'incorrect data processing': 'potential_issues',
            'configuration processing': 'maintainability',
            'error handling': 'error_handling',
            'security': 'security',
            'performance': 'performance_and_optimization'
        }
        
        print(f"✓ BugsJS inicializado. Projetos: {self.projects}")
    
    def load_project_bugs(self, project: str) -> pd.DataFrame:
        """Carrega CSV com validação rigorosa"""
        project_path = self.projects_dir / project
        bugs_csv = project_path / f"{project}_bugs.csv"
        
        if not bugs_csv.exists():
            print(f"⚠️  {bugs_csv} não encontrado")
            return pd.DataFrame()
        
        try:
            # Usa ; como separador (validado no exemplo)
            df = pd.read_csv(bugs_csv, sep=';')
            
            # Validação das colunas esperadas
            required_cols = ['ID', 'Bug category', 'Bugfix patterns']
            missing_cols = [col for col in required_cols if col not in df.columns]
            
            if missing_cols:
                print(f"❌ Colunas faltando em {project}: {missing_cols}")
                return pd.DataFrame()
            
            print(f"✓ {project}: {len(df)} bugs, colunas: {list(df.columns)}")
            return df
            
        except Exception as e:
            print(f"❌ Erro ao ler {bugs_csv}: {e}")
            return pd.DataFrame()
    
    def checkout_bug_versions(self, project: str, bug_id: int, temp_dir: Path) -> Dict[str, Path]:
        """Faz checkout com validação"""
        versions = {}
        
        for version in ['buggy', 'fixed']:
            version_dir = temp_dir / f"{project}_{bug_id}_{version}"
            version_dir.mkdir(parents=True, exist_ok=True)
            
            print(f"      Checkout {version}...")
            
            try:
                cmd = [
                    'python3', str(self.main_py),
                    '-p', project,
                    '-b', str(bug_id),
                    '-t', 'checkout',
                    '-v', version,
                    '-o', str(version_dir)
                ]
                
                result = subprocess.run(
                    cmd,
                    cwd=self.bugsjs_path,
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minutos max
                )
                
                if result.returncode == 0:
                    # Valida se realmente baixou arquivos
                    js_files = list(version_dir.rglob("*.js"))
                    if js_files:
                        versions[version] = version_dir
                        print(f"        ✓ {len(js_files)} arquivos .js")
                    else:
                        print(f"        ⚠️  Nenhum arquivo .js encontrado")
                else:
                    print(f"        ❌ Erro: {result.stderr.strip()}")
                    
            except subprocess.TimeoutExpired:
                print(f"        ⏱️  Timeout no checkout")
            except Exception as e:
                print(f"        ❌ Exceção: {e}")
        
        return versions
    
    def find_modified_js_files(self, buggy_dir: Path, fixed_dir: Path) -> List[Dict[str, Any]]:
        """Encontra arquivos .js modificados (exclui testes)"""
        modified_files = []
        
        if not buggy_dir.exists() or not fixed_dir.exists():
            return modified_files
        
        # Encontra todos os .js (exceto testes)
        js_files = []
        for js_file in fixed_dir.rglob("*.js"):
            rel_path = js_file.relative_to(fixed_dir)
            
            # SKIP arquivos de teste
            path_str = str(rel_path).lower()
            if any(test_indicator in path_str for test_indicator in ['test', 'spec', '__test__', '.test.', '.spec.']):
                continue
                
            js_files.append(rel_path)
        
        print(f"        📁 {len(js_files)} arquivos .js encontrados (sem testes)")
        
        # Compara cada arquivo
        for rel_path in js_files:
            buggy_file = buggy_dir / rel_path
            fixed_file = fixed_dir / rel_path
            
            if not buggy_file.exists() or not fixed_file.exists():
                continue
            
            try:
                with open(buggy_file, 'r', encoding='utf-8', errors='ignore') as f:
                    buggy_lines = f.readlines()
                
                with open(fixed_file, 'r', encoding='utf-8', errors='ignore') as f:
                    fixed_lines = f.readlines()
                
                # Verifica se há diferenças
                if buggy_lines != fixed_lines:
                    # CORREÇÃO: Inverte o diff para simular "adição de código buggy"
                    # FROM: fixed (como se fosse código original)  
                    # TO: buggy (como se estivesse adicionando o bug)
                    diff = list(difflib.unified_diff(
                        fixed_lines,     # Código "original" (sem bug)
                        buggy_lines,     # Código "novo" (COM bug)
                        fromfile=f"original/{rel_path}",
                        tofile=f"modified/{rel_path}",
                        lineterm=''
                    ))
                    
                    if len(diff) > 2:  # Mais que header
                        modified_files.append({
                            'path': str(rel_path),
                            'buggy_content': ''.join(buggy_lines),
                            'fixed_content': ''.join(fixed_lines),
                            'unified_diff': '\n'.join(diff),
                            'test_type': 'bug_detection'  # Marca que é teste de detecção
                        })
                        
            except Exception as e:
                print(f"        ⚠️  Erro comparando {rel_path}: {e}")
        
        print(f"        📝 {len(modified_files)} arquivos modificados")
        return modified_files
    
    def convert_diff_to_prompt_format(self, unified_diff: str, file_path: str) -> str:
        """Converte unified diff para o formato exato do prompt"""
        lines = unified_diff.split('\n')
        
        # Inicia formatação
        formatted = f"## file: '{file_path}'\n\n"
        
        current_hunk = []
        in_hunk = False
        
        for line in lines:
            if line.startswith('@@'):
                # Finaliza hunk anterior
                if current_hunk:
                    formatted += self._format_hunk(current_hunk)
                    current_hunk = []
                
                # Inicia novo hunk
                formatted += line + '\n'
                in_hunk = True
                
            elif in_hunk and (line.startswith('+') or line.startswith('-') or line.startswith(' ')):
                current_hunk.append(line)
        
        # Finaliza último hunk
        if current_hunk:
            formatted += self._format_hunk(current_hunk)
        
        return formatted
    
    def _format_hunk(self, hunk_lines: List[str]) -> str:
        """Formata um hunk no estilo __new_hunk__ / __old_hunk__"""
        new_lines = []
        old_lines = []
        line_num = 1
        
        for line in hunk_lines:
            if line.startswith('+'):
                new_lines.append(f"{line_num} {line}")
                line_num += 1
            elif line.startswith('-'):
                old_lines.append(line)
            elif line.startswith(' '):
                new_lines.append(f"{line_num} {line}")
                old_lines.append(line)
                line_num += 1
        
        result = "__new hunk__\n"
        if new_lines:
            result += '\n'.join(new_lines) + '\n'
        
        result += "__old hunk__\n"
        if old_lines:
            result += '\n'.join(old_lines) + '\n'
        
        return result + '\n'
    
    def map_bug_category_to_label(self, bug_category: str) -> Tuple[str, str]:
        """Mapeia categoria BugsJS para label do prompt"""
        if not bug_category or pd.isna(bug_category):
            return 'potential_issues', 'Correção de bug geral'
        
        category_lower = bug_category.lower()
        
        # Busca mapeamento direto
        for bugsjs_cat, prompt_label in self.category_mapping.items():
            if bugsjs_cat in category_lower:
                return prompt_label, f"Correção: {bug_category}"
        
        # Fallback baseado em palavras-chave
        if 'error' in category_lower or 'exception' in category_lower:
            return 'error_handling', f"Tratamento de erro: {bug_category}"
        elif 'security' in category_lower or 'vulnerability' in category_lower:
            return 'security', f"Correção de segurança: {bug_category}"
        elif 'performance' in category_lower or 'optimization' in category_lower:
            return 'performance_and_optimization', f"Otimização: {bug_category}"
        else:
            return 'potential_issues', f"Correção: {bug_category}"
    
    def extract_code_from_diff(self, unified_diff: str) -> Tuple[str, str]:
        """Extrai código existente e melhorado do diff"""
        lines = unified_diff.split('\n')
        
        existing_code_lines = []
        improved_code_lines = []
        
        for line in lines:
            if line.startswith('-') and not line.startswith('---'):
                existing_code_lines.append(line[1:])  # Remove '-'
            elif line.startswith('+') and not line.startswith('+++'):
                improved_code_lines.append(line[1:])  # Remove '+'
        
        existing_code = '\n'.join(existing_code_lines).strip()
        improved_code = '\n'.join(improved_code_lines).strip()
        
        return existing_code, improved_code
    
    def find_line_numbers_in_diff(self, unified_diff: str) -> Tuple[str, str]:
        """Encontra números de linha do diff"""
        lines = unified_diff.split('\n')
        
        line_numbers = []
        current_line = 1
        
        for line in lines:
            if line.startswith('@@'):
                # Extrai número da linha inicial do diff
                match = re.search(r'\+(\d+)', line)
                if match:
                    current_line = int(match.group(1))
            elif line.startswith('+') and not line.startswith('+++'):
                line_numbers.append(current_line)
                current_line += 1
            elif line.startswith(' '):
                current_line += 1
        
        if line_numbers:
            return str(line_numbers[0]), str(line_numbers[-1])
        else:
            return "1", "1"
    
    def create_ground_truth(self, bug_data: Dict, file_data: Dict) -> Dict:
        """Cria ground truth no formato JSON do prompt"""
        bug_category = bug_data.get('Bug category', '')
        label, description = self.map_bug_category_to_label(bug_category)
        
        existing_code, improved_code = self.extract_code_from_diff(file_data['unified_diff'])
        line_start, line_end = self.find_line_numbers_in_diff(file_data['unified_diff'])
        
        # Detecta linguagem (assumindo JavaScript para BugsJS)
        language = 'javascript'
        file_ext = Path(file_data['path']).suffix.lower()
        if file_ext in ['.ts', '.tsx']:
            language = 'typescript'
        
        return {
            'overallSummary': f"Bug {bug_data['project']}-{bug_data['ID']}: {description}",
            'codeSuggestions': [{
                'relevantFile': file_data['path'],
                'language': language,
                'suggestionContent': description,
                'existingCode': existing_code,
                'improvedCode': improved_code,
                'oneSentenceSummary': f"Corrigir {label.replace('_', ' ')}",
                'relevantLinesStart': line_start,
                'relevantLinesEnd': line_end,
                'label': label
            }] if existing_code or improved_code else []
        }
    
    def process_bug(self, project: str, bug_row: pd.Series, temp_dir: Path) -> Optional[Dict]:
        """Processa um bug individual"""
        bug_id = int(bug_row['ID'])
        print(f"    🐛 Bug {project}-{bug_id}")
        
        # Checkout das versões
        versions = self.checkout_bug_versions(project, bug_id, temp_dir)
        
        if 'buggy' not in versions or 'fixed' not in versions:
            print(f"      ❌ Checkout falhou")
            return None
        
        # Encontra arquivos modificados
        modified_files = self.find_modified_js_files(
            versions['buggy'], 
            versions['fixed']
        )
        
        if not modified_files:
            print(f"      ⚠️  Nenhum arquivo JS modificado")
            return None
        
        # Processa cada arquivo modificado
        converted_files = []
        for file_data in modified_files:
            # Converte diff para formato do prompt
            prompt_diff = self.convert_diff_to_prompt_format(
                file_data['unified_diff'], 
                file_data['path']
            )
            
            # Cria dados para o bug
            bug_data = {
                'project': project,
                'ID': bug_id,
                'Bug category': bug_row.get('Bug category', ''),
                'Bugfix patterns': bug_row.get('Bugfix patterns', '')
            }
            
            # Cria ground truth
            ground_truth = self.create_ground_truth(bug_data, file_data)
            
            converted_files.append({
                'file_path': file_data['path'],
                'file_content': file_data['fixed_content'],  # Código original (sem bug)
                'diff_content': prompt_diff,
                'ground_truth': ground_truth,
                'test_scenario': 'detect_bug_in_new_code',  # Documenta o cenário de teste
                # DEBUG: Adiciona informações para investigação
                'debug_info': {
                    'buggy_lines_count': len([l for l in file_data['unified_diff'].split('\n') if l.startswith('+') and not l.startswith('+++')]),
                    'fixed_lines_count': len([l for l in file_data['unified_diff'].split('\n') if l.startswith('-') and not l.startswith('---')]),
                    'original_diff_sample': file_data['unified_diff'][:500] + '...' if len(file_data['unified_diff']) > 500 else file_data['unified_diff'],
                    'inverted_diff_sample': prompt_diff[:500] + '...' if len(prompt_diff) > 500 else prompt_diff
                }
            })
        
        if converted_files:
            print(f"      ✅ {len(converted_files)} arquivo(s) convertido(s)")
            return {
                'bug_id': f"{project}-{bug_id}",
                'project': project,
                'bug_category': bug_row.get('Bug category', ''),
                'bugfix_patterns': bug_row.get('Bugfix patterns', ''),
                'files': converted_files
            }
        
        return None
    
    def convert_project(self, project: str, max_bugs: int = None) -> List[Dict]:
        """Converte bugs de um projeto"""
        print(f"\n🔄 Convertendo {project}...")
        
        # Carrega CSV do projeto
        bugs_df = self.load_project_bugs(project)
        if bugs_df.empty:
            print(f"  ❌ Nenhum bug encontrado para {project}")
            return []
        
        # Limita número de bugs se especificado
        if max_bugs:
            bugs_df = bugs_df.head(max_bugs)
            print(f"  📊 Limitando a {max_bugs} bugs")
        
        converted_bugs = []
        
        # Usa diretório temporário para checkout
        with tempfile.TemporaryDirectory(prefix=f"bugsjs_{project}_") as temp_dir:
            temp_path = Path(temp_dir)
            
            for idx, bug_row in bugs_df.iterrows():
                try:
                    bug_data = self.process_bug(project, bug_row, temp_path)
                    if bug_data:
                        converted_bugs.append(bug_data)
                except Exception as e:
                    print(f"      ❌ Erro: {e}")
                    continue
        
        print(f"  ✅ {project}: {len(converted_bugs)}/{len(bugs_df)} bugs convertidos")
        return converted_bugs
    
    def convert_dataset(self, projects: List[str] = None, max_bugs_per_project: int = None) -> str:
        """Converte dataset completo"""
        target_projects = projects if projects else self.projects
        
        print(f"\n📦 Iniciando conversão BugsJS")
        print(f"Projetos: {target_projects}")
        if max_bugs_per_project:
            print(f"Máximo por projeto: {max_bugs_per_project}")
        
        all_converted_bugs = []
        conversion_stats = {}
        
        for project in target_projects:
            try:
                project_bugs = self.convert_project(project, max_bugs_per_project)
                all_converted_bugs.extend(project_bugs)
                conversion_stats[project] = len(project_bugs)
            except Exception as e:
                print(f"❌ Erro fatal no projeto {project}: {e}")
                conversion_stats[project] = 0
                continue

        if not all_converted_bugs:
            print("❌ Nenhum bug foi convertido!")
            return ""

        print(f"🎯 CHECKPOINT 1: Criando dataset com {len(all_converted_bugs)} bugs")

        # Cria dataset final
        dataset = {
            'metadata': {
                'dataset_name': 'bugsjs_converted',
                'source': 'BugsJS - JavaScript Bug Dataset',
                'total_bugs': len(all_converted_bugs),
                'conversion_stats': conversion_stats,
                'projects_converted': list(conversion_stats.keys()),
                'conversion_date': datetime.now().isoformat(),
                'format_version': '1.0'
            },
            'bugs': all_converted_bugs
        }
        
        print(f"🎯 CHECKPOINT 2: Dataset criado, coletando ground truths...")

        # Coleta ground truths ANTES de fazer qualquer cópia
        ground_truths = []
        for bug in dataset['bugs']:
            for file_data in bug['files']:
                if 'ground_truth' in file_data:
                    gt = file_data['ground_truth']
                    suggestions = gt.get('codeSuggestions', []) if isinstance(gt, dict) else []
                    if suggestions:
                        ground_truths.append({
                            'bug_id': bug['bug_id'],
                            'file_path': file_data['file_path'],
                            'ground_truth': file_data['ground_truth']
                        })

        print(f"🎯 CHECKPOINT 3: {len(ground_truths)} ground truths coletados")

        # Salva dataset com ground truth
        output_with_gt = self.output_dir / "bugsjs_with_groundtruth.json"
        with open(output_with_gt, 'w', encoding='utf-8') as f:
            json.dump(dataset, f, indent=2, ensure_ascii=False)

        # Prepara dataset só com inputs (CÓPIA PROFUNDA para não afetar o original)
        input_dataset = copy.deepcopy(dataset)
        input_dataset['metadata']['includes_ground_truth'] = False
        
        for bug in input_dataset['bugs']:
            for file_data in bug['files']:
                file_data.pop('ground_truth', None)

        # Salva dataset só com inputs
        output_input = self.output_dir / "bugsjs_input_only.json"
        with open(output_input, 'w', encoding='utf-8') as f:
            json.dump(input_dataset, f, indent=2, ensure_ascii=False)

        # Salva só ground truths para validação
        gt_dataset = {
            'metadata': dataset['metadata'].copy(),
            'ground_truths': ground_truths
        }
        
        output_gt = self.output_dir / "bugsjs_groundtruth_only.json"
        with open(output_gt, 'w', encoding='utf-8') as f:
            json.dump(gt_dataset, f, indent=2, ensure_ascii=False)
        
        # Relatório final
        print(f"\n🎉 Conversão concluída!")
        print(f"📊 Total de bugs convertidos: {len(all_converted_bugs)}")
        print(f"📁 Arquivos gerados:")
        print(f"  • {output_with_gt} - Dataset completo")
        print(f"  • {output_input} - Só inputs para o prompt")
        print(f"  • {output_gt} - Só ground truths para validação")
        
        for project, count in conversion_stats.items():
            print(f"  • {project}: {count} bugs")
        
        return str(output_with_gt)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Conversor BugsJS para formato Kody PR-Reviewer')
    parser.add_argument('--bugsjs-path', required=True,
                       help='Caminho para o diretório raiz do BugsJS')
    parser.add_argument('--projects', nargs='+',
                       choices=['Bower', 'Eslint', 'Express', 'Hessian.js', 'Hexo',
                               'Karma', 'Mongoose', 'Node-redis', 'Pencilblue', 'Shields'],
                       help='Projetos específicos para converter')
    parser.add_argument('--max-bugs', type=int,
                       help='Máximo de bugs por projeto (para testes)')
    parser.add_argument('--output', default='datasets',
                       help='Diretório de saída')
    
    args = parser.parse_args()
    
    try:
        converter = BugsJSConverter(
            bugsjs_path=args.bugsjs_path,
            output_dir=args.output
        )
        
        result = converter.convert_dataset(
            projects=args.projects,
            max_bugs_per_project=args.max_bugs
        )
        
        if result:
            print(f"\n✅ Conversão salva em: {result}")
        else:
            print(f"\n❌ Conversão falhou")
            
    except Exception as e:
        print(f"\n💥 Erro fatal: {e}")
        raise