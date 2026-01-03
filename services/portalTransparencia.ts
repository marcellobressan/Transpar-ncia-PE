export const API_KEY = '9133530778e9c7f8e161806b556373bd';
export const BASE_URL = 'https://api.portaldatransparencia.gov.br/api-de-dados';

// Flag para desativar chamadas à API quando CORS falha
let corsBlocked = false;

// ============================================
// TIPOS E INTERFACES - EMENDAS PARLAMENTARES
// ============================================

export interface EmendaParlamentar {
  codigoEmenda: string;
  ano: number;
  tipoEmenda: string; // "Individual", "Bancada", "Comissão", "Relator"
  autor: {
    nome: string;
    codigoAutor: string;
    tipo: string; // "Parlamentar", "Bancada"
  };
  localidadeGasto: string;
  funcao: string;
  subfuncao: string;
  planoOrcamentario: string;
  valorEmpenhado: number;
  valorLiquidado: number;
  valorPago: number;
  valorRestoInscrito: number;
  valorRestoCancelado: number;
  valorRestoPago: number;
}

export interface EmendaDetalhada {
  codigoEmenda: string;
  ano: number;
  tipoEmenda: string;
  nomeAutor: string;
  localidade: string;
  funcao: string;
  subfuncao: string;
  valorEmpenhado: number;
  valorPago: number;
  percentualExecutado: number;
  beneficiarios?: string[];
}

export interface EmendasPorTipo {
  individual: number;
  bancada: number;
  comissao: number;
  relator: number;
  transferenciasEspeciais: number;
}

export interface EmendasPorFuncao {
  funcao: string;
  valorEmpenhado: number;
  valorPago: number;
  quantidade: number;
}

export interface EmendasPorLocalidade {
  localidade: string;
  valorTotal: number;
  quantidade: number;
  isRecife: boolean;
  isPernambuco: boolean;
}

export interface ResumoEmendasAutor {
  nomeAutor: string;
  totalEmendas: number;
  valorTotalEmpenhado: number;
  valorTotalPago: number;
  percentualExecucao: number;
  porTipo: EmendasPorTipo;
  porFuncao: EmendasPorFuncao[];
  porLocalidade: EmendasPorLocalidade[];
  historicoAnual: { ano: number; empenhado: number; pago: number }[];
  topBeneficiarios: { nome: string; valor: number }[];
  alertas: string[];
}

export interface DetailedAmendmentStats {
  year: number;
  totalEmpenhado: number;
  totalLiquidado: number;
  totalPago: number;
  areas: Record<string, number>; // Area name (Função) -> Amount
  locations: Record<string, number>; // Location (Município/UF) -> Amount
}

export interface Servidor {
  id: number;
  nome: string;
  cpfFormatado: string;
  orgaoServidorLotacao: {
    codigo: string;
    nome: string;
    sigla: string;
  };
  tipoServidor: string;
}

export interface Remuneracao {
  ano: number;
  mes: number;
  remuneracaoBasicaBruta: string;
  remuneracaoBasicaLiquida: string;
  outrasVerbasRemuneratorias: string;
  fundoSaude: string;
  taxaOcupacaoImovelFuncional: string;
  verbasIndenizatorias: string;
}

// Helper to parse Brazilian currency string format "1.000,00" -> 1000.00
const parseBRL = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove all dots (thousands separators) and replace comma with dot
    return parseFloat(value.replace(/\./g, '').replace(',', '.'));
  }
  return 0;
};

/**
 * Verifica se a API está acessível (sem bloqueio CORS).
 * Esta função tenta uma requisição simples para verificar se CORS está permitido.
 */
export const checkApiAccess = async (): Promise<boolean> => {
  if (corsBlocked) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${BASE_URL}/servidores?pagina=1&quantidade=1`, {
      method: 'HEAD',
      headers: { 'chave-api-dados': API_KEY },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('Portal da Transparência API não acessível (CORS bloqueado ou offline)');
    corsBlocked = true;
    return false;
  }
};

/**
 * Busca o ID de um servidor pelo nome exato ou aproximado.
 * Retorna null se a API não estiver acessível devido a CORS.
 */
export const fetchServidorId = async (name: string): Promise<Servidor | null> => {
  // Se CORS já foi bloqueado, não tenta novamente
  if (corsBlocked) {
    console.info('Busca no Portal da Transparência desabilitada (CORS bloqueado)');
    return null;
  }
  
  try {
    const url = `${BASE_URL}/servidores?nome=${encodeURIComponent(name)}&pagina=1`;
    const response = await fetch(url, {
      headers: { 'chave-api-dados': API_KEY, 'Accept': 'application/json' }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      // Retorna o primeiro match. Em produção, seria ideal filtrar por órgão ou CPF parcial.
      return data[0]; 
    }
    return null;
  } catch (error) {
    // Se for erro de CORS/rede, marca como bloqueado para evitar requisições futuras
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      corsBlocked = true;
      console.warn('Portal da Transparência bloqueado por CORS. Usando apenas dados locais.');
    } else {
      console.error("Erro ao buscar servidor:", error);
    }
    return null;
  }
};

/**
 * Busca a remuneração de um servidor por ID e Ano.
 */
export const fetchRemuneracaoByYear = async (servidorId: number, year: number): Promise<Remuneracao[]> => {
  if (corsBlocked) return [];
  
  try {
    // A API de remuneração retorna dados por mês ou ano. Vamos buscar a lista e filtrar.
    // Endpoint: /servidores/{id}/remuneracao
    const url = `${BASE_URL}/servidores/${servidorId}/remuneracao?ano=${year}&pagina=1`;
    
    const response = await fetch(url, {
      headers: { 'chave-api-dados': API_KEY, 'Accept': 'application/json' }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      corsBlocked = true;
    }
    console.error(`Erro ao buscar remuneração para ID ${servidorId}:`, error);
    return [];
  }
};

export const fetchAmendmentsByAuthor = async (authorName: string, year: number): Promise<DetailedAmendmentStats | null> => {
  if (corsBlocked) return null;
  
  try {
    let allData: any[] = [];
    let page = 1;
    let hasMore = true;
    // Limite de segurança para evitar loops infinitos ou bloqueio de taxa na demo
    const MAX_PAGES = 10; 

    // Loop de paginação para buscar TODAS as emendas do ano
    while (hasMore && page <= MAX_PAGES) {
      const url = `${BASE_URL}/emendas?codigoEmenda=&ano=${year}&nomeAutor=${encodeURIComponent(authorName)}&pagina=${page}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'chave-api-dados': API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (page === 1) {
            // Se falhar na primeira página, lança erro
            if (response.status === 401) throw new Error("Chave de API inválida");
            if (response.status === 403) throw new Error("Acesso negado (CORS ou IP bloqueado)");
            throw new Error(`Erro na API: ${response.status}`);
        } else {
            // Se falhar em páginas subsequentes (ex: rate limit), para e usa o que tem
            console.warn(`Parando busca na página ${page} devido a erro.`);
            hasMore = false;
            break;
        }
      }

      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
         allData = [...allData, ...data];
         page++;
      } else {
         hasMore = false;
      }
    }
    
    if (allData.length > 0) {
       const stats: DetailedAmendmentStats = {
         year,
         totalEmpenhado: 0,
         totalLiquidado: 0,
         totalPago: 0,
         areas: {},
         locations: {}
       };

       allData.forEach((curr: any) => {
         const empenhado = parseBRL(curr.valorEmpenhado);
         const liquidado = parseBRL(curr.valorLiquidado);
         const pago = parseBRL(curr.valorPago);
         
         stats.totalEmpenhado += empenhado;
         stats.totalLiquidado += liquidado;
         stats.totalPago += pago;

         // Aggregate Areas (Função)
         // A API retorna campos como "funcao", "subfuncao"
         const area = curr.funcao || 'Não classificado';
         stats.areas[area] = (stats.areas[area] || 0) + empenhado;

         // Aggregate Locations (Localidade)
         // A API retorna "localidade" geralmente como "MUNICIO - UF"
         const location = curr.localidade || 'Nacional/Estadual';
         stats.locations[location] = (stats.locations[location] || 0) + empenhado;
       });
       
       return stats;
    }

    return null;
  } catch (error) {
    console.error(`Erro ao buscar dados do Portal da Transparência (Ano ${year}):`, error);
    // Não lança erro para não quebrar o Promise.all, retorna null
    return null;
  }
};

// ============================================
// NOVAS FUNÇÕES - EMENDAS PARLAMENTARES v2
// ============================================

/**
 * Busca emendas parlamentares com filtros avançados
 * Endpoint: /emendas
 * Documentação: https://portaldatransparencia.gov.br/api-de-dados/emendas
 */
export const fetchEmendasAvancado = async (params: {
  nomeAutor?: string;
  codigoAutor?: string;
  ano?: number;
  tipoEmenda?: string; // 1=Individual, 2=Bancada, 3=Comissão, 6=Relator, 8=Transfer. Especiais
  uf?: string;
  codigoFuncao?: string;
  pagina?: number;
  quantidade?: number;
}): Promise<EmendaDetalhada[]> => {
  if (corsBlocked) return [];

  try {
    const queryParams = new URLSearchParams();
    if (params.nomeAutor) queryParams.append('nomeAutor', params.nomeAutor);
    if (params.codigoAutor) queryParams.append('codigoAutor', params.codigoAutor);
    if (params.ano) queryParams.append('ano', params.ano.toString());
    if (params.tipoEmenda) queryParams.append('tipoEmenda', params.tipoEmenda);
    if (params.uf) queryParams.append('uf', params.uf);
    if (params.codigoFuncao) queryParams.append('codigoFuncao', params.codigoFuncao);
    queryParams.append('pagina', (params.pagina || 1).toString());
    queryParams.append('quantidade', (params.quantidade || 100).toString());

    const url = `${BASE_URL}/emendas?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: { 'chave-api-dados': API_KEY, 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.warn(`Erro ao buscar emendas: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => {
      const empenhado = parseBRL(item.valorEmpenhado);
      const pago = parseBRL(item.valorPago);
      return {
        codigoEmenda: item.codigoEmenda || '',
        ano: item.ano || params.ano || 0,
        tipoEmenda: item.tipoEmenda || 'Não informado',
        nomeAutor: item.nomeAutor || item.autor?.nome || 'Não informado',
        localidade: item.localidadeDoGasto || item.localidade || 'Nacional',
        funcao: item.funcao || 'Não classificado',
        subfuncao: item.subfuncao || '',
        valorEmpenhado: empenhado,
        valorPago: pago,
        percentualExecutado: empenhado > 0 ? Math.round((pago / empenhado) * 100) : 0,
      };
    });
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      corsBlocked = true;
    }
    console.error('Erro ao buscar emendas avançado:', error);
    return [];
  }
};

/**
 * Busca todas as emendas de um autor em múltiplos anos
 * Retorna um resumo consolidado
 */
export const fetchResumoEmendasAutor = async (
  nomeAutor: string,
  anosConsulta: number[] = [2024, 2023, 2022, 2021, 2020]
): Promise<ResumoEmendasAutor | null> => {
  if (corsBlocked) return null;

  try {
    const todasEmendas: EmendaDetalhada[] = [];
    
    // Busca emendas para cada ano
    for (const ano of anosConsulta) {
      let pagina = 1;
      let hasMore = true;
      const MAX_PAGES = 5;

      while (hasMore && pagina <= MAX_PAGES) {
        const emendas = await fetchEmendasAvancado({
          nomeAutor,
          ano,
          pagina,
          quantidade: 100
        });

        if (emendas.length > 0) {
          todasEmendas.push(...emendas);
          pagina++;
        } else {
          hasMore = false;
        }
        
        // Pequeno delay para evitar rate limiting
        if (hasMore) await new Promise(r => setTimeout(r, 100));
      }
    }

    if (todasEmendas.length === 0) return null;

    // Processamento e agregação dos dados
    const porTipo: EmendasPorTipo = {
      individual: 0,
      bancada: 0,
      comissao: 0,
      relator: 0,
      transferenciasEspeciais: 0
    };

    const funcaoMap: Record<string, { empenhado: number; pago: number; qtd: number }> = {};
    const localidadeMap: Record<string, { valor: number; qtd: number }> = {};
    const anoMap: Record<number, { empenhado: number; pago: number }> = {};
    const alertas: string[] = [];

    let totalEmpenhado = 0;
    let totalPago = 0;

    todasEmendas.forEach(emenda => {
      totalEmpenhado += emenda.valorEmpenhado;
      totalPago += emenda.valorPago;

      // Por tipo
      const tipoLower = emenda.tipoEmenda.toLowerCase();
      if (tipoLower.includes('individual')) porTipo.individual += emenda.valorEmpenhado;
      else if (tipoLower.includes('bancada')) porTipo.bancada += emenda.valorEmpenhado;
      else if (tipoLower.includes('comissão') || tipoLower.includes('comissao')) porTipo.comissao += emenda.valorEmpenhado;
      else if (tipoLower.includes('relator')) porTipo.relator += emenda.valorEmpenhado;
      else if (tipoLower.includes('especiai')) porTipo.transferenciasEspeciais += emenda.valorEmpenhado;

      // Por função
      if (!funcaoMap[emenda.funcao]) {
        funcaoMap[emenda.funcao] = { empenhado: 0, pago: 0, qtd: 0 };
      }
      funcaoMap[emenda.funcao].empenhado += emenda.valorEmpenhado;
      funcaoMap[emenda.funcao].pago += emenda.valorPago;
      funcaoMap[emenda.funcao].qtd += 1;

      // Por localidade
      if (!localidadeMap[emenda.localidade]) {
        localidadeMap[emenda.localidade] = { valor: 0, qtd: 0 };
      }
      localidadeMap[emenda.localidade].valor += emenda.valorEmpenhado;
      localidadeMap[emenda.localidade].qtd += 1;

      // Por ano
      if (!anoMap[emenda.ano]) {
        anoMap[emenda.ano] = { empenhado: 0, pago: 0 };
      }
      anoMap[emenda.ano].empenhado += emenda.valorEmpenhado;
      anoMap[emenda.ano].pago += emenda.valorPago;

      // Alertas
      if (emenda.percentualExecutado < 30 && emenda.valorEmpenhado > 500000) {
        if (!alertas.some(a => a.includes('baixa execução'))) {
          alertas.push(`Emendas com baixa execução financeira detectadas (${emenda.percentualExecutado}% em ${emenda.localidade})`);
        }
      }
    });

    // Verifica concentração geográfica
    const localidadesOrdenadas = Object.entries(localidadeMap)
      .sort(([, a], [, b]) => b.valor - a.valor);
    
    if (localidadesOrdenadas.length > 0) {
      const topLocalidade = localidadesOrdenadas[0];
      const percentualTop = (topLocalidade[1].valor / totalEmpenhado) * 100;
      if (percentualTop > 60) {
        alertas.push(`${percentualTop.toFixed(0)}% das emendas concentradas em ${topLocalidade[0]}`);
      }
    }

    // Verifica se PE está recebendo recursos
    const emendasPE = localidadesOrdenadas.filter(([loc]) => 
      loc.toLowerCase().includes('pernambuco') || 
      loc.toLowerCase().includes(' - pe') ||
      loc.toLowerCase().includes('recife')
    );
    
    const valorPE = emendasPE.reduce((sum, [, data]) => sum + data.valor, 0);
    if (valorPE === 0 && totalEmpenhado > 0) {
      alertas.push('Nenhuma emenda identificada diretamente para Pernambuco');
    }

    // Formata resultado final
    const porFuncao: EmendasPorFuncao[] = Object.entries(funcaoMap)
      .map(([funcao, data]) => ({
        funcao,
        valorEmpenhado: data.empenhado,
        valorPago: data.pago,
        quantidade: data.qtd
      }))
      .sort((a, b) => b.valorEmpenhado - a.valorEmpenhado)
      .slice(0, 10);

    const porLocalidade: EmendasPorLocalidade[] = localidadesOrdenadas
      .map(([localidade, data]) => ({
        localidade,
        valorTotal: data.valor,
        quantidade: data.qtd,
        isRecife: localidade.toLowerCase().includes('recife'),
        isPernambuco: localidade.toLowerCase().includes('pernambuco') || localidade.toLowerCase().includes(' - pe')
      }))
      .slice(0, 15);

    const historicoAnual = Object.entries(anoMap)
      .map(([ano, data]) => ({
        ano: parseInt(ano),
        empenhado: data.empenhado,
        pago: data.pago
      }))
      .sort((a, b) => b.ano - a.ano);

    return {
      nomeAutor,
      totalEmendas: todasEmendas.length,
      valorTotalEmpenhado: totalEmpenhado,
      valorTotalPago: totalPago,
      percentualExecucao: totalEmpenhado > 0 ? Math.round((totalPago / totalEmpenhado) * 100) : 0,
      porTipo,
      porFuncao,
      porLocalidade,
      historicoAnual,
      topBeneficiarios: [], // Requer endpoint adicional
      alertas
    };
  } catch (error) {
    console.error('Erro ao buscar resumo de emendas:', error);
    return null;
  }
};

/**
 * Busca emendas destinadas a Pernambuco
 */
export const fetchEmendasPernambuco = async (ano: number): Promise<EmendaDetalhada[]> => {
  return fetchEmendasAvancado({ uf: 'PE', ano, quantidade: 100 });
};

/**
 * Busca emendas por tipo (Individual, Bancada, Relator, etc.)
 * Tipos: 1=Individual, 2=Bancada, 3=Comissão, 6=Relator, 8=Transferências Especiais
 */
export const fetchEmendasPorTipo = async (
  nomeAutor: string,
  tipoEmenda: '1' | '2' | '3' | '6' | '8',
  ano: number
): Promise<EmendaDetalhada[]> => {
  return fetchEmendasAvancado({ nomeAutor, tipoEmenda, ano });
};

/**
 * Gera URL para consulta manual no portal
 */
export const getUrlConsultaEmendas = (nomeAutor: string, ano?: number): string => {
  const params = new URLSearchParams({
    ordenarPor: 'autor',
    direcao: 'asc',
  });
  if (nomeAutor) params.append('de', nomeAutor);
  if (ano) params.append('ano', ano.toString());
  
  return `https://portaldatransparencia.gov.br/emendas/consulta?${params.toString()}`;
};

/**
 * Formata valor monetário em texto legível
 */
export const formatarValorEmenda = (valor: number): string => {
  if (valor >= 1000000000) return `R$ ${(valor / 1000000000).toFixed(1)} bi`;
  if (valor >= 1000000) return `R$ ${(valor / 1000000).toFixed(1)} mi`;
  if (valor >= 1000) return `R$ ${(valor / 1000).toFixed(0)} mil`;
  return `R$ ${valor.toFixed(2)}`;
};