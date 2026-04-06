#!/usr/bin/env python3
"""
Script to convert Portuguese text to English in code files
"""
import re
import os
from pathlib import Path

# Translation dictionary for common Portuguese phrases
translations = {
    # Common words
    r'\bpara\b': 'for',
    r'\bPara\b': 'For',
    r'\bdo\b': 'of',
    r'\bDo\b': 'Of',
    r'\bda\b': 'of',
    r'\bDa\b': 'Of',
    r'\bcom\b': 'with',
    r'\bCom\b': 'With',
    r'\bnão\b': 'not',
    r'\bNão\b': 'Not',
    r'\bestá\b': 'is',
    r'\bEstá\b': 'Is',
    r'\bser\b': 'be',
    r'\bSer\b': 'Be',
    r'\bpode\b': 'can',
    r'\bPode\b': 'Can',
    r'\bquando\b': 'when',
    r'\bQuando\b': 'When',
    r'\bse\b': 'if',
    r'\bSe\b': 'If',
    r'\bou\b': 'or',
    r'\bOu\b': 'Or',
    r'\bmais\b': 'more',
    r'\bMais\b': 'More',
    r'\btambém\b': 'also',
    r'\bTambém\b': 'Also',
    
    # Common phrases in code
    'Serviço de': 'Service for',
    'serviço de': 'service for',
    'Iniciar serviço': 'Start service',
    'iniciar serviço': 'start service',
    'Parar serviço': 'Stop service',
    'parar serviço': 'stop service',
    'Calcular features': 'Calculate features',
    'calcular features': 'calculate features',
    'Gerar sinais': 'Generate signals',
    'gerar sinais': 'generate signals',
    'Verificar condições': 'Check conditions',
    'verificar condições': 'check conditions',
    'Obter dados': 'Get data',
    'obter dados': 'get data',
    'Inicializar componentes': 'Initialize components',
    'inicializar componentes': 'initialize components',
    'Atualizar monitoramento': 'Update monitoring',
    'atualizar monitoramento': 'update monitoring',
    'Configurar logging': 'Configure logging',
    'configurar logging': 'configure logging',
    'Erro ao': 'Error',
    'erro ao': 'error',
    'Aguardar': 'Wait',
    'aguardar': 'wait',
    'Aguardando': 'Waiting',
    'aguardando': 'waiting',
}

# Specific code translations
code_translations = {
    'Serviço principal de ingestão de dados': 'Main data ingestion service',
    'Pseudocódigo e estrutura para ingestão de múltiplas fontes': 'Pseudocode and structure for multi-source data ingestion',
    'Engine de cálculo de features': 'Feature calculation engine',
    'Pseudocódigo para cálculo de features': 'Pseudocode for feature calculation',
    'Strategy Manager - Gerencia múltiplas estratégias': 'Strategy Manager - Manages multiple strategies',
    'Gerencia múltiplas estratégias': 'Manages multiple strategies',
    'Registrar todas as estratégias disponíveis': 'Register all available strategies',
    'Registradas': 'Registered',
    'estratégias': 'strategies',
    'Calcular features para dados fornecidos': 'Calculate features for provided data',
    'Input: Dados raw': 'Input: Raw data',
    'Output: Features calculadas': 'Output: Calculated features',
    'Features de tape/fluxo': 'Tape/flow features',
    'Features de opções': 'Options features',
    'se aplicável': 'if applicable',
    'Iniciar serviço de ingestão': 'Start ingestion service',
    'Iniciando Data Ingestion Service': 'Starting Data Ingestion Service',
    'Conectar Redis': 'Connect Redis',
    'Conectar banco': 'Connect database',
    'Inicializar providers baseado em configuração': 'Initialize providers based on configuration',
}

def convert_file(file_path):
    """Convert Portuguese text to English in a file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Apply code-specific translations first
        for pt, en in code_translations.items():
            content = content.replace(pt, en)
        
        # Apply regex translations
        for pattern, replacement in translations.items():
            content = re.sub(pattern, replacement, content)
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Converted: {file_path}")
            return True
        return False
    except Exception as e:
        print(f"Error converting {file_path}: {e}")
        return False

def main():
    """Main conversion function"""
    base_dir = Path(__file__).parent / 'src'
    
    if not base_dir.exists():
        print(f"Directory not found: {base_dir}")
        return
    
    # Find all Python files
    py_files = list(base_dir.rglob('*.py'))
    
    print(f"Found {len(py_files)} Python files")
    
    converted = 0
    for py_file in py_files:
        if convert_file(py_file):
            converted += 1
    
    print(f"\nConverted {converted} files")

if __name__ == '__main__':
    main()
