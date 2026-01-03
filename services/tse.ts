/**
 * Serviço de integração com a API do TSE (Tribunal Superior Eleitoral)
 * Fonte de dados de candidatos, partidos, contas eleitorais e situação de candidatura
 * 
 * APIs utilizadas:
 * - https://divulgacandcontas.tse.jus.br/
 * - https://resultados.tse.jus.br/
 */

// URLs das APIs do TSE
const TSE_API_BASE = 'https://divulgacandcontas.tse.jus.br/divulga/rest/v1';
const TSE_RESULTADOS_BASE = 'https://resultados.tse.jus.br/oficial';

// Código do estado de Pernambuco no TSE
const CODIGO_PE = '17';

// Anos de eleição disponíveis
const ELEICOES_DISPONIVEIS = {
  MUNICIPAIS_2024: { ano: '2024', tipo: 'ordinaria' },
  GERAIS_2022: { ano: '2022', tipo: 'ordinaria' },
  MUNICIPAIS_2020: { ano: '2020', tipo: 'ordinaria' },
  GERAIS_2026: { ano: '2026', tipo: 'ordinaria' }, // Futura - pode não estar disponível
};

// Interfaces para os dados do TSE
export interface PartidoTSE {
  numero: number;
  sigla: string;
  nome: string;
  urlLogo?: string;
}

export interface CandidatoTSE {
  id: string;
  nome: string;
  nomeUrna: string;
  numero: string;
  partido: PartidoTSE;
  cargo: string;
  codigoCargo: number;
  descricaoSituacao: string;
  fotoUrl?: string;
  emails?: string[];
  sites?: string[];
  totalBens?: number;
  despesasCampanha?: number;
  receitasCampanha?: number;
  situacaoContas?: string;
  ocupacao?: string;
  grauInstrucao?: string;
  estadoCivil?: string;
}

export interface ContaCandidatoTSE {
  candidatoId: string;
  totalReceitas: number;
  totalDespesas: number;
  situacao: string;
  ressalvas?: string[];
}

export interface PartidoRegistrado {
  sigla: string;
  nome: string;
  numero: number;
  deferimento: string;
  presidenteNacional?: string;
  dataFundacao?: string;
  numeroFiliados?: number;
}

// Cache local para evitar requisições repetidas
const cache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

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

/**
 * Busca lista de partidos registrados no TSE
 */
export async function getPartidosRegistrados(): Promise<PartidoRegistrado[]> {
  const cacheKey = 'partidos_registrados';
  const cached = getCached<PartidoRegistrado[]>(cacheKey);
  if (cached) return cached;

  try {
    // A API do TSE para partidos registrados
    const response = await fetch('https://www.tse.jus.br/partidos/partidos-registrados-no-tse/registrados-no-tse');
    
    if (!response.ok) {
      console.warn('TSE: Não foi possível obter partidos registrados da página oficial');
      return getPartidosFallback();
    }

    // Como a página retorna HTML, usamos dados estáticos conhecidos
    // Em produção, fazer web scraping ou usar API específica quando disponível
    const partidos = getPartidosFallback();
    setCache(cacheKey, partidos);
    return partidos;
  } catch (error) {
    console.error('Erro ao buscar partidos TSE:', error);
    return getPartidosFallback();
  }
}

/**
 * Lista de partidos conhecidos (fallback quando API não disponível)
 * Atualizado conforme registros do TSE em 2024
 */
function getPartidosFallback(): PartidoRegistrado[] {
  return [
    { sigla: 'MDB', nome: 'Movimento Democrático Brasileiro', numero: 15, deferimento: 'Deferido' },
    { sigla: 'PT', nome: 'Partido dos Trabalhadores', numero: 13, deferimento: 'Deferido' },
    { sigla: 'PSDB', nome: 'Partido da Social Democracia Brasileira', numero: 45, deferimento: 'Deferido' },
    { sigla: 'PP', nome: 'Progressistas', numero: 11, deferimento: 'Deferido' },
    { sigla: 'PDT', nome: 'Partido Democrático Trabalhista', numero: 12, deferimento: 'Deferido' },
    { sigla: 'UNIÃO', nome: 'União Brasil', numero: 44, deferimento: 'Deferido' },
    { sigla: 'PL', nome: 'Partido Liberal', numero: 22, deferimento: 'Deferido' },
    { sigla: 'PSB', nome: 'Partido Socialista Brasileiro', numero: 40, deferimento: 'Deferido' },
    { sigla: 'REPUBLICANOS', nome: 'Republicanos', numero: 10, deferimento: 'Deferido' },
    { sigla: 'PODEMOS', nome: 'Podemos', numero: 20, deferimento: 'Deferido' },
    { sigla: 'PSD', nome: 'Partido Social Democrático', numero: 55, deferimento: 'Deferido' },
    { sigla: 'REDE', nome: 'Rede Sustentabilidade', numero: 18, deferimento: 'Deferido' },
    { sigla: 'PSOL', nome: 'Partido Socialismo e Liberdade', numero: 50, deferimento: 'Deferido' },
    { sigla: 'CIDADANIA', nome: 'Cidadania', numero: 23, deferimento: 'Deferido' },
    { sigla: 'PV', nome: 'Partido Verde', numero: 43, deferimento: 'Deferido' },
    { sigla: 'AVANTE', nome: 'Avante', numero: 70, deferimento: 'Deferido' },
    { sigla: 'SOLIDARIEDADE', nome: 'Solidariedade', numero: 77, deferimento: 'Deferido' },
    { sigla: 'NOVO', nome: 'Partido Novo', numero: 30, deferimento: 'Deferido' },
    { sigla: 'PCdoB', nome: 'Partido Comunista do Brasil', numero: 65, deferimento: 'Deferido' },
    { sigla: 'AGIR', nome: 'Agir', numero: 36, deferimento: 'Deferido' },
    { sigla: 'PRD', nome: 'Partido Renovação Democrática', numero: 25, deferimento: 'Deferido' },
    { sigla: 'PMB', nome: 'Partido da Mulher Brasileira', numero: 35, deferimento: 'Deferido' },
    { sigla: 'DC', nome: 'Democracia Cristã', numero: 27, deferimento: 'Deferido' },
    { sigla: 'PCB', nome: 'Partido Comunista Brasileiro', numero: 21, deferimento: 'Deferido' },
    { sigla: 'PSTU', nome: 'Partido Socialista dos Trabalhadores Unificado', numero: 16, deferimento: 'Deferido' },
    { sigla: 'PCO', nome: 'Partido da Causa Operária', numero: 29, deferimento: 'Deferido' },
    { sigla: 'UP', nome: 'Unidade Popular', numero: 80, deferimento: 'Deferido' },
  ];
}

/**
 * URLs dos logos dos partidos (Wikipedia/Oficial)
 */
export function getPartyLogoUrl(sigla: string): string {
  const logos: Record<string, string> = {
    'PT': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Partido_dos_Trabalhadores_Emblema.svg/200px-Partido_dos_Trabalhadores_Emblema.svg.png',
    'PL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Logo_do_Partido_Liberal_%282006%29.svg/200px-Logo_do_Partido_Liberal_%282006%29.svg.png',
    'PSB': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Logo_PSB.png/200px-Logo_PSB.png',
    'PSDB': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/PSDB_logo.svg/200px-PSDB_logo.svg.png',
    'REDE': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Rede_Sustentabilidade_logo.svg/200px-Rede_Sustentabilidade_logo.svg.png',
    'MDB': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/MDB_logo_%28Brazil%29.svg/200px-MDB_logo_%28Brazil%29.svg.png',
    'UNIÃO': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Logo_Uni%C3%A3o_Brasil.svg/200px-Logo_Uni%C3%A3o_Brasil.svg.png',
    'PP': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Progressistas_logo.svg/200px-Progressistas_logo.svg.png',
    'PDT': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/PDT_logo.png/200px-PDT_logo.png',
    'PSD': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/PSD_Brazil_logo_2023.svg/200px-PSD_Brazil_logo_2023.svg.png',
    'REPUBLICANOS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Republicanos_logo.svg/200px-Republicanos_logo.svg.png',
    'PODEMOS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Logo_Podemos_Brasil_2023.svg/200px-Logo_Podemos_Brasil_2023.svg.png',
    'PSOL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/PSOL_logo.svg/200px-PSOL_logo.svg.png',
    'CIDADANIA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/CIDADANIA23_logo.svg/200px-CIDADANIA23_logo.svg.png',
    'PV': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Pv-brasil.svg/200px-Pv-brasil.svg.png',
    'NOVO': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Logotipo_do_partido_NOVO.svg/200px-Logotipo_do_partido_NOVO.svg.png',
    'PCdoB': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/PCdoB_Logo_%282022%29.svg/200px-PCdoB_Logo_%282022%29.svg.png',
    'AVANTE': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Logo_Avante.svg/200px-Logo_Avante.svg.png',
    'SOLIDARIEDADE': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Solidariedade_logo_2021.svg/200px-Solidariedade_logo_2021.svg.png',
  };
  
  return logos[sigla.toUpperCase()] || `https://ui-avatars.com/api/?name=${encodeURIComponent(sigla)}&background=6366f1&color=fff&size=200`;
}

/**
 * Busca candidatos de Pernambuco para um ano de eleição específico
 */
export async function getCandidatosPE(ano: string = '2024', cargo?: string): Promise<CandidatoTSE[]> {
  const cacheKey = `candidatos_pe_${ano}_${cargo || 'todos'}`;
  const cached = getCached<CandidatoTSE[]>(cacheKey);
  if (cached) return cached;

  try {
    // Tenta a API oficial do TSE
    const url = `${TSE_API_BASE}/eleicao/buscar/${ano}/${CODIGO_PE}/candidatos`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.warn(`TSE: Dados de ${ano} não disponíveis ainda (${response.status})`);
      return [];
    }

    const data = await response.json();
    const candidatos: CandidatoTSE[] = (data.candidatos || []).map((c: any) => ({
      id: c.id || c.sequencial,
      nome: c.nomeCompleto || c.nome,
      nomeUrna: c.nomeUrna,
      numero: c.numero,
      partido: {
        numero: c.partido?.numero,
        sigla: c.partido?.sigla,
        nome: c.partido?.nome
      },
      cargo: c.cargo?.nome || c.descricaoCargo,
      codigoCargo: c.cargo?.codigo || c.codigoCargo,
      descricaoSituacao: c.descricaoSituacao,
      fotoUrl: c.fotoUrl,
      totalBens: c.totalDeBens,
    }));

    // Filtrar por cargo se especificado
    const filtered = cargo 
      ? candidatos.filter(c => c.cargo.toLowerCase().includes(cargo.toLowerCase()))
      : candidatos;

    setCache(cacheKey, filtered);
    return filtered;
  } catch (error) {
    console.error('Erro ao buscar candidatos TSE:', error);
    return [];
  }
}

/**
 * Busca informações de contas de campanha de um candidato
 */
export async function getContasCampanha(candidatoId: string, ano: string = '2024'): Promise<ContaCandidatoTSE | null> {
  const cacheKey = `contas_${candidatoId}_${ano}`;
  const cached = getCached<ContaCandidatoTSE>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${TSE_API_BASE}/prestador/consulta/2/${ano}/${CODIGO_PE}/${candidatoId}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.warn(`TSE: Contas de campanha não disponíveis para candidato ${candidatoId}`);
      return null;
    }

    const data = await response.json();
    const contas: ContaCandidatoTSE = {
      candidatoId,
      totalReceitas: data.totalReceitasDeclaradas || 0,
      totalDespesas: data.totalDespesasDeclaradas || 0,
      situacao: data.situacaoPrestacao || 'Não informado',
      ressalvas: data.ressalvas || []
    };

    setCache(cacheKey, contas);
    return contas;
  } catch (error) {
    console.error('Erro ao buscar contas de campanha:', error);
    return null;
  }
}

/**
 * Verifica se eleição de 2026 já tem dados disponíveis
 */
export async function checkEleicao2026Disponivel(): Promise<{ disponivel: boolean; mensagem: string }> {
  try {
    const response = await fetch(`${TSE_API_BASE}/eleicao/buscar/2026/${CODIGO_PE}/candidatos`, {
      method: 'HEAD'
    });

    if (response.ok) {
      return { disponivel: true, mensagem: 'Dados das eleições de 2026 estão disponíveis!' };
    }
    
    return { 
      disponivel: false, 
      mensagem: 'Dados das eleições de 2026 ainda não foram publicados pelo TSE. Sistema monitorando automaticamente.'
    };
  } catch {
    return { 
      disponivel: false, 
      mensagem: 'Não foi possível verificar disponibilidade. Tentando novamente em breve.'
    };
  }
}

/**
 * Busca foto oficial de um deputado/político na Câmara
 */
export function getCamaraPhotoUrl(deputadoId: number | string): string {
  return `https://www.camara.leg.br/internet/deputado/bandep/${deputadoId}.jpg`;
}

/**
 * Gera URL de avatar fallback com iniciais
 */
export function getAvatarFallback(nome: string, backgroundColor: string = '6366f1'): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=${backgroundColor}&color=fff&size=200`;
}

export default {
  getPartidosRegistrados,
  getPartyLogoUrl,
  getCandidatosPE,
  getContasCampanha,
  checkEleicao2026Disponivel,
  getCamaraPhotoUrl,
  getAvatarFallback,
};
