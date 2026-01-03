/**
 * Serviço de integração com a API de Dados Abertos da Câmara dos Deputados
 * 
 * FONTES DE DADOS:
 * 
 * 1. API REST v2 (Principal - Recomendada)
 *    - URL: https://dadosabertos.camara.leg.br/api/v2
 *    - Documentação: https://dadosabertos.camara.leg.br/swagger/api.html
 *    - Versão: 0.4.333 (12/17/2025)
 *    - Formatos: JSON, XML
 *    - Limites: 15 itens padrão, máx 100 por requisição
 * 
 * 2. WebServices SOAP/XML (Legado)
 *    - URL: https://www.camara.leg.br/SitCamaraWS/Deputados.asmx
 *    - Operações: ObterDeputados, ObterDetalhesDeputado, ObterLideresBancadas
 *    - Docs: https://www2.camara.leg.br/transparencia/dados-abertos/dados-abertos-legislativo/webservices/deputados
 *    - Formato: XML/SOAP
 * 
 * 3. Dados Abertos Legislativo
 *    - URL: https://www2.camara.leg.br/transparencia/dados-abertos/dados-abertos-legislativo
 *    - Inclui: proposições, votações, órgãos, deputados
 * 
 * NOTA: Preferimos a API REST v2 por ser mais moderna e suportar JSON.
 *       Os webservices SOAP são mantidos para compatibilidade e dados específicos.
 */

// URLs das APIs
const BASE_URL = 'https://dadosabertos.camara.leg.br/api/v2';
const SOAP_URL = 'https://www.camara.leg.br/SitCamaraWS/Deputados.asmx';

import { SpendingRecord, AdvisorStats } from '../types';

// Cache para evitar requisições repetidas
const cache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export interface Deputy {
  id: number;
  uri: string;
  nome: string;
  siglaPartido: string;
  uriPartido: string;
  siglaUf: string;
  idLegislatura: number;
  urlFoto: string;
  email: string;
}

export interface DeputyDetails extends Deputy {
  nomeCivil: string;
  cpf: string;
  sexo: string;
  dataNascimento: string;
  dataFalecimento: string | null;
  ufNascimento: string;
  municipioNascimento: string;
  escolaridade: string;
  ultimoStatus: {
    id: number;
    nome: string;
    siglaPartido: string;
    uriPartido: string;
    siglaUf: string;
    idLegislatura: number;
    urlFoto: string;
    email: string;
    data: string;
    nomeEleitoral: string;
    gabinete: {
      nome: string;
      predio: string;
      sala: string;
      andar: string;
      telefone: string;
      email: string;
    };
    situacao: string;
    condicaoEleitoral: string;
    descricaoStatus: string | null;
  };
}

export interface Expense {
  ano: number;
  mes: number;
  tipoDespesa: string;
  codDocumento: number;
  tipoDocumento: string;
  codTipoDocumento: number;
  dataDocumento: string;
  numDocumento: string;
  valorDocumento: number;
  urlDocumento: string;
  nomeFornecedor: string;
  cnpjCpfFornecedor: string;
  valorLiquido: number;
  valorGlosa: number;
  numRessarcimento: string;
  codLote: number;
  parcela: number;
}

export interface Votacao {
  id: string;
  uri: string;
  data: string;
  dataHoraRegistro: string;
  siglaOrgao: string;
  uriOrgao: string;
  proposicaoObjeto: string;
  uriProposicaoObjeto: string;
  descricao: string;
  aprovacao: number;
}

export interface Frente {
  id: number;
  uri: string;
  titulo: string;
  idLegislatura: number;
}

export interface Orgao {
  id: number;
  uri: string;
  sigla: string;
  nome: string;
  titulo: string;
  dataInicio: string;
  dataFim: string | null;
}

export interface FuelAnalysisResult {
  totalSpent: number;
  warnings: string[];
  suspiciousTransactions: Expense[];
}

/**
 * Busca um deputado pelo nome. Retorna o primeiro resultado encontrado.
 * Endpoint: GET /deputados
 */
export const findDeputyByName = async (name: string): Promise<Deputy | null> => {
  const cacheKey = `deputy_name_${name}`;
  const cached = getCached<Deputy>(cacheKey);
  if (cached) return cached;

  try {
    // Busca aproximada pelo nome
    const url = `${BASE_URL}/deputados?nome=${encodeURIComponent(name)}&ordem=ASC&ordenarPor=nome`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error('Falha ao buscar deputado');
    
    const data = await response.json();
    
    // A API retorna uma lista. Tentamos encontrar um match exato ou retornamos o primeiro
    if (data.dados && data.dados.length > 0) {
      setCache(cacheKey, data.dados[0]);
      return data.dados[0];
    }
    
    return null;
  } catch (error) {
    console.error("Erro na API da Câmara:", error);
    return null;
  }
};

/**
 * Busca detalhes completos de um deputado pelo ID
 * Endpoint: GET /deputados/{id}
 */
export const getDeputyDetails = async (id: number): Promise<DeputyDetails | null> => {
  const cacheKey = `deputy_details_${id}`;
  const cached = getCached<DeputyDetails>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/deputados/${id}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error('Falha ao buscar detalhes do deputado');
    
    const data = await response.json();
    if (data.dados) {
      setCache(cacheKey, data.dados);
      return data.dados;
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar detalhes do deputado:", error);
    return null;
  }
};

/**
 * Busca a URL da foto oficial do deputado pelo nome.
 * Retorna a URL da foto oficial do site da Câmara.
 */
export const getDeputyPhotoUrl = async (name: string): Promise<string | null> => {
  try {
    const deputy = await findDeputyByName(name);
    if (deputy && deputy.urlFoto) {
      return deputy.urlFoto;
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar foto do deputado:", error);
    return null;
  }
};

/**
 * Busca todos os deputados de um estado específico.
 */
export const getDeputiesByState = async (uf: string = 'PE'): Promise<Deputy[]> => {
  try {
    const url = `${BASE_URL}/deputados?siglaUf=${uf}&ordem=ASC&ordenarPor=nome&itens=100`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error('Falha ao buscar deputados');
    
    const data = await response.json();
    return data.dados || [];
  } catch (error) {
    console.error("Erro ao buscar deputados por estado:", error);
    return [];
  }
};

/**
 * Busca estatísticas de gabinete e assessores.
 * NOTA: A API V2 da Câmara não fornece um endpoint direto e simples para "contagem de assessores" 
 * que não envolva baixar arquivos grandes ou scraping.
 * Esta função simula uma resposta da API baseada nas regras de negócio da Câmara (Limite de 25 secretários, R$ 118k de verba).
 * Em um ambiente de produção real com backend, isso seria um crawler do portal da câmara.
 */
export const getDeputyStaff = async (id: number): Promise<AdvisorStats> => {
  // Simula um delay de rede
  await new Promise(resolve => setTimeout(resolve, 500));

  // Gera dados realistas baseados no ID para consistência (mas variando entre eles)
  const seed = id % 10;
  
  // Limite legal de Secretários Parlamentares: 25
  // Verba de Gabinete Aprox: R$ 118.376,13
  const MAX_ADVISORS = 25;
  const MAX_COST = 118376.13;

  // Variação simulada
  const currentAdvisors = Math.max(10, Math.min(MAX_ADVISORS, 20 + (seed % 6))); // Entre 20 e 25
  const efficiencyFactor = 0.85 + (seed * 0.02); // 0.85 a 1.05
  const currentCost = Math.min(MAX_COST, MAX_COST * efficiencyFactor);

  return {
    totalAdvisors: currentAdvisors,
    maxAdvisors: MAX_ADVISORS,
    monthlyCost: currentCost,
    maxMonthlyCost: MAX_COST
  };
};

/**
 * Busca as despesas (CEAP) de um deputado para um ano específico.
 */
export const getDeputyExpenses = async (id: number, year: number): Promise<Expense[]> => {
  try {
    // Aumentado para 500 itens para ter uma amostra melhor para análise de combustível
    const url = `${BASE_URL}/deputados/${id}/despesas?ano=${year}&itens=500&ordem=DESC&ordenarPor=valorLiquido`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error('Falha ao buscar despesas');
    
    const data = await response.json();
    return data.dados || [];
  } catch (error) {
    console.error("Erro ao buscar despesas:", error);
    return [];
  }
};

/**
 * Agrega despesas por tipo para exibição resumida
 */
export const aggregateExpensesByCategory = (expenses: Expense[]): SpendingRecord[] => {
  const map = new Map<string, number>();
  
  expenses.forEach(exp => {
    const current = map.get(exp.tipoDespesa) || 0;
    map.set(exp.tipoDespesa, current + exp.valorLiquido);
  });

  return Array.from(map.entries())
    .map(([category, amount]) => ({
      year: expenses[0]?.ano || new Date().getFullYear(),
      category,
      amount,
      description: 'Total acumulado na categoria',
      source: 'Dados Abertos Câmara'
    }))
    .sort((a, b) => b.amount - a.amount); // Ordena do maior para o menor
};

/**
 * Extrai os 10 maiores gastos individuais para detalhamento
 */
export const getTopIndividualExpenses = (expenses: Expense[]): SpendingRecord[] => {
  // Assume que expenses já vem ordenado por valorLiquido DESC da API, 
  // mas fazemos um sort de segurança.
  return expenses
    .sort((a, b) => b.valorLiquido - a.valorLiquido)
    .slice(0, 10)
    .map(exp => {
      // Formata a data
      const dateStr = exp.dataDocumento ? new Date(exp.dataDocumento).toLocaleDateString('pt-BR') : 'Data N/D';
      
      return {
        year: exp.ano,
        category: exp.tipoDespesa,
        amount: exp.valorLiquido,
        // Usamos a descrição para mostrar Fornecedor e Data
        description: `${exp.nomeFornecedor} (${dateStr})`,
        // Se houver URL do documento, passamos aqui, senão texto padrão
        source: exp.urlDocumento || 'Nota não disponível'
      };
    });
};

/**
 * Analisa despesas com combustível em busca de padrões incomuns
 */
export const analyzeFuelExpenses = (expenses: Expense[]): FuelAnalysisResult => {
  const warnings: string[] = [];
  const suspiciousTransactions: Expense[] = [];
  
  // Filtrar apenas combustíveis
  const fuelExpenses = expenses.filter(e => 
    e.tipoDespesa.toUpperCase().includes('COMBUSTÍVEIS') || 
    e.tipoDespesa.toUpperCase().includes('LUBRIFICANTES')
  );

  const totalSpent = fuelExpenses.reduce((acc, curr) => acc + curr.valorLiquido, 0);

  if (fuelExpenses.length === 0) {
    return { totalSpent, warnings, suspiciousTransactions };
  }

  // 1. Agrupar por dia para detectar múltiplos abastecimentos
  const expensesByDate: Record<string, Expense[]> = {};
  
  fuelExpenses.forEach(exp => {
    if (exp.dataDocumento) {
      if (!expensesByDate[exp.dataDocumento]) {
        expensesByDate[exp.dataDocumento] = [];
      }
      expensesByDate[exp.dataDocumento].push(exp);
    }

    // 2. Detectar valores muito altos para um único tanque (Ex: > R$ 600,00)
    // Considerando gasolina a ~R$6,00, R$600 seriam 100 litros, acima da maioria dos tanques de carros de passeio/SUV.
    if (exp.valorLiquido > 600) {
      warnings.push(`Abastecimento único de alto valor detectado: R$ ${exp.valorLiquido.toFixed(2)} em ${new Date(exp.dataDocumento).toLocaleDateString('pt-BR')}.`);
      suspiciousTransactions.push(exp);
    }
  });

  // Verificar dias com múltiplas notas
  Object.entries(expensesByDate).forEach(([date, dayExpenses]) => {
    if (dayExpenses.length > 1) {
       const totalDay = dayExpenses.reduce((acc, curr) => acc + curr.valorLiquido, 0);
       // Ignorar se forem valores muito pequenos somados (ex: cafezinho ou erro de categoria), mas combustível costuma ser alto.
       if (totalDay > 100) {
         warnings.push(`${dayExpenses.length} abastecimentos registrados no mesmo dia (${new Date(date).toLocaleDateString('pt-BR')}) totalizando R$ ${totalDay.toFixed(2)}.`);
         suspiciousTransactions.push(...dayExpenses);
       }
    }
  });

  // Remover duplicatas de transações suspeitas
  const uniqueSuspicious = Array.from(new Set(suspiciousTransactions));

  return {
    totalSpent,
    warnings: warnings.slice(0, 5), // Retornar apenas os top 5 avisos para não poluir a UI
    suspiciousTransactions: uniqueSuspicious
  };
};

/**
 * Busca votações de um deputado
 * Endpoint: GET /deputados/{id}/votacoes
 */
export const getDeputyVotacoes = async (id: number, ano?: number): Promise<Votacao[]> => {
  const cacheKey = `deputy_votacoes_${id}_${ano || 'all'}`;
  const cached = getCached<Votacao[]>(cacheKey);
  if (cached) return cached;

  try {
    let url = `${BASE_URL}/deputados/${id}/votacoes?itens=100&ordem=DESC&ordenarPor=dataHoraRegistro`;
    if (ano) {
      url += `&dataInicio=${ano}-01-01&dataFim=${ano}-12-31`;
    }
    
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    const votacoes = data.dados || [];
    setCache(cacheKey, votacoes);
    return votacoes;
  } catch (error) {
    console.error("Erro ao buscar votações:", error);
    return [];
  }
};

/**
 * Busca frentes parlamentares de um deputado
 * Endpoint: GET /deputados/{id}/frentes
 */
export const getDeputyFrentes = async (id: number): Promise<Frente[]> => {
  const cacheKey = `deputy_frentes_${id}`;
  const cached = getCached<Frente[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/deputados/${id}/frentes`;
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    const frentes = data.dados || [];
    setCache(cacheKey, frentes);
    return frentes;
  } catch (error) {
    console.error("Erro ao buscar frentes:", error);
    return [];
  }
};

/**
 * Busca órgãos (comissões) de um deputado
 * Endpoint: GET /deputados/{id}/orgaos
 */
export const getDeputyOrgaos = async (id: number): Promise<Orgao[]> => {
  const cacheKey = `deputy_orgaos_${id}`;
  const cached = getCached<Orgao[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/deputados/${id}/orgaos`;
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    const orgaos = data.dados || [];
    setCache(cacheKey, orgaos);
    return orgaos;
  } catch (error) {
    console.error("Erro ao buscar órgãos:", error);
    return [];
  }
};

/**
 * Busca todas as despesas de um deputado em múltiplos anos
 * Útil para análise histórica
 */
export const getDeputyExpensesMultiYear = async (
  id: number, 
  years: number[] = [2024, 2023, 2022, 2021]
): Promise<{ year: number; expenses: Expense[]; total: number }[]> => {
  const results = await Promise.all(
    years.map(async (year) => {
      const expenses = await getDeputyExpenses(id, year);
      const total = expenses.reduce((sum, exp) => sum + exp.valorLiquido, 0);
      return { year, expenses, total };
    })
  );
  
  return results.filter(r => r.expenses.length > 0);
};

/**
 * Calcula estatísticas gerais de um deputado
 */
export const getDeputyStats = async (id: number): Promise<{
  totalDespesas: number;
  despesasPorAno: { ano: number; total: number }[];
  categoriasTop: { categoria: string; total: number }[];
  votacoesCount: number;
  frentesCount: number;
  orgaosCount: number;
}> => {
  const [expensesData, votacoes, frentes, orgaos] = await Promise.all([
    getDeputyExpensesMultiYear(id),
    getDeputyVotacoes(id),
    getDeputyFrentes(id),
    getDeputyOrgaos(id),
  ]);

  // Total de despesas
  const totalDespesas = expensesData.reduce((sum, y) => sum + y.total, 0);
  
  // Despesas por ano
  const despesasPorAno = expensesData.map(({ year, total }) => ({ ano: year, total }));
  
  // Agregar por categoria
  const allExpenses = expensesData.flatMap(y => y.expenses);
  const categoryMap = new Map<string, number>();
  allExpenses.forEach(exp => {
    const current = categoryMap.get(exp.tipoDespesa) || 0;
    categoryMap.set(exp.tipoDespesa, current + exp.valorLiquido);
  });
  
  const categoriasTop = Array.from(categoryMap.entries())
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    totalDespesas,
    despesasPorAno,
    categoriasTop,
    votacoesCount: votacoes.length,
    frentesCount: frentes.length,
    orgaosCount: orgaos.length,
  };
};

// ============================================================================
// WEBSERVICES SOAP/XML (LEGADO)
// ============================================================================

/**
 * Interface para deputado retornado pelo webservice SOAP
 */
export interface DeputadoSOAP {
  ideCadastro: string;
  codOrcamento: string;
  condicao: string;
  matricula: string;
  idParlamentar: string;
  nome: string;
  nomeParlamentar: string;
  urlFoto: string;
  sexo: string;
  uf: string;
  partido: string;
  gabinete: string;
  anexo: string;
  fone: string;
  email: string;
  comissoes?: {
    titular: string[];
    suplente: string[];
  };
}

/**
 * Busca deputados via webservice SOAP (XML)
 * Endpoint: https://www.camara.leg.br/SitCamaraWS/Deputados.asmx/ObterDeputados
 * 
 * Este endpoint retorna TODOS os deputados em exercício de uma só vez.
 * Útil quando precisamos de dados que não estão na API REST.
 */
export const getDeputadosSOAP = async (): Promise<DeputadoSOAP[]> => {
  const cacheKey = 'soap_deputados_all';
  const cached = getCached<DeputadoSOAP[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${SOAP_URL}/ObterDeputados`);
    if (!response.ok) {
      console.warn('WebService SOAP da Câmara não acessível');
      return [];
    }

    const xmlText = await response.text();
    
    // Parse simples do XML (sem dependência externa)
    const deputados: DeputadoSOAP[] = [];
    const deputadoMatches = xmlText.match(/<deputado>([\s\S]*?)<\/deputado>/g) || [];
    
    deputadoMatches.forEach((deputadoXml: string) => {
      const getValue = (tag: string): string => {
        const match = deputadoXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
        return match ? match[1].trim() : '';
      };

      deputados.push({
        ideCadastro: getValue('ideCadastro'),
        codOrcamento: getValue('codOrcamento'),
        condicao: getValue('condicao'),
        matricula: getValue('matricula'),
        idParlamentar: getValue('idParlamentar'),
        nome: getValue('nome'),
        nomeParlamentar: getValue('nomeParlamentar'),
        urlFoto: getValue('urlFoto'),
        sexo: getValue('sexo'),
        uf: getValue('uf'),
        partido: getValue('partido'),
        gabinete: getValue('gabinete'),
        anexo: getValue('anexo'),
        fone: getValue('fone'),
        email: getValue('email'),
      });
    });

    if (deputados.length > 0) {
      setCache(cacheKey, deputados);
    }
    
    return deputados;
  } catch (error) {
    console.error('Erro ao acessar WebService SOAP:', error);
    return [];
  }
};

/**
 * Busca deputados de PE via webservice SOAP
 */
export const getDeputadosPESOAP = async (): Promise<DeputadoSOAP[]> => {
  const todos = await getDeputadosSOAP();
  return todos.filter(d => d.uf === 'PE');
};

/**
 * Busca líderes de bancadas via webservice SOAP
 * Endpoint: https://www.camara.leg.br/SitCamaraWS/Deputados.asmx/ObterLideresBancadas
 */
export const getLideresBancadas = async (): Promise<{ partido: string; lider: string; nome: string }[]> => {
  const cacheKey = 'soap_lideres_bancadas';
  const cached = getCached<{ partido: string; lider: string; nome: string }[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${SOAP_URL}/ObterLideresBancadas`);
    if (!response.ok) return [];

    const xmlText = await response.text();
    const lideres: { partido: string; lider: string; nome: string }[] = [];
    
    const bancadaMatches = xmlText.match(/<bancada>([\s\S]*?)<\/bancada>/g) || [];
    
    bancadaMatches.forEach((bancadaXml: string) => {
      const getValue = (tag: string): string => {
        const match = bancadaXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
        return match ? match[1].trim() : '';
      };

      const partido = getValue('sigla');
      const liderMatch = bancadaXml.match(/<lider>([\s\S]*?)<\/lider>/);
      if (liderMatch) {
        const nome = liderMatch[1].match(/<nome>([^<]*)<\/nome>/)?.[1] || '';
        const ideCadastro = liderMatch[1].match(/<ideCadastro>([^<]*)<\/ideCadastro>/)?.[1] || '';
        lideres.push({ partido, lider: ideCadastro, nome });
      }
    });

    if (lideres.length > 0) {
      setCache(cacheKey, lideres);
    }
    
    return lideres;
  } catch (error) {
    console.error('Erro ao buscar líderes de bancadas:', error);
    return [];
  }
};

// ============================================================================
// ARQUIVOS DE DADOS ABERTOS (CSV/XML)
// ============================================================================

/**
 * URLs para download de arquivos de dados abertos
 * Estes arquivos contêm dados históricos completos em formato CSV/XML
 */
export const DADOS_ABERTOS_ARQUIVOS = {
  // Despesas CEAP (Cota para Exercício da Atividade Parlamentar)
  despesasCEAP: {
    atual: 'https://www.camara.leg.br/cotas/Ano-2024.csv.zip',
    historico: (ano: number) => `https://www.camara.leg.br/cotas/Ano-${ano}.csv.zip`,
    descricao: 'Despesas de gabinete dos deputados por ano',
  },
  
  // Presença em plenário
  presenca: {
    url: 'https://dadosabertos.camara.leg.br/arquivos/presenca/csv/presenca.csv',
    descricao: 'Registro de presença dos deputados em sessões',
  },
  
  // Votações
  votacoes: {
    url: 'https://dadosabertos.camara.leg.br/arquivos/votacoes/csv/votacoes.csv',
    descricao: 'Histórico de votações em plenário',
  },
  
  // Deputados
  deputados: {
    atual: 'https://dadosabertos.camara.leg.br/arquivos/deputados/csv/deputados.csv',
    descricao: 'Lista completa de deputados (atual e histórico)',
  },
};

/**
 * URLs úteis para a Câmara dos Deputados
 */
export const CAMARA_URLS = {
  // API REST v2
  api: 'https://dadosabertos.camara.leg.br/api/v2',
  swagger: 'https://dadosabertos.camara.leg.br/swagger/api.html',
  
  // WebServices SOAP (Legado)
  soapDeputados: 'https://www.camara.leg.br/SitCamaraWS/Deputados.asmx',
  soapProposicoes: 'https://www.camara.leg.br/SitCamaraWS/Proposicoes.asmx',
  soapOrgaos: 'https://www.camara.leg.br/SitCamaraWS/Orgaos.asmx',
  soapSessoes: 'https://www.camara.leg.br/SitCamaraWS/SessoesReunioes.asmx',
  
  // Documentação WebServices
  docsWebservices: 'https://www2.camara.leg.br/transparencia/dados-abertos/dados-abertos-legislativo/webservices',
  docsDeputados: 'https://www2.camara.leg.br/transparencia/dados-abertos/dados-abertos-legislativo/webservices/deputados/deputados',
  
  // Portal
  portal: 'https://www.camara.leg.br',
  transparencia: 'https://www.camara.leg.br/transparencia',
  deputados: 'https://www.camara.leg.br/deputados/quem-sao',
  despesas: 'https://www.camara.leg.br/transparencia/gastos-parlamentares',
  presenca: 'https://www.camara.leg.br/transparencia/frequencia-e-votacoes',
  
  // Funções para URLs dinâmicas
  perfilDeputado: (id: number) => `https://www.camara.leg.br/deputados/${id}`,
  despesasDeputado: (id: number) => `https://www.camara.leg.br/deputados/${id}/despesas`,
  detalhesSOAP: (id: number) => `${SOAP_URL}/ObterDetalhesDeputado?ideCadastro=${id}&numLegislatura=`,
};

export default {
  // API REST v2
  findDeputyByName,
  getDeputyDetails,
  getDeputyPhotoUrl,
  getDeputiesByState,
  getDeputyStaff,
  getDeputyExpenses,
  getDeputyExpensesMultiYear,
  getDeputyVotacoes,
  getDeputyFrentes,
  getDeputyOrgaos,
  getDeputyStats,
  
  // WebServices SOAP
  getDeputadosSOAP,
  getDeputadosPESOAP,
  getLideresBancadas,
  
  // Utilidades
  aggregateExpensesByCategory,
  getTopIndividualExpenses,
  analyzeFuelExpenses,
  
  // URLs e Arquivos
  CAMARA_URLS,
  DADOS_ABERTOS_ARQUIVOS,
};