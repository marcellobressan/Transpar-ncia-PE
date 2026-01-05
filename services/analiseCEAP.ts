/**
 * Serviço de Análise Comparativa da Cota Parlamentar (CEAP)
 * 
 * Compara os gastos de um parlamentar com a média dos demais,
 * gerando diagnósticos e alertas sobre padrões de uso.
 * 
 * CEAP - Cota para Exercício da Atividade Parlamentar
 * Inclui: passagens, combustível, alimentação, hospedagem, telefonia,
 * serviços postais, manutenção de escritório, divulgação, etc.
 */

import * as camaraService from './camaraDeputados';

// Limites oficiais da CEAP (valores de 2024/2025)
// Fonte: https://www.camara.leg.br/transparencia/gastos-parlamentares
export const LIMITES_CEAP = {
  // Limite mensal varia por UF do parlamentar
  limiteMensalPorUF: {
    'AC': 45612.53, 'AL': 41676.13, 'AM': 44735.13, 'AP': 45612.53,
    'BA': 40971.73, 'CE': 43693.73, 'DF': 31722.13, 'ES': 38050.93,
    'GO': 35909.33, 'MA': 44735.13, 'MG': 37043.53, 'MS': 40449.73,
    'MT': 40449.73, 'PA': 44735.13, 'PB': 43693.73, 'PE': 42622.93,
    'PI': 43693.73, 'PR': 39059.33, 'RJ': 35759.33, 'RN': 43693.73,
    'RO': 45612.53, 'RR': 45612.53, 'RS': 42622.93, 'SC': 40449.73,
    'SE': 41676.13, 'SP': 37043.53, 'TO': 43693.73
  },
  // Limite de Pernambuco (referência principal)
  limiteMensalPE: 42622.93,
  // Média nacional
  limiteMensalMediaNacional: 40943.00,
  // Limite anual estimado (12 meses)
  limiteAnualPE: 42622.93 * 12,
};

// Categorias de despesas da CEAP
export const CATEGORIAS_CEAP = {
  'MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR': 'Escritório',
  'COMBUSTÍVEIS E LUBRIFICANTES': 'Combustível',
  'PASSAGEM AÉREA - REEMBOLSO': 'Passagens',
  'PASSAGEM AÉREA - RPA': 'Passagens',
  'PASSAGEM AÉREA - SIGEPA': 'Passagens',
  'TELEFONIA': 'Telefonia',
  'SERVIÇOS POSTAIS': 'Correios',
  'ASSINATURA DE PUBLICAÇÕES': 'Publicações',
  'FORNECIMENTO DE ALIMENTAÇÃO DO PARLAMENTAR': 'Alimentação',
  'HOSPEDAGEM, EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL': 'Hospedagem',
  'LOCAÇÃO OU FRETAMENTO DE VEÍCULOS AUTOMOTORES': 'Veículos',
  'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR': 'Divulgação',
  'PARTICIPAÇÃO EM CURSO, PALESTRA OU EVENTO SIMILAR': 'Eventos',
  'SERVIÇO DE TÁXI, PEDÁGIO E ESTACIONAMENTO': 'Táxi/Pedágio',
  'SERVIÇO DE SEGURANÇA PRESTADO POR EMPRESA ESPECIALIZADA': 'Segurança',
  'CONSULTORIAS, PESQUISAS E TRABALHOS TÉCNICOS': 'Consultorias',
};

// Interface para resultado da análise comparativa
export interface AnaliseComparativaCEAP {
  // Dados do parlamentar
  parlamentar: {
    nome: string;
    partido: string;
    uf: string;
    id: number;
  };
  
  // Gastos do parlamentar
  gastosMensal: number;
  gastosAnual: number;
  gastosPorCategoria: { categoria: string; valor: number; percentual: number }[];
  
  // Comparativo com limite
  limiteMensal: number;
  limiteAnual: number;
  percentualUtilizado: number;
  
  // Comparativo com média
  mediaDeputadosPE: number;
  mediaDeputadosNacional: number;
  diferencaDaMediaPE: number; // positivo = acima da média
  diferencaDaMediaNacional: number;
  percentualAcimaMediaPE: number;
  percentualAcimaMediaNacional: number;
  
  // Ranking
  posicaoRankingPE: number;
  totalDeputadosPE: number;
  posicaoRankingNacional: number;
  totalDeputadosNacional: number;
  
  // Diagnóstico
  diagnostico: DiagnosticoCEAP;
  
  // Alertas específicos
  alertas: AlertaCEAP[];
  
  // Período analisado
  periodo: {
    mesInicio: string;
    mesFim: string;
    mesesAnalisados: number;
  };
}

export interface DiagnosticoCEAP {
  classificacao: 'EXEMPLAR' | 'ECONOMICO' | 'MODERADO' | 'ELEVADO' | 'EXCESSIVO';
  cor: string;
  icone: string;
  titulo: string;
  descricao: string;
  pontosFavoraveis: string[];
  pontosAtencao: string[];
  recomendacoes: string[];
}

export interface AlertaCEAP {
  tipo: 'COMBUSTIVEL' | 'PASSAGENS' | 'ALIMENTACAO' | 'DIVULGACAO' | 'OUTROS';
  severidade: 'baixa' | 'media' | 'alta';
  titulo: string;
  descricao: string;
  valor?: number;
  detalhes?: string;
}

export interface MediaDeputados {
  mediaPE: number;
  mediaNacional: number;
  rankingPE: { nome: string; partido: string; total: number }[];
  totalDeputadosPE: number;
  totalDeputadosNacional: number;
}

// Cache para evitar requisições repetidas
const cacheMedias = new Map<string, { data: MediaDeputados; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

/**
 * Busca a média de gastos de todos os deputados federais de PE
 * e a média nacional para comparação
 */
export async function buscarMediaDeputados(ano: number): Promise<MediaDeputados> {
  const cacheKey = `media_deputados_${ano}`;
  const cached = cacheMedias.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    // Busca todos os deputados de PE
    const deputadosPE = await camaraService.getDeputiesByState('PE');
    
    // Busca despesas de cada deputado de PE
    const gastosPromises = deputadosPE.map(async (dep) => {
      const despesas = await camaraService.getDeputyExpenses(dep.id, ano);
      const total = despesas.reduce((sum, d) => sum + d.valorLiquido, 0);
      return {
        nome: dep.nome,
        partido: dep.siglaPartido,
        id: dep.id,
        total
      };
    });
    
    const gastosPE = await Promise.all(gastosPromises);
    const gastosValidos = gastosPE.filter(g => g.total > 0);
    
    // Calcula média de PE
    const totalPE = gastosValidos.reduce((sum, g) => sum + g.total, 0);
    const mediaPE = gastosValidos.length > 0 ? totalPE / gastosValidos.length : 0;
    
    // Ranking PE (ordenado do maior para o menor)
    const rankingPE = gastosValidos
      .sort((a, b) => b.total - a.total)
      .map(g => ({ nome: g.nome, partido: g.partido, total: g.total }));
    
    // Média nacional estimada (baseada em dados históricos)
    // Em uma implementação real, buscaria todos os 513 deputados
    const mediaNacional = LIMITES_CEAP.limiteMensalMediaNacional * 10; // ~10 meses de dados
    
    const result: MediaDeputados = {
      mediaPE,
      mediaNacional,
      rankingPE,
      totalDeputadosPE: gastosValidos.length,
      totalDeputadosNacional: 513 // Total de deputados federais
    };
    
    cacheMedias.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Erro ao buscar média de deputados:', error);
    
    // Retorna valores padrão em caso de erro
    return {
      mediaPE: LIMITES_CEAP.limiteMensalPE * 8, // Estimativa
      mediaNacional: LIMITES_CEAP.limiteMensalMediaNacional * 8,
      rankingPE: [],
      totalDeputadosPE: 25, // PE tem ~25 deputados federais
      totalDeputadosNacional: 513
    };
  }
}

/**
 * Gera diagnóstico detalhado baseado no percentual de uso da CEAP
 */
function gerarDiagnostico(
  percentualUtilizado: number,
  percentualAcimaMedia: number,
  alertas: AlertaCEAP[]
): DiagnosticoCEAP {
  const alertasAltos = alertas.filter(a => a.severidade === 'alta').length;
  
  // EXEMPLAR: Usa menos de 40% do limite e está abaixo da média
  if (percentualUtilizado <= 40 && percentualAcimaMedia <= 0) {
    return {
      classificacao: 'EXEMPLAR',
      cor: 'emerald',
      icone: '🏆',
      titulo: 'Uso Exemplar da Cota',
      descricao: `Este parlamentar utiliza apenas ${percentualUtilizado.toFixed(0)}% do limite disponível, demonstrando economia significativa com recursos públicos.`,
      pontosFavoraveis: [
        'Gastos muito abaixo do limite permitido',
        'Abaixo da média dos demais parlamentares',
        'Demonstra responsabilidade fiscal'
      ],
      pontosAtencao: [],
      recomendacoes: [
        'Manter o padrão de economia',
        'Compartilhar boas práticas com colegas'
      ]
    };
  }
  
  // ECONÔMICO: Usa entre 40-60% do limite ou está abaixo da média
  if (percentualUtilizado <= 60 || percentualAcimaMedia < -10) {
    return {
      classificacao: 'ECONOMICO',
      cor: 'green',
      icone: '✅',
      titulo: 'Uso Econômico da Cota',
      descricao: `Parlamentar utiliza ${percentualUtilizado.toFixed(0)}% do limite, mantendo gastos controlados.`,
      pontosFavoraveis: [
        'Gastos abaixo do limite',
        percentualAcimaMedia < 0 ? 'Abaixo da média geral' : 'Próximo da média'
      ],
      pontosAtencao: alertas.length > 0 ? ['Há alguns pontos que merecem atenção'] : [],
      recomendacoes: [
        'Continuar monitorando gastos mensalmente',
        'Manter transparência nas prestações de contas'
      ]
    };
  }
  
  // MODERADO: Usa entre 60-80% do limite
  if (percentualUtilizado <= 80 && alertasAltos === 0) {
    return {
      classificacao: 'MODERADO',
      cor: 'amber',
      icone: '⚖️',
      titulo: 'Uso Moderado da Cota',
      descricao: `Utilização de ${percentualUtilizado.toFixed(0)}% do limite. Gastos dentro do esperado, mas acima da média.`,
      pontosFavoraveis: [
        'Dentro do limite legal',
        'Sem irregularidades identificadas'
      ],
      pontosAtencao: [
        percentualAcimaMedia > 0 ? `${percentualAcimaMedia.toFixed(0)}% acima da média dos colegas` : '',
        ...alertas.map(a => a.titulo)
      ].filter(Boolean),
      recomendacoes: [
        'Avaliar redução de gastos em categorias de maior valor',
        'Comparar práticas com parlamentares mais econômicos',
        'Justificar despesas acima da média'
      ]
    };
  }
  
  // ELEVADO: Usa entre 80-95% do limite ou tem alertas altos
  if (percentualUtilizado <= 95 || alertasAltos <= 1) {
    return {
      classificacao: 'ELEVADO',
      cor: 'orange',
      icone: '⚠️',
      titulo: 'Uso Elevado da Cota',
      descricao: `Atenção: utilização de ${percentualUtilizado.toFixed(0)}% do limite disponível. Necessita revisão de gastos.`,
      pontosFavoraveis: [
        'Ainda dentro do limite legal'
      ],
      pontosAtencao: [
        'Muito próximo do limite máximo',
        percentualAcimaMedia > 20 ? `${percentualAcimaMedia.toFixed(0)}% acima da média` : '',
        ...alertas.filter(a => a.severidade !== 'baixa').map(a => a.titulo)
      ].filter(Boolean),
      recomendacoes: [
        'Revisar imediatamente as maiores categorias de despesa',
        'Buscar alternativas mais econômicas',
        'Justificar publicamente os gastos elevados',
        'Considerar devolver valores não utilizados'
      ]
    };
  }
  
  // EXCESSIVO: Usa mais de 95% do limite ou tem múltiplos alertas altos
  return {
    classificacao: 'EXCESSIVO',
    cor: 'red',
    icone: '🚨',
    titulo: 'Uso Excessivo da Cota',
    descricao: `Alerta: utilização de ${percentualUtilizado.toFixed(0)}% do limite. Gastos acima do recomendável.`,
    pontosFavoraveis: [],
    pontosAtencao: [
      'Utilização no limite ou acima do permitido',
      `Significativamente acima da média (${percentualAcimaMedia.toFixed(0)}% a mais)`,
      ...alertas.map(a => a.titulo)
    ],
    recomendacoes: [
      'Redução urgente de gastos',
      'Auditoria detalhada das despesas',
      'Transparência total sobre justificativas',
      'Avaliar devolução de recursos ao erário'
    ]
  };
}

/**
 * Gera alertas específicos por categoria de gasto
 */
function gerarAlertas(
  gastosPorCategoria: { categoria: string; valor: number; percentual: number }[],
  mediaCategoriaPE: Record<string, number> = {}
): AlertaCEAP[] {
  const alertas: AlertaCEAP[] = [];
  
  // Verifica combustível (categoria mais fiscalizada)
  const combustivel = gastosPorCategoria.find(g => 
    g.categoria.toUpperCase().includes('COMBUSTÍV')
  );
  if (combustivel) {
    if (combustivel.percentual > 25) {
      alertas.push({
        tipo: 'COMBUSTIVEL',
        severidade: 'alta',
        titulo: 'Gasto elevado com combustível',
        descricao: `${combustivel.percentual.toFixed(0)}% da cota gasta com combustíveis`,
        valor: combustivel.valor,
        detalhes: 'Combustíveis representam uma parcela alta dos gastos. Esta categoria é frequentemente auditada.'
      });
    } else if (combustivel.percentual > 15) {
      alertas.push({
        tipo: 'COMBUSTIVEL',
        severidade: 'media',
        titulo: 'Atenção: gastos com combustível',
        descricao: `${combustivel.percentual.toFixed(0)}% da cota com combustíveis`,
        valor: combustivel.valor
      });
    }
  }
  
  // Verifica passagens aéreas
  const passagens = gastosPorCategoria.find(g => 
    g.categoria.toUpperCase().includes('PASSAGEM')
  );
  if (passagens && passagens.percentual > 30) {
    alertas.push({
      tipo: 'PASSAGENS',
      severidade: passagens.percentual > 40 ? 'alta' : 'media',
      titulo: 'Alto gasto com passagens aéreas',
      descricao: `${passagens.percentual.toFixed(0)}% da cota em passagens`,
      valor: passagens.valor,
      detalhes: 'Verificar se há alternativas mais econômicas ou se as viagens são todas justificadas.'
    });
  }
  
  // Verifica alimentação
  const alimentacao = gastosPorCategoria.find(g => 
    g.categoria.toUpperCase().includes('ALIMENTAÇÃO') || 
    g.categoria.toUpperCase().includes('ALIMENTACAO')
  );
  if (alimentacao && alimentacao.percentual > 10) {
    alertas.push({
      tipo: 'ALIMENTACAO',
      severidade: alimentacao.percentual > 15 ? 'alta' : 'media',
      titulo: 'Gastos elevados com alimentação',
      descricao: `${alimentacao.percentual.toFixed(0)}% da cota em alimentação`,
      valor: alimentacao.valor
    });
  }
  
  // Verifica divulgação (categoria polêmica)
  const divulgacao = gastosPorCategoria.find(g => 
    g.categoria.toUpperCase().includes('DIVULGAÇÃO') ||
    g.categoria.toUpperCase().includes('DIVULGACAO')
  );
  if (divulgacao && divulgacao.percentual > 20) {
    alertas.push({
      tipo: 'DIVULGACAO',
      severidade: divulgacao.percentual > 30 ? 'alta' : 'media',
      titulo: 'Alto investimento em divulgação',
      descricao: `${divulgacao.percentual.toFixed(0)}% da cota em divulgação parlamentar`,
      valor: divulgacao.valor,
      detalhes: 'Divulgação da atividade parlamentar é permitida, mas valores elevados geram questionamentos.'
    });
  }
  
  return alertas;
}

/**
 * Realiza análise comparativa completa dos gastos CEAP de um parlamentar
 */
export async function analisarCEAPComparativo(
  deputadoId: number,
  nome: string,
  partido: string,
  uf: string = 'PE',
  ano: number = new Date().getFullYear()
): Promise<AnaliseComparativaCEAP> {
  try {
    // Busca despesas do deputado
    const despesas = await camaraService.getDeputyExpenses(deputadoId, ano);
    
    // Se não houver dados do ano atual, tenta o anterior
    let despesasAnalisadas = despesas;
    let anoAnalisado = ano;
    if (despesas.length === 0 && ano === new Date().getFullYear()) {
      despesasAnalisadas = await camaraService.getDeputyExpenses(deputadoId, ano - 1);
      anoAnalisado = ano - 1;
    }
    
    // Calcula total anual
    const gastosAnual = despesasAnalisadas.reduce((sum, d) => sum + d.valorLiquido, 0);
    
    // Identifica período
    const meses = [...new Set(despesasAnalisadas.map(d => d.mes))].sort((a, b) => a - b);
    const mesesAnalisados = meses.length || 1;
    const gastosMensal = gastosAnual / mesesAnalisados;
    
    // Agrupa por categoria
    const categoriaMap = new Map<string, number>();
    despesasAnalisadas.forEach(d => {
      const atual = categoriaMap.get(d.tipoDespesa) || 0;
      categoriaMap.set(d.tipoDespesa, atual + d.valorLiquido);
    });
    
    const gastosPorCategoria = Array.from(categoriaMap.entries())
      .map(([categoria, valor]) => ({
        categoria,
        valor,
        percentual: gastosAnual > 0 ? (valor / gastosAnual) * 100 : 0
      }))
      .sort((a, b) => b.valor - a.valor);
    
    // Busca médias para comparação
    const medias = await buscarMediaDeputados(anoAnalisado);
    
    // Calcula comparativos
    const limiteMensal = LIMITES_CEAP.limiteMensalPorUF[uf] || LIMITES_CEAP.limiteMensalPE;
    const limiteAnual = limiteMensal * 12;
    const percentualUtilizado = (gastosAnual / limiteAnual) * 100;
    
    const diferencaDaMediaPE = gastosAnual - medias.mediaPE;
    const diferencaDaMediaNacional = gastosAnual - medias.mediaNacional;
    const percentualAcimaMediaPE = medias.mediaPE > 0 
      ? ((gastosAnual - medias.mediaPE) / medias.mediaPE) * 100 
      : 0;
    const percentualAcimaMediaNacional = medias.mediaNacional > 0
      ? ((gastosAnual - medias.mediaNacional) / medias.mediaNacional) * 100
      : 0;
    
    // Calcula posição no ranking
    const posicaoRankingPE = medias.rankingPE.findIndex(r => r.nome === nome) + 1 || medias.totalDeputadosPE;
    
    // Gera alertas
    const alertas = gerarAlertas(gastosPorCategoria);
    
    // Gera diagnóstico
    const diagnostico = gerarDiagnostico(percentualUtilizado, percentualAcimaMediaPE, alertas);
    
    return {
      parlamentar: {
        nome,
        partido,
        uf,
        id: deputadoId
      },
      gastosMensal,
      gastosAnual,
      gastosPorCategoria,
      limiteMensal,
      limiteAnual,
      percentualUtilizado,
      mediaDeputadosPE: medias.mediaPE,
      mediaDeputadosNacional: medias.mediaNacional,
      diferencaDaMediaPE,
      diferencaDaMediaNacional,
      percentualAcimaMediaPE,
      percentualAcimaMediaNacional,
      posicaoRankingPE,
      totalDeputadosPE: medias.totalDeputadosPE,
      posicaoRankingNacional: Math.round(513 * (percentualUtilizado / 100)), // Estimativa
      totalDeputadosNacional: 513,
      diagnostico,
      alertas,
      periodo: {
        mesInicio: meses.length > 0 ? `${String(meses[0]).padStart(2, '0')}/${anoAnalisado}` : `01/${anoAnalisado}`,
        mesFim: meses.length > 0 ? `${String(meses[meses.length - 1]).padStart(2, '0')}/${anoAnalisado}` : `12/${anoAnalisado}`,
        mesesAnalisados
      }
    };
  } catch (error) {
    console.error('Erro na análise comparativa CEAP:', error);
    throw error;
  }
}

/**
 * Formata valor em BRL com cores baseadas na comparação
 */
export function formatarValorComparativo(valor: number, comparativo: number): {
  texto: string;
  cor: string;
  icone: string;
} {
  const diferenca = valor - comparativo;
  const percentual = comparativo > 0 ? (diferenca / comparativo) * 100 : 0;
  
  const texto = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
  
  if (percentual <= -20) {
    return { texto, cor: 'text-emerald-600', icone: '↓↓' };
  } else if (percentual < 0) {
    return { texto, cor: 'text-green-600', icone: '↓' };
  } else if (percentual <= 20) {
    return { texto, cor: 'text-amber-600', icone: '→' };
  } else if (percentual <= 50) {
    return { texto, cor: 'text-orange-600', icone: '↑' };
  } else {
    return { texto, cor: 'text-red-600', icone: '↑↑' };
  }
}

export default {
  analisarCEAPComparativo,
  buscarMediaDeputados,
  formatarValorComparativo,
  LIMITES_CEAP,
  CATEGORIAS_CEAP
};
