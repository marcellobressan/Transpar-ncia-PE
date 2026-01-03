/**
 * Agregador de Dados de Transparência
 * 
 * Este serviço combina dados de múltiplas APIs oficiais brasileiras para criar
 * um perfil completo de cada político. As fontes incluem:
 * - Câmara dos Deputados (despesas CEAP, gabinete)
 * - Senado Federal (despesas, votações, projetos)
 * - TSE (candidatos, partidos, contas de campanha)
 * - Portal da Transparência (emendas parlamentares, servidores)
 * - dados.gov.br (datasets de transparência)
 */

import { 
  Politician, 
  Sphere, 
  EfficiencyRating, 
  CandidacyStatus, 
  SpendingRecord, 
  AmendmentHistory, 
  AdvisorStats,
  RedFlag,
  CeapHistoryItem
} from '../types';

import * as camaraService from './camaraDeputados';
import * as senadoService from './senado';
import * as tseService from './tse';
import * as transparenciaService from './portalTransparencia';

// IndexedDB para cache persistente
const DB_NAME = 'transparencia_pe_cache';
const DB_VERSION = 1;
const STORE_NAME = 'politicians';

// Cache em memória
const memoryCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora em memória
const PERSISTENT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas em IndexedDB

// Intervalo de atualização automática
const UPDATE_INTERVAL = 6 * 60 * 60 * 1000; // 6 horas

// Status de disponibilidade das APIs
export interface ApiStatus {
  camara: boolean;
  senado: boolean;
  tse: boolean;
  portalTransparencia: boolean;
  lastCheck: Date;
}

let apiStatus: ApiStatus = {
  camara: true,
  senado: true,
  tse: true,
  portalTransparencia: false, // CORS bloqueado por padrão no frontend
  lastCheck: new Date()
};

// IDs conhecidos de políticos de Pernambuco
// Estes IDs são usados para buscar dados nas APIs oficiais
export const POLITICOS_PE_IDS = {
  // Deputados Federais (IDs da Câmara)
  'Túlio Gadêlha': { camaraId: 204534, sphere: Sphere.FEDERAL, cargo: 'Deputado Federal' },
  'Felipe Carreras': { camaraId: 204455, sphere: Sphere.FEDERAL, cargo: 'Deputado Federal' },
  'Sebastião Oliveira': { camaraId: 160602, sphere: Sphere.FEDERAL, cargo: 'Deputado Federal' },
  'Clarissa Tércio': { camaraId: 220564, sphere: Sphere.FEDERAL, cargo: 'Deputado Federal' },
  'André de Paula': { camaraId: 74120, sphere: Sphere.FEDERAL, cargo: 'Deputado Federal' },
  'Fernando Rodolfo': { camaraId: 204540, sphere: Sphere.FEDERAL, cargo: 'Deputado Federal' },
  'Eduardo da Fonte': { camaraId: 160523, sphere: Sphere.FEDERAL, cargo: 'Deputado Federal' },
  'Guilherme Uchoa': { camaraId: 230155, sphere: Sphere.FEDERAL, cargo: 'Deputado Federal' },
  'Mendonça Filho': { camaraId: 73621, sphere: Sphere.FEDERAL, cargo: 'Deputado Federal' },
  'Pedro Campos': { camaraId: 204565, sphere: Sphere.FEDERAL, cargo: 'Deputado Federal' },
  
  // Senadores (IDs do Senado)
  'Fernando Dueire': { senadoId: 6388, sphere: Sphere.FEDERAL, cargo: 'Senador' },
  'Humberto Costa': { senadoId: 4539, sphere: Sphere.FEDERAL, cargo: 'Senador' },
  'Teresa Leitão': { senadoId: 6231, sphere: Sphere.FEDERAL, cargo: 'Senador' },
  
  // Políticos Estaduais/Municipais de PE (dados manuais, pois não têm APIs federais)
  'João Campos': { 
    sphere: Sphere.MUNICIPAL, 
    cargo: 'Prefeito de Recife',
    partido: 'PSB',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Jo%C3%A3o_Campos_em_Dezembro_de_2020.jpg/200px-Jo%C3%A3o_Campos_em_Dezembro_de_2020.jpg'
  },
  'Raquel Lyra': { 
    sphere: Sphere.ESTADUAL, 
    cargo: 'Governadora de Pernambuco',
    partido: 'PSDB',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Raquel_Lyra_-_foto_oficial_%28cropped%29.jpg/200px-Raquel_Lyra_-_foto_oficial_%28cropped%29.jpg'
  },
};

// Lista de categorias de despesas suspeitas para monitoramento
const CATEGORIAS_SUSPEITAS = [
  'COMBUSTÍVEIS E LUBRIFICANTES',
  'PASSAGEM AÉREA',
  'LOCAÇÃO DE VEÍCULOS',
  'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR'
];

/**
 * Inicializa o banco de dados IndexedDB
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }
    };
  });
}

/**
 * Salva político no cache persistente
 */
async function saveToPersistentCache(politician: Politician): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        ...politician,
        lastUpdated: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    db.close();
  } catch (error) {
    console.error('Erro ao salvar no cache:', error);
  }
}

/**
 * Busca político do cache persistente
 */
async function getFromPersistentCache(id: string): Promise<Politician | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const result = request.result;
        db.close();
        
        if (result && Date.now() - result.lastUpdated < PERSISTENT_CACHE_TTL) {
          resolve(result as Politician);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Erro ao buscar do cache:', error);
    return null;
  }
}

/**
 * Busca todos os políticos do cache
 */
export async function getAllFromCache(): Promise<Politician[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        db.close();
        const now = Date.now();
        const valid = (request.result || [])
          .filter((p: any) => now - p.lastUpdated < PERSISTENT_CACHE_TTL);
        resolve(valid as Politician[]);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Erro ao buscar todos do cache:', error);
    return [];
  }
}

/**
 * Verifica disponibilidade das APIs
 */
export async function checkApisStatus(): Promise<ApiStatus> {
  const results = await Promise.allSettled([
    // Câmara - busca rápida
    fetch('https://dadosabertos.camara.leg.br/api/v2/deputados?itens=1', { method: 'HEAD' }),
    // Senado - busca rápida
    fetch('https://legis.senado.leg.br/dadosabertos/senador/lista/atual', { method: 'HEAD' }),
    // TSE - verificação rápida
    tseService.checkEleicao2026Disponivel(),
    // Portal da Transparência - geralmente bloqueado por CORS
    transparenciaService.checkApiAccess(),
  ]);
  
  apiStatus = {
    camara: results[0].status === 'fulfilled' && (results[0].value as Response).ok,
    senado: results[1].status === 'fulfilled' && (results[1].value as Response).ok,
    tse: results[2].status === 'fulfilled',
    portalTransparencia: results[3].status === 'fulfilled' && results[3].value === true,
    lastCheck: new Date()
  };
  
  console.log('Status das APIs:', apiStatus);
  return apiStatus;
}

/**
 * Calcula rating de eficiência baseado nos gastos
 */
function calculateEfficiencyRating(
  ceapTotal: number,
  ceapMax: number,
  advisorCost: number,
  advisorMaxCost: number
): EfficiencyRating {
  const ceapRatio = ceapTotal / ceapMax;
  const advisorRatio = advisorCost / advisorMaxCost;
  const avgRatio = (ceapRatio + advisorRatio) / 2;
  
  if (avgRatio <= 0.5) return EfficiencyRating.Excellent;
  if (avgRatio <= 0.7) return EfficiencyRating.Good;
  if (avgRatio <= 0.85) return EfficiencyRating.Average;
  if (avgRatio <= 0.95) return EfficiencyRating.BelowAverage;
  return EfficiencyRating.Poor;
}

/**
 * Gera alertas (red flags) baseados nos gastos
 */
function generateRedFlags(
  expenses: camaraService.Expense[],
  advisorStats: AdvisorStats
): RedFlag[] {
  const flags: RedFlag[] = [];
  
  // Análise de combustível
  const fuelAnalysis = camaraService.analyzeFuelExpenses(expenses);
  if (fuelAnalysis.warnings.length > 0) {
    flags.push({
      type: 'fuel',
      severity: fuelAnalysis.warnings.length > 2 ? 'high' : 'medium',
      description: `Padrões incomuns em combustível: ${fuelAnalysis.warnings[0]}`,
      details: fuelAnalysis.warnings.join('; '),
      source: 'Análise automatizada CEAP'
    });
  }
  
  // Verificar se está no limite de assessores
  if (advisorStats.totalAdvisors >= advisorStats.maxAdvisors) {
    flags.push({
      type: 'staffing',
      severity: 'low',
      description: 'Gabinete no limite máximo de assessores',
      details: `${advisorStats.totalAdvisors}/${advisorStats.maxAdvisors} assessores`,
      source: 'Dados Câmara dos Deputados'
    });
  }
  
  // Verificar gastos altos em categorias suspeitas
  const byCategory = camaraService.aggregateExpensesByCategory(expenses);
  byCategory
    .filter(s => CATEGORIAS_SUSPEITAS.some(cat => s.category.toUpperCase().includes(cat)))
    .filter(s => s.amount > 50000) // Mais de 50k na categoria
    .forEach(s => {
      flags.push({
        type: 'spending',
        severity: s.amount > 100000 ? 'high' : 'medium',
        description: `Gasto elevado: ${s.category}`,
        details: `Total de R$ ${s.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        source: 'CEAP - Câmara dos Deputados'
      });
    });
  
  return flags;
}

/**
 * Busca dados completos de um Deputado Federal
 */
export async function fetchDeputadoFederal(
  name: string, 
  camaraId: number
): Promise<Politician | null> {
  const cacheKey = `deputado_${camaraId}`;
  
  // Verifica cache em memória
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  // Verifica cache persistente
  const persistentCached = await getFromPersistentCache(cacheKey);
  if (persistentCached) {
    memoryCache.set(cacheKey, { data: persistentCached, timestamp: Date.now() });
    return persistentCached;
  }
  
  try {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    
    // Busca dados em paralelo para otimização
    const [
      deputy,
      currentExpenses,
      lastYearExpenses,
      advisorStats,
    ] = await Promise.all([
      camaraService.findDeputyByName(name),
      camaraService.getDeputyExpenses(camaraId, currentYear),
      camaraService.getDeputyExpenses(camaraId, lastYear),
      camaraService.getDeputyStaff(camaraId),
    ]);
    
    if (!deputy) {
      console.warn(`Deputado não encontrado: ${name}`);
      return null;
    }
    
    // Combina despesas dos dois anos
    const allExpenses = [...currentExpenses, ...lastYearExpenses];
    
    // Agrega por categoria
    const aggregatedExpenses = camaraService.aggregateExpensesByCategory(allExpenses);
    
    // Gera histórico de CEAP (últimos 12 meses)
    const ceapHistory: { month: string; amount: number }[] = [];
    const expensesByMonth: Record<string, number> = {};
    
    allExpenses.forEach(exp => {
      const key = `${String(exp.mes).padStart(2, '0')}/${exp.ano}`;
      expensesByMonth[key] = (expensesByMonth[key] || 0) + exp.valorLiquido;
    });
    
    Object.entries(expensesByMonth)
      .sort((a, b) => {
        const [mesA, anoA] = a[0].split('/').map(Number);
        const [mesB, anoB] = b[0].split('/').map(Number);
        return anoA !== anoB ? anoA - anoB : mesA - mesB;
      })
      .slice(-12) // últimos 12 meses
      .forEach(([month, amount]) => {
        ceapHistory.push({ month, amount });
      });
    
    // Calcula totais
    const ceapTotal = ceapHistory.reduce((sum, h) => sum + h.amount, 0);
    const ceapMax = 12 * 45000; // Aproximadamente R$ 45k/mês de limite CEAP
    
    // Gera red flags
    const redFlags = generateRedFlags(allExpenses, advisorStats);
    
    // Calcula eficiência
    const efficiency = calculateEfficiencyRating(
      ceapTotal / 12, // média mensal
      45000, // limite mensal aproximado
      advisorStats.monthlyCost,
      advisorStats.maxMonthlyCost
    );
    
    // Top gastos
    const topExpenses = camaraService.getTopIndividualExpenses(allExpenses);
    
    const politician: Politician = {
      id: cacheKey,
      name: deputy.nome,
      party: deputy.siglaPartido,
      sphere: Sphere.FEDERAL,
      position: 'Deputado Federal',
      state: deputy.siglaUf,
      photoUrl: deputy.urlFoto || tseService.getCamaraPhotoUrl(camaraId),
      salaryHistory: [], // Não disponível diretamente na API da Câmara
      ceapHistory,
      ceapTotal,
      ceapLimit: ceapMax,
      amendments: [], // Requer Portal da Transparência
      totalAmendments: 0,
      advisorStats,
      efficiencyRating: efficiency,
      redFlags,
      keyFindings: topExpenses.slice(0, 3).map(e => 
        `${e.category}: R$ ${e.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - ${e.description}`
      ),
      candidacyStatus: CandidacyStatus.Aguardando,
      dataAvailability: {
        salary: false,
        ceap: true,
        amendments: apiStatus.portalTransparencia,
        staff: true,
        tse: apiStatus.tse
      },
      lastUpdated: new Date().toISOString(),
      sources: [
        { name: 'Câmara dos Deputados', url: `https://www.camara.leg.br/deputados/${camaraId}`, lastFetch: new Date().toISOString() }
      ]
    };
    
    // Salva nos caches
    memoryCache.set(cacheKey, { data: politician, timestamp: Date.now() });
    await saveToPersistentCache(politician);
    
    return politician;
  } catch (error) {
    console.error(`Erro ao buscar deputado ${name}:`, error);
    return null;
  }
}

/**
 * Busca dados completos de um Senador
 */
export async function fetchSenador(
  name: string,
  senadoId: number
): Promise<Politician | null> {
  const cacheKey = `senador_${senadoId}`;
  
  // Verifica caches
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const persistentCached = await getFromPersistentCache(cacheKey);
  if (persistentCached) {
    memoryCache.set(cacheKey, { data: persistentCached, timestamp: Date.now() });
    return persistentCached;
  }
  
  try {
    const currentYear = new Date().getFullYear();
    
    // Busca dados em paralelo
    const [
      senador,
      despesas,
      historicoDespesas,
    ] = await Promise.all([
      senadoService.getSenadorById(senadoId),
      senadoService.getDespesasSenador(senadoId, currentYear),
      senadoService.getHistoricoDespesasMensal(senadoId, [currentYear, currentYear - 1]),
    ]);
    
    if (!senador) {
      console.warn(`Senador não encontrado: ${name}`);
      return null;
    }
    
    // Converte histórico para formato CEAP
    const ceapHistory = historicoDespesas.map(h => ({
      month: h.mes,
      amount: h.valor
    }));
    
    const ceapTotal = ceapHistory.reduce((sum, h) => sum + h.amount, 0);
    const ceapMax = 12 * 50000; // Aproximadamente R$ 50k/mês para senadores
    
    // Senadores não têm o mesmo conceito de "assessores" da Câmara
    const advisorStats: AdvisorStats = {
      totalAdvisors: 0, // Dados não disponíveis na API pública
      maxAdvisors: 0,
      monthlyCost: 0,
      maxMonthlyCost: 0
    };
    
    const efficiency = calculateEfficiencyRating(
      ceapTotal / Math.max(ceapHistory.length, 1),
      50000,
      0,
      1 // Evita divisão por zero
    );
    
    const politician: Politician = {
      id: cacheKey,
      name: senador.nomeCompleto || senador.nome,
      party: senador.partido,
      sphere: Sphere.FEDERAL,
      position: 'Senador',
      state: senador.uf,
      photoUrl: senador.fotoUrl || senadoService.getSenadorPhotoUrl(senadoId),
      salaryHistory: [],
      ceapHistory,
      ceapTotal,
      ceapLimit: ceapMax,
      amendments: [],
      totalAmendments: 0,
      advisorStats,
      efficiencyRating: efficiency,
      redFlags: [],
      keyFindings: despesas.slice(0, 3).map(d => 
        `${d.tipo}: R$ ${d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - ${d.fornecedor}`
      ),
      candidacyStatus: CandidacyStatus.Aguardando,
      dataAvailability: {
        salary: false,
        ceap: true,
        amendments: apiStatus.portalTransparencia,
        staff: false,
        tse: apiStatus.tse
      },
      lastUpdated: new Date().toISOString(),
      sources: [
        { name: 'Senado Federal', url: `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${senadoId}`, lastFetch: new Date().toISOString() }
      ]
    };
    
    memoryCache.set(cacheKey, { data: politician, timestamp: Date.now() });
    await saveToPersistentCache(politician);
    
    return politician;
  } catch (error) {
    console.error(`Erro ao buscar senador ${name}:`, error);
    return null;
  }
}

/**
 * Cria político estadual/municipal com dados manuais
 * (Não há API federal para esses cargos)
 */
export function createLocalPolitician(
  id: string,
  name: string,
  config: {
    sphere: Sphere;
    cargo: string;
    partido: string;
    photoUrl: string;
  }
): Politician {
  return {
    id,
    name,
    party: config.partido,
    sphere: config.sphere,
    position: config.cargo,
    state: 'PE',
    photoUrl: config.photoUrl,
    salaryHistory: [],
    ceapHistory: [],
    ceapTotal: 0,
    ceapLimit: 0,
    amendments: [],
    totalAmendments: 0,
    advisorStats: {
      totalAdvisors: 0,
      maxAdvisors: 0,
      monthlyCost: 0,
      maxMonthlyCost: 0
    },
    efficiencyRating: EfficiencyRating.Average,
    redFlags: [],
    keyFindings: [
      'Dados de transparência estaduais/municipais não integrados',
      'Consulte o Portal da Transparência de PE para mais informações'
    ],
    candidacyStatus: CandidacyStatus.Aguardando,
    dataAvailability: {
      salary: false,
      ceap: false,
      amendments: false,
      staff: false,
      tse: apiStatus.tse
    },
    lastUpdated: new Date().toISOString(),
    sources: [
      { 
        name: 'Portal Transparência PE', 
        url: 'https://www.transparencia.pe.gov.br/', 
        lastFetch: new Date().toISOString() 
      }
    ]
  };
}

/**
 * Busca todos os políticos de Pernambuco
 * Combina dados de todas as APIs disponíveis
 */
export async function fetchAllPoliticiansPE(): Promise<Politician[]> {
  console.log('Iniciando busca de políticos de PE...');
  
  // Verifica status das APIs primeiro
  await checkApisStatus();
  
  const politicians: Politician[] = [];
  const errors: string[] = [];
  
  // Processa cada político conhecido
  for (const [name, config] of Object.entries(POLITICOS_PE_IDS)) {
    try {
      let politician: Politician | null = null;
      
      if ('camaraId' in config) {
        // É deputado federal
        politician = await fetchDeputadoFederal(name, config.camaraId);
      } else if ('senadoId' in config) {
        // É senador
        politician = await fetchSenador(name, config.senadoId);
      } else if ('partido' in config && 'photoUrl' in config) {
        // É político local (estadual/municipal)
        politician = createLocalPolitician(
          `local_${name.toLowerCase().replace(/\s/g, '_')}`,
          name,
          config as { sphere: Sphere; cargo: string; partido: string; photoUrl: string }
        );
      }
      
      if (politician) {
        politicians.push(politician);
      }
    } catch (error) {
      console.error(`Erro ao processar ${name}:`, error);
      errors.push(name);
    }
  }
  
  if (errors.length > 0) {
    console.warn(`Falha ao buscar dados de: ${errors.join(', ')}`);
  }
  
  console.log(`Carregados ${politicians.length} políticos de PE`);
  return politicians;
}

/**
 * Busca deputados de PE diretamente da API da Câmara
 */
export async function fetchDeputadosPE(): Promise<Politician[]> {
  try {
    const deputies = await camaraService.getDeputiesByState('PE');
    const politicians: Politician[] = [];
    
    // Limita a 10 para evitar muitas requisições
    for (const deputy of deputies.slice(0, 10)) {
      const politician = await fetchDeputadoFederal(deputy.nome, deputy.id);
      if (politician) {
        politicians.push(politician);
      }
    }
    
    return politicians;
  } catch (error) {
    console.error('Erro ao buscar deputados de PE:', error);
    return [];
  }
}

/**
 * Busca senadores de PE
 */
export async function fetchSenadoresPE(): Promise<Politician[]> {
  try {
    const senadores = await senadoService.getSenadoresPorUF('PE');
    const politicians: Politician[] = [];
    
    for (const senador of senadores) {
      const politician = await fetchSenador(senador.nome, senador.codigo);
      if (politician) {
        politicians.push(politician);
      }
    }
    
    return politicians;
  } catch (error) {
    console.error('Erro ao buscar senadores de PE:', error);
    return [];
  }
}

/**
 * Atualiza um político específico
 */
export async function refreshPolitician(id: string): Promise<Politician | null> {
  // Remove do cache para forçar nova busca
  memoryCache.delete(id);
  
  // Encontra configuração do político
  const entry = Object.entries(POLITICOS_PE_IDS).find(([name, config]) => {
    if ('camaraId' in config) return `deputado_${config.camaraId}` === id;
    if ('senadoId' in config) return `senador_${config.senadoId}` === id;
    return id.includes(name.toLowerCase().replace(/\s/g, '_'));
  });
  
  if (!entry) return null;
  
  const [name, config] = entry;
  
  if ('camaraId' in config) {
    return fetchDeputadoFederal(name, config.camaraId);
  } else if ('senadoId' in config) {
    return fetchSenador(name, config.senadoId);
  }
  
  return null;
}

/**
 * Hook para configurar atualização automática
 */
export function setupAutoRefresh(onUpdate: (politicians: Politician[]) => void): () => void {
  let intervalId: NodeJS.Timeout | null = null;
  
  const refresh = async () => {
    console.log('Executando atualização automática...');
    const politicians = await fetchAllPoliticiansPE();
    onUpdate(politicians);
  };
  
  // Configura intervalo
  intervalId = setInterval(refresh, UPDATE_INTERVAL);
  
  // Retorna função de cleanup
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

export default {
  fetchAllPoliticiansPE,
  fetchDeputadosPE,
  fetchSenadoresPE,
  fetchDeputadoFederal,
  fetchSenador,
  refreshPolitician,
  checkApisStatus,
  setupAutoRefresh,
  getAllFromCache,
  POLITICOS_PE_IDS,
};
