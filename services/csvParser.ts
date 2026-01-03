/**
 * Parser de CSV para dados do Portal da Transparência
 * Processa arquivos de emendas parlamentares baixados em:
 * https://portaldatransparencia.gov.br/download-de-dados/emendas
 */

// Interface para emenda parseada do CSV
export interface EmendaCSV {
  codigoEmenda: string;
  ano: number;
  tipoEmenda: string;
  nomeAutor: string;
  localidadeGasto: string;
  codigoFuncao: string;
  nomeFuncao: string;
  codigoSubfuncao: string;
  nomeSubfuncao: string;
  valorEmpenhado: number;
  valorLiquidado: number;
  valorPago: number;
  valorRestoInscrito: number;
  valorRestoPago: number;
}

// Resultado do processamento
export interface ResultadoProcessamentoCSV {
  totalRegistros: number;
  registrosFiltrados: number;
  emendas: EmendaCSV[];
  resumoPorAutor: Map<string, ResumoAutor>;
  resumoPorFuncao: Map<string, ResumoFuncao>;
  resumoPorLocalidade: Map<string, ResumoLocalidade>;
  erros: string[];
}

export interface ResumoAutor {
  nome: string;
  totalEmendas: number;
  valorEmpenhado: number;
  valorPago: number;
  percentualExecucao: number;
}

export interface ResumoFuncao {
  codigo: string;
  nome: string;
  quantidade: number;
  valorEmpenhado: number;
  valorPago: number;
}

export interface ResumoLocalidade {
  nome: string;
  quantidade: number;
  valorTotal: number;
  isPernambuco: boolean;
}

// Mapeamento de colunas esperadas no CSV do Portal
const COLUNAS_ESPERADAS = {
  codigoEmenda: ['CÓDIGO DA EMENDA', 'CODIGO DA EMENDA', 'CÓDIGO EMENDA', 'CODIGO EMENDA'],
  ano: ['ANO DA EMENDA', 'ANO EMENDA', 'ANO'],
  tipoEmenda: ['TIPO DA EMENDA', 'TIPO EMENDA', 'TIPO DE EMENDA'],
  nomeAutor: ['NOME DO AUTOR DA EMENDA', 'NOME AUTOR', 'AUTOR DA EMENDA', 'AUTOR'],
  localidadeGasto: ['LOCALIDADE DO GASTO', 'LOCALIDADE GASTO', 'LOCALIDADE', 'UF/MUNICÍPIO'],
  codigoFuncao: ['CÓDIGO FUNÇÃO', 'CODIGO FUNCAO', 'COD FUNÇÃO'],
  nomeFuncao: ['NOME FUNÇÃO', 'NOME FUNCAO', 'FUNÇÃO'],
  codigoSubfuncao: ['CÓDIGO SUBFUNÇÃO', 'CODIGO SUBFUNCAO', 'COD SUBFUNÇÃO'],
  nomeSubfuncao: ['NOME SUBFUNÇÃO', 'NOME SUBFUNCAO', 'SUBFUNÇÃO'],
  valorEmpenhado: ['VALOR EMPENHADO', 'VL EMPENHADO', 'EMPENHADO'],
  valorLiquidado: ['VALOR LIQUIDADO', 'VL LIQUIDADO', 'LIQUIDADO'],
  valorPago: ['VALOR PAGO', 'VL PAGO', 'PAGO'],
  valorRestoInscrito: ['VALOR RESTO A PAGAR INSCRITO', 'RESTO INSCRITO', 'RP INSCRITO'],
  valorRestoPago: ['VALOR RESTO A PAGAR PAGO', 'RESTO PAGO', 'RP PAGO'],
};

/**
 * Parseia um valor monetário brasileiro para número
 * Exemplos: "1.234.567,89" -> 1234567.89, "R$ 1.000,00" -> 1000.00
 */
const parseValorBRL = (valor: string): number => {
  if (!valor || valor.trim() === '' || valor === '-') return 0;
  
  // Remove R$, espaços e outros caracteres
  let limpo = valor.replace(/R\$\s*/g, '').trim();
  
  // Se usa formato brasileiro (1.234.567,89)
  if (limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  }
  
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
};

/**
 * Encontra o índice de uma coluna no header
 */
const encontrarColuna = (headers: string[], possiveisNomes: string[]): number => {
  for (const nome of possiveisNomes) {
    const idx = headers.findIndex(h => 
      h.toUpperCase().trim() === nome.toUpperCase() ||
      h.toUpperCase().trim().includes(nome.toUpperCase())
    );
    if (idx !== -1) return idx;
  }
  return -1;
};

/**
 * Parseia uma linha CSV respeitando aspas
 */
const parseLinhaCSV = (linha: string, separador: string = ';'): string[] => {
  const resultado: string[] = [];
  let atual = '';
  let dentroAspas = false;
  
  for (let i = 0; i < linha.length; i++) {
    const char = linha[i];
    
    if (char === '"') {
      dentroAspas = !dentroAspas;
    } else if (char === separador && !dentroAspas) {
      resultado.push(atual.trim());
      atual = '';
    } else {
      atual += char;
    }
  }
  resultado.push(atual.trim());
  
  return resultado;
};

/**
 * Detecta o separador usado no CSV (vírgula ou ponto-e-vírgula)
 */
const detectarSeparador = (primeiraLinha: string): string => {
  const contaPontoVirgula = (primeiraLinha.match(/;/g) || []).length;
  const contaVirgula = (primeiraLinha.match(/,/g) || []).length;
  return contaPontoVirgula > contaVirgula ? ';' : ',';
};

/**
 * Processa o conteúdo de um arquivo CSV de emendas
 */
export const processarCSVEmendas = (
  conteudo: string,
  filtros?: {
    nomeAutor?: string;
    ano?: number;
    uf?: string;
    funcao?: string;
  }
): ResultadoProcessamentoCSV => {
  const erros: string[] = [];
  const emendas: EmendaCSV[] = [];
  
  // Divide em linhas e remove linhas vazias
  const linhas = conteudo.split(/\r?\n/).filter(l => l.trim().length > 0);
  
  if (linhas.length < 2) {
    return {
      totalRegistros: 0,
      registrosFiltrados: 0,
      emendas: [],
      resumoPorAutor: new Map(),
      resumoPorFuncao: new Map(),
      resumoPorLocalidade: new Map(),
      erros: ['Arquivo CSV vazio ou inválido']
    };
  }
  
  // Detecta separador e parseia header
  const separador = detectarSeparador(linhas[0]);
  const headers = parseLinhaCSV(linhas[0], separador);
  
  // Mapeia índices das colunas
  const indices: Record<string, number> = {};
  for (const [campo, possiveisNomes] of Object.entries(COLUNAS_ESPERADAS)) {
    indices[campo] = encontrarColuna(headers, possiveisNomes);
  }
  
  // Verifica colunas essenciais
  if (indices.nomeAutor === -1) {
    erros.push('Coluna de autor não encontrada. Verifique se o arquivo é de emendas parlamentares.');
  }
  if (indices.valorEmpenhado === -1 && indices.valorPago === -1) {
    erros.push('Colunas de valores não encontradas.');
  }
  
  // Preparar filtros para busca case-insensitive
  const filtroAutor = filtros?.nomeAutor?.toUpperCase().trim();
  const filtroUF = filtros?.uf?.toUpperCase().trim();
  const filtroFuncao = filtros?.funcao?.toUpperCase().trim();
  
  // Processa cada linha de dados
  for (let i = 1; i < linhas.length; i++) {
    try {
      const campos = parseLinhaCSV(linhas[i], separador);
      
      if (campos.length < 5) continue; // Linha incompleta
      
      const nomeAutor = indices.nomeAutor !== -1 ? campos[indices.nomeAutor] || '' : '';
      const localidade = indices.localidadeGasto !== -1 ? campos[indices.localidadeGasto] || '' : '';
      const funcao = indices.nomeFuncao !== -1 ? campos[indices.nomeFuncao] || '' : '';
      const anoStr = indices.ano !== -1 ? campos[indices.ano] || '' : '';
      const ano = parseInt(anoStr) || 0;
      
      // Aplica filtros
      if (filtroAutor && !nomeAutor.toUpperCase().includes(filtroAutor)) continue;
      if (filtros?.ano && ano !== filtros.ano) continue;
      if (filtroUF && !localidade.toUpperCase().includes(filtroUF)) continue;
      if (filtroFuncao && !funcao.toUpperCase().includes(filtroFuncao)) continue;
      
      const emenda: EmendaCSV = {
        codigoEmenda: indices.codigoEmenda !== -1 ? campos[indices.codigoEmenda] || '' : '',
        ano,
        tipoEmenda: indices.tipoEmenda !== -1 ? campos[indices.tipoEmenda] || '' : '',
        nomeAutor,
        localidadeGasto: localidade,
        codigoFuncao: indices.codigoFuncao !== -1 ? campos[indices.codigoFuncao] || '' : '',
        nomeFuncao: funcao,
        codigoSubfuncao: indices.codigoSubfuncao !== -1 ? campos[indices.codigoSubfuncao] || '' : '',
        nomeSubfuncao: indices.nomeSubfuncao !== -1 ? campos[indices.nomeSubfuncao] || '' : '',
        valorEmpenhado: indices.valorEmpenhado !== -1 ? parseValorBRL(campos[indices.valorEmpenhado]) : 0,
        valorLiquidado: indices.valorLiquidado !== -1 ? parseValorBRL(campos[indices.valorLiquidado]) : 0,
        valorPago: indices.valorPago !== -1 ? parseValorBRL(campos[indices.valorPago]) : 0,
        valorRestoInscrito: indices.valorRestoInscrito !== -1 ? parseValorBRL(campos[indices.valorRestoInscrito]) : 0,
        valorRestoPago: indices.valorRestoPago !== -1 ? parseValorBRL(campos[indices.valorRestoPago]) : 0,
      };
      
      emendas.push(emenda);
    } catch (e) {
      // Ignora linhas com erro de parsing
    }
  }
  
  // Gera resumos agregados
  const resumoPorAutor = new Map<string, ResumoAutor>();
  const resumoPorFuncao = new Map<string, ResumoFuncao>();
  const resumoPorLocalidade = new Map<string, ResumoLocalidade>();
  
  for (const emenda of emendas) {
    // Por autor
    const autorKey = emenda.nomeAutor.toUpperCase();
    if (autorKey) {
      const atual = resumoPorAutor.get(autorKey) || {
        nome: emenda.nomeAutor,
        totalEmendas: 0,
        valorEmpenhado: 0,
        valorPago: 0,
        percentualExecucao: 0
      };
      atual.totalEmendas++;
      atual.valorEmpenhado += emenda.valorEmpenhado;
      atual.valorPago += emenda.valorPago;
      atual.percentualExecucao = atual.valorEmpenhado > 0 
        ? Math.round((atual.valorPago / atual.valorEmpenhado) * 100) 
        : 0;
      resumoPorAutor.set(autorKey, atual);
    }
    
    // Por função
    const funcaoKey = emenda.nomeFuncao.toUpperCase();
    if (funcaoKey) {
      const atual = resumoPorFuncao.get(funcaoKey) || {
        codigo: emenda.codigoFuncao,
        nome: emenda.nomeFuncao,
        quantidade: 0,
        valorEmpenhado: 0,
        valorPago: 0
      };
      atual.quantidade++;
      atual.valorEmpenhado += emenda.valorEmpenhado;
      atual.valorPago += emenda.valorPago;
      resumoPorFuncao.set(funcaoKey, atual);
    }
    
    // Por localidade
    const localKey = emenda.localidadeGasto.toUpperCase();
    if (localKey) {
      const atual = resumoPorLocalidade.get(localKey) || {
        nome: emenda.localidadeGasto,
        quantidade: 0,
        valorTotal: 0,
        isPernambuco: localKey.includes('PERNAMBUCO') || localKey.includes(' - PE') || localKey.includes('RECIFE')
      };
      atual.quantidade++;
      atual.valorTotal += emenda.valorEmpenhado;
      resumoPorLocalidade.set(localKey, atual);
    }
  }
  
  return {
    totalRegistros: linhas.length - 1,
    registrosFiltrados: emendas.length,
    emendas,
    resumoPorAutor,
    resumoPorFuncao,
    resumoPorLocalidade,
    erros
  };
};

/**
 * Converte Map para array ordenado por valor
 */
export const mapToSortedArray = <T extends { valorEmpenhado?: number; valorTotal?: number }>(
  map: Map<string, T>,
  limite: number = 10
): T[] => {
  return Array.from(map.values())
    .sort((a, b) => (b.valorEmpenhado || b.valorTotal || 0) - (a.valorEmpenhado || a.valorTotal || 0))
    .slice(0, limite);
};

/**
 * Gera dados para gráfico de barras
 */
export const gerarDadosGraficoBarras = (
  resumoPorFuncao: Map<string, ResumoFuncao>,
  limite: number = 8
): { nome: string; empenhado: number; pago: number }[] => {
  return mapToSortedArray(resumoPorFuncao, limite).map(f => ({
    nome: f.nome.length > 20 ? f.nome.substring(0, 20) + '...' : f.nome,
    empenhado: f.valorEmpenhado,
    pago: f.valorPago
  }));
};

/**
 * Gera dados para gráfico de pizza
 */
export const gerarDadosGraficoPizza = (
  resumoPorLocalidade: Map<string, ResumoLocalidade>,
  limite: number = 6
): { nome: string; valor: number; isPE: boolean }[] => {
  const items = mapToSortedArray(resumoPorLocalidade, limite);
  return items.map(l => ({
    nome: l.nome.length > 25 ? l.nome.substring(0, 25) + '...' : l.nome,
    valor: l.valorTotal,
    isPE: l.isPernambuco
  }));
};

/**
 * Formata bytes para tamanho legível
 */
export const formatarTamanhoArquivo = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
