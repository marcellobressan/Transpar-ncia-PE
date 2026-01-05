/**
 * Serviço para processar Emendas Parlamentares do Portal da Transparência
 * 
 * Fonte de dados: https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO
 * 
 * O arquivo ZIP contém 3 planilhas CSV:
 * 1. Emendas - Dados gerais das emendas (código, autor, tipo, valores, etc.)
 * 2. Beneficiários - Quem recebeu os recursos das emendas
 * 3. Pagamentos - Detalhes dos pagamentos realizados
 */

import JSZip from 'jszip';
import { processarCSVEmendas, ResultadoProcessamentoCSV } from './csvParser';

// URL principal para download de emendas parlamentares (arquivo único)
export const EMENDAS_DOWNLOAD_URL = 'https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO';

// Interface para dados de beneficiários de emendas
export interface BeneficiarioEmenda {
  codigoEmenda: string;
  tipoBeneficiario: string;
  codigoBeneficiario: string;
  nomeBeneficiario: string;
  cnpjCpf: string;
  municipio: string;
  uf: string;
  valorRecebido: number;
}

// Interface para dados de pagamentos de emendas
export interface PagamentoEmenda {
  codigoEmenda: string;
  anoOrcamento: number;
  dataEmissao: string;
  dataPagamento: string;
  siglaUG: string;
  nomeUG: string;
  documento: string;
  observacao: string;
  valorPago: number;
}

// Interface para resultado completo do processamento ZIP
export interface ResultadoProcessamentoEmendasZIP {
  emendas: ResultadoProcessamentoCSV | null;
  beneficiarios: BeneficiarioEmenda[];
  pagamentos: PagamentoEmenda[];
  arquivosProcessados: string[];
  erros: string[];
  dataDownload: Date;
}

// Mapeamento de colunas para beneficiários
const COLUNAS_BENEFICIARIOS = {
  codigoEmenda: ['CÓDIGO DA EMENDA', 'CODIGO DA EMENDA', 'CÓDIGO EMENDA'],
  tipoBeneficiario: ['TIPO DO BENEFICIÁRIO', 'TIPO BENEFICIARIO', 'TIPO DO BENEFICIÁRIO DA EMENDA'],
  codigoBeneficiario: ['CÓDIGO DO BENEFICIÁRIO', 'CODIGO BENEFICIARIO'],
  nomeBeneficiario: ['NOME DO BENEFICIÁRIO', 'NOME BENEFICIARIO', 'BENEFICIÁRIO'],
  cnpjCpf: ['CNPJ/CPF', 'CNPJ', 'CPF', 'DOCUMENTO'],
  municipio: ['MUNICÍPIO', 'MUNICIPIO', 'CIDADE'],
  uf: ['UF', 'ESTADO', 'SIGLA UF'],
  valorRecebido: ['VALOR RECEBIDO', 'VALOR', 'VALOR DO BENEFÍCIO'],
};

// Mapeamento de colunas para pagamentos
const COLUNAS_PAGAMENTOS = {
  codigoEmenda: ['CÓDIGO DA EMENDA', 'CODIGO DA EMENDA', 'CÓDIGO EMENDA'],
  anoOrcamento: ['ANO DO ORÇAMENTO', 'ANO ORCAMENTO', 'ANO'],
  dataEmissao: ['DATA DE EMISSÃO', 'DATA EMISSAO', 'DT EMISSÃO'],
  dataPagamento: ['DATA DO PAGAMENTO', 'DATA PAGAMENTO', 'DT PAGAMENTO'],
  siglaUG: ['SIGLA UG', 'UG SIGLA', 'SIGLA UNIDADE GESTORA'],
  nomeUG: ['NOME UG', 'UG NOME', 'NOME UNIDADE GESTORA', 'UNIDADE GESTORA'],
  documento: ['DOCUMENTO', 'NR DOCUMENTO', 'NÚMERO DOCUMENTO'],
  observacao: ['OBSERVAÇÃO', 'OBSERVACAO', 'OBS'],
  valorPago: ['VALOR PAGO', 'VL PAGO', 'VALOR DO PAGAMENTO'],
};

/**
 * Parseia um valor monetário brasileiro para número
 */
const parseValorBRL = (valor: string): number => {
  if (!valor || valor.trim() === '' || valor === '-') return 0;
  let limpo = valor.replace(/R\$\s*/g, '').trim();
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
 * Detecta o separador usado no CSV
 */
const detectarSeparador = (primeiraLinha: string): string => {
  const contaPontoVirgula = (primeiraLinha.match(/;/g) || []).length;
  const contaVirgula = (primeiraLinha.match(/,/g) || []).length;
  return contaPontoVirgula > contaVirgula ? ';' : ',';
};

/**
 * Identifica o tipo de arquivo CSV pelo conteúdo do header
 */
const identificarTipoArquivo = (header: string): 'emendas' | 'beneficiarios' | 'pagamentos' | 'desconhecido' => {
  const headerUpper = header.toUpperCase();
  
  // Verifica palavras-chave específicas para cada tipo
  if (headerUpper.includes('TIPO DO BENEFICIÁRIO') || headerUpper.includes('NOME DO BENEFICIÁRIO') || 
      headerUpper.includes('TIPO BENEFICIARIO') || headerUpper.includes('CNPJ/CPF')) {
    return 'beneficiarios';
  }
  
  if (headerUpper.includes('DATA DO PAGAMENTO') || headerUpper.includes('DATA PAGAMENTO') ||
      headerUpper.includes('SIGLA UG') || headerUpper.includes('NR DOCUMENTO')) {
    return 'pagamentos';
  }
  
  if (headerUpper.includes('TIPO DA EMENDA') || headerUpper.includes('NOME DO AUTOR') ||
      headerUpper.includes('VALOR EMPENHADO') || headerUpper.includes('VALOR LIQUIDADO')) {
    return 'emendas';
  }
  
  return 'desconhecido';
};

/**
 * Processa CSV de beneficiários
 */
const processarCSVBeneficiarios = (
  conteudo: string,
  filtros?: { uf?: string; nomeAutor?: string }
): BeneficiarioEmenda[] => {
  const beneficiarios: BeneficiarioEmenda[] = [];
  const linhas = conteudo.split(/\r?\n/).filter(l => l.trim().length > 0);
  
  if (linhas.length < 2) return beneficiarios;
  
  const separador = detectarSeparador(linhas[0]);
  const headers = parseLinhaCSV(linhas[0], separador);
  
  // Mapeia índices
  const indices: Record<string, number> = {};
  for (const [campo, possiveisNomes] of Object.entries(COLUNAS_BENEFICIARIOS)) {
    indices[campo] = encontrarColuna(headers, possiveisNomes);
  }
  
  const filtroUF = filtros?.uf?.toUpperCase().trim();
  
  for (let i = 1; i < linhas.length; i++) {
    try {
      const campos = parseLinhaCSV(linhas[i], separador);
      if (campos.length < 5) continue;
      
      const uf = indices.uf !== -1 ? campos[indices.uf]?.toUpperCase() || '' : '';
      
      // Aplica filtro de UF se especificado
      if (filtroUF && uf && !uf.includes(filtroUF)) continue;
      
      beneficiarios.push({
        codigoEmenda: indices.codigoEmenda !== -1 ? campos[indices.codigoEmenda] || '' : '',
        tipoBeneficiario: indices.tipoBeneficiario !== -1 ? campos[indices.tipoBeneficiario] || '' : '',
        codigoBeneficiario: indices.codigoBeneficiario !== -1 ? campos[indices.codigoBeneficiario] || '' : '',
        nomeBeneficiario: indices.nomeBeneficiario !== -1 ? campos[indices.nomeBeneficiario] || '' : '',
        cnpjCpf: indices.cnpjCpf !== -1 ? campos[indices.cnpjCpf] || '' : '',
        municipio: indices.municipio !== -1 ? campos[indices.municipio] || '' : '',
        uf,
        valorRecebido: indices.valorRecebido !== -1 ? parseValorBRL(campos[indices.valorRecebido]) : 0,
      });
    } catch (e) {
      // Ignora linhas com erro
    }
  }
  
  return beneficiarios;
};

/**
 * Processa CSV de pagamentos
 */
const processarCSVPagamentos = (
  conteudo: string,
  filtros?: { ano?: number }
): PagamentoEmenda[] => {
  const pagamentos: PagamentoEmenda[] = [];
  const linhas = conteudo.split(/\r?\n/).filter(l => l.trim().length > 0);
  
  if (linhas.length < 2) return pagamentos;
  
  const separador = detectarSeparador(linhas[0]);
  const headers = parseLinhaCSV(linhas[0], separador);
  
  // Mapeia índices
  const indices: Record<string, number> = {};
  for (const [campo, possiveisNomes] of Object.entries(COLUNAS_PAGAMENTOS)) {
    indices[campo] = encontrarColuna(headers, possiveisNomes);
  }
  
  for (let i = 1; i < linhas.length; i++) {
    try {
      const campos = parseLinhaCSV(linhas[i], separador);
      if (campos.length < 5) continue;
      
      const anoStr = indices.anoOrcamento !== -1 ? campos[indices.anoOrcamento] || '' : '';
      const ano = parseInt(anoStr) || 0;
      
      // Aplica filtro de ano se especificado
      if (filtros?.ano && ano !== filtros.ano) continue;
      
      pagamentos.push({
        codigoEmenda: indices.codigoEmenda !== -1 ? campos[indices.codigoEmenda] || '' : '',
        anoOrcamento: ano,
        dataEmissao: indices.dataEmissao !== -1 ? campos[indices.dataEmissao] || '' : '',
        dataPagamento: indices.dataPagamento !== -1 ? campos[indices.dataPagamento] || '' : '',
        siglaUG: indices.siglaUG !== -1 ? campos[indices.siglaUG] || '' : '',
        nomeUG: indices.nomeUG !== -1 ? campos[indices.nomeUG] || '' : '',
        documento: indices.documento !== -1 ? campos[indices.documento] || '' : '',
        observacao: indices.observacao !== -1 ? campos[indices.observacao] || '' : '',
        valorPago: indices.valorPago !== -1 ? parseValorBRL(campos[indices.valorPago]) : 0,
      });
    } catch (e) {
      // Ignora linhas com erro
    }
  }
  
  return pagamentos;
};

/**
 * Baixa e processa o arquivo ZIP de emendas parlamentares
 * 
 * @param filtros - Filtros opcionais para aplicar aos dados
 * @returns Resultado do processamento com emendas, beneficiários e pagamentos
 */
export const baixarEProcessarEmendasZIP = async (
  filtros?: {
    nomeAutor?: string;
    ano?: number;
    uf?: string;
  }
): Promise<ResultadoProcessamentoEmendasZIP> => {
  const resultado: ResultadoProcessamentoEmendasZIP = {
    emendas: null,
    beneficiarios: [],
    pagamentos: [],
    arquivosProcessados: [],
    erros: [],
    dataDownload: new Date(),
  };
  
  try {
    console.log('Baixando arquivo ZIP de emendas parlamentares...');
    
    // Tenta baixar o arquivo ZIP
    const response = await fetch(EMENDAS_DOWNLOAD_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/zip, application/octet-stream',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao baixar arquivo: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    console.log('Arquivo ZIP carregado. Processando arquivos...');
    
    // Processa cada arquivo CSV do ZIP
    for (const [nomeArquivo, arquivo] of Object.entries(zip.files)) {
      if (arquivo.dir || !nomeArquivo.toLowerCase().endsWith('.csv')) continue;
      
      try {
        const conteudo = await arquivo.async('string');
        const linhas = conteudo.split(/\r?\n/);
        
        if (linhas.length < 2) continue;
        
        const tipoArquivo = identificarTipoArquivo(linhas[0]);
        
        switch (tipoArquivo) {
          case 'emendas':
            resultado.emendas = processarCSVEmendas(conteudo, filtros);
            resultado.arquivosProcessados.push(`${nomeArquivo} (Emendas)`);
            break;
            
          case 'beneficiarios':
            resultado.beneficiarios = processarCSVBeneficiarios(conteudo, {
              uf: filtros?.uf,
              nomeAutor: filtros?.nomeAutor,
            });
            resultado.arquivosProcessados.push(`${nomeArquivo} (Beneficiários)`);
            break;
            
          case 'pagamentos':
            resultado.pagamentos = processarCSVPagamentos(conteudo, {
              ano: filtros?.ano,
            });
            resultado.arquivosProcessados.push(`${nomeArquivo} (Pagamentos)`);
            break;
            
          default:
            resultado.arquivosProcessados.push(`${nomeArquivo} (Não identificado)`);
        }
      } catch (e) {
        resultado.erros.push(`Erro ao processar ${nomeArquivo}: ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
      }
    }
    
    console.log(`Processamento concluído. Arquivos processados: ${resultado.arquivosProcessados.length}`);
    
  } catch (error) {
    resultado.erros.push(
      `Erro ao baixar/processar ZIP: ${error instanceof Error ? error.message : 'Erro desconhecido'}. ` +
      `Pode ser necessário baixar manualmente de ${EMENDAS_DOWNLOAD_URL}`
    );
  }
  
  return resultado;
};

/**
 * Processa um arquivo ZIP de emendas já carregado (para upload manual)
 * 
 * @param arquivoZip - ArrayBuffer do arquivo ZIP
 * @param filtros - Filtros opcionais
 * @returns Resultado do processamento
 */
export const processarArquivoZIPEmendas = async (
  arquivoZip: ArrayBuffer,
  filtros?: {
    nomeAutor?: string;
    ano?: number;
    uf?: string;
  }
): Promise<ResultadoProcessamentoEmendasZIP> => {
  const resultado: ResultadoProcessamentoEmendasZIP = {
    emendas: null,
    beneficiarios: [],
    pagamentos: [],
    arquivosProcessados: [],
    erros: [],
    dataDownload: new Date(),
  };
  
  try {
    const zip = await JSZip.loadAsync(arquivoZip);
    
    for (const [nomeArquivo, arquivo] of Object.entries(zip.files)) {
      if (arquivo.dir || !nomeArquivo.toLowerCase().endsWith('.csv')) continue;
      
      try {
        const conteudo = await arquivo.async('string');
        const linhas = conteudo.split(/\r?\n/);
        
        if (linhas.length < 2) continue;
        
        const tipoArquivo = identificarTipoArquivo(linhas[0]);
        
        switch (tipoArquivo) {
          case 'emendas':
            resultado.emendas = processarCSVEmendas(conteudo, filtros);
            resultado.arquivosProcessados.push(`${nomeArquivo} (Emendas)`);
            break;
            
          case 'beneficiarios':
            resultado.beneficiarios = processarCSVBeneficiarios(conteudo, {
              uf: filtros?.uf,
            });
            resultado.arquivosProcessados.push(`${nomeArquivo} (Beneficiários)`);
            break;
            
          case 'pagamentos':
            resultado.pagamentos = processarCSVPagamentos(conteudo, {
              ano: filtros?.ano,
            });
            resultado.arquivosProcessados.push(`${nomeArquivo} (Pagamentos)`);
            break;
            
          default:
            resultado.arquivosProcessados.push(`${nomeArquivo} (Não identificado)`);
        }
      } catch (e) {
        resultado.erros.push(`Erro ao processar ${nomeArquivo}: ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
      }
    }
  } catch (error) {
    resultado.erros.push(`Erro ao processar ZIP: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
  
  return resultado;
};

/**
 * Agrega beneficiários por emenda
 */
export const agruparBeneficiariosPorEmenda = (
  beneficiarios: BeneficiarioEmenda[]
): Map<string, BeneficiarioEmenda[]> => {
  const mapa = new Map<string, BeneficiarioEmenda[]>();
  
  for (const beneficiario of beneficiarios) {
    const key = beneficiario.codigoEmenda;
    if (!mapa.has(key)) {
      mapa.set(key, []);
    }
    mapa.get(key)!.push(beneficiario);
  }
  
  return mapa;
};

/**
 * Agrega pagamentos por emenda
 */
export const agruparPagamentosPorEmenda = (
  pagamentos: PagamentoEmenda[]
): Map<string, PagamentoEmenda[]> => {
  const mapa = new Map<string, PagamentoEmenda[]>();
  
  for (const pagamento of pagamentos) {
    const key = pagamento.codigoEmenda;
    if (!mapa.has(key)) {
      mapa.set(key, []);
    }
    mapa.get(key)!.push(pagamento);
  }
  
  return mapa;
};

/**
 * Gera resumo estatístico dos beneficiários
 */
export const gerarResumoBeneficiarios = (beneficiarios: BeneficiarioEmenda[]): {
  totalBeneficiarios: number;
  valorTotalRecebido: number;
  porTipo: Map<string, { quantidade: number; valor: number }>;
  porUF: Map<string, { quantidade: number; valor: number }>;
  topBeneficiarios: BeneficiarioEmenda[];
} => {
  const porTipo = new Map<string, { quantidade: number; valor: number }>();
  const porUF = new Map<string, { quantidade: number; valor: number }>();
  
  let valorTotal = 0;
  
  for (const b of beneficiarios) {
    valorTotal += b.valorRecebido;
    
    // Por tipo
    const tipo = b.tipoBeneficiario || 'Não informado';
    const atualTipo = porTipo.get(tipo) || { quantidade: 0, valor: 0 };
    atualTipo.quantidade++;
    atualTipo.valor += b.valorRecebido;
    porTipo.set(tipo, atualTipo);
    
    // Por UF
    const uf = b.uf || 'Não informado';
    const atualUF = porUF.get(uf) || { quantidade: 0, valor: 0 };
    atualUF.quantidade++;
    atualUF.valor += b.valorRecebido;
    porUF.set(uf, atualUF);
  }
  
  // Top beneficiários por valor
  const topBeneficiarios = [...beneficiarios]
    .sort((a, b) => b.valorRecebido - a.valorRecebido)
    .slice(0, 20);
  
  return {
    totalBeneficiarios: beneficiarios.length,
    valorTotalRecebido: valorTotal,
    porTipo,
    porUF,
    topBeneficiarios,
  };
};

/**
 * Gera URL de download formatada para exibição
 */
export const getEmendasDownloadInfo = () => ({
  url: EMENDAS_DOWNLOAD_URL,
  descricao: 'Arquivo ZIP com todas as emendas parlamentares (contém 3 planilhas: Emendas, Beneficiários e Pagamentos)',
  formato: 'ZIP (contendo CSVs)',
  tamanhoEstimado: '50-300 MB',
  instrucoes: [
    '1. Clique no link para baixar o arquivo ZIP',
    '2. O arquivo contém 3 planilhas CSV:',
    '   - Emendas: dados gerais (código, autor, tipo, valores)',
    '   - Beneficiários: quem recebeu os recursos',
    '   - Pagamentos: detalhes dos pagamentos realizados',
    '3. Faça upload do arquivo ZIP ou extraia e faça upload dos CSVs individualmente',
  ],
});
