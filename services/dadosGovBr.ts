/**
 * Serviço de integração com a API do Portal de Dados Abertos do Governo Federal
 * https://dados.gov.br/swagger-ui/index.html
 */

const API_BASE_URL = 'https://dados.gov.br/api/publico/v2';

// API Key para autenticação
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4dnQ4S3lxUnNvRDlyQlZnY3dtS2ZaQzVqbXhZME5QTEdaWU9YeVIzOHpzT2ZpOXEzc3NrRW11RWNESzdqejgzWDkzRjNsa2lBWS1mVEpPUiIsImlhdCI6MTc2NzQwNjE0N30.NWiCSjbQ4GQ0d_C1nyNIs26NjXSP1BXCh8-bp8VzDk8';

// Headers padrão para as requisições
const getHeaders = () => ({
  'Accept': 'application/json',
  'chpigovbr-api-key': API_KEY,
});

// Tipos para as respostas da API
export interface Dataset {
  id: string;
  titulo: string;
  descricao: string;
  organizacao: {
    id: string;
    nome: string;
    sigla: string;
  };
  recursos: Resource[];
  tags: string[];
  temas: string[];
  atualizadoEm: string;
  criadoEm: string;
}

export interface Resource {
  id: string;
  titulo: string;
  descricao: string;
  formato: string;
  url: string;
  tamanho?: number;
}

export interface DatasetListResponse {
  dados: Dataset[];
  paginacao: {
    pagina: number;
    tamanho: number;
    totalPaginas: number;
    totalRegistros: number;
  };
}

export interface Organization {
  id: string;
  nome: string;
  sigla: string;
  descricao: string;
  urlSite?: string;
  totalConjuntosDados: number;
}

export interface OrganizationListResponse {
  dados: Organization[];
  paginacao: {
    pagina: number;
    tamanho: number;
    totalPaginas: number;
    totalRegistros: number;
  };
}

/**
 * Busca conjuntos de dados com filtros opcionais
 */
export async function listDatasets(params?: {
  pagina?: number;
  tamanho?: number;
  organizacao?: string;
  tema?: string;
  tag?: string;
  q?: string;
}): Promise<DatasetListResponse | null> {
  try {
    const queryParams = new URLSearchParams();
    
    if (params?.pagina) queryParams.append('pagina', params.pagina.toString());
    if (params?.tamanho) queryParams.append('tamanho', params.tamanho.toString());
    if (params?.organizacao) queryParams.append('organizacao', params.organizacao);
    if (params?.tema) queryParams.append('tema', params.tema);
    if (params?.tag) queryParams.append('tag', params.tag);
    if (params?.q) queryParams.append('q', params.q);
    
    const url = `${API_BASE_URL}/conjuntos-dados?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    if (!response.ok) {
      console.error(`Erro na API dados.gov.br: ${response.status} ${response.statusText}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar conjuntos de dados:', error);
    return null;
  }
}

/**
 * Busca um conjunto de dados específico pelo ID
 */
export async function getDatasetById(id: string): Promise<Dataset | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/conjuntos-dados/${id}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    if (!response.ok) {
      console.error(`Erro ao buscar dataset ${id}: ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar dataset por ID:', error);
    return null;
  }
}

/**
 * Lista organizações disponíveis
 */
export async function listOrganizations(params?: {
  pagina?: number;
  tamanho?: number;
  q?: string;
}): Promise<OrganizationListResponse | null> {
  try {
    const queryParams = new URLSearchParams();
    
    if (params?.pagina) queryParams.append('pagina', params.pagina.toString());
    if (params?.tamanho) queryParams.append('tamanho', params.tamanho.toString());
    if (params?.q) queryParams.append('q', params.q);
    
    const url = `${API_BASE_URL}/organizacoes?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    if (!response.ok) {
      console.error(`Erro na API dados.gov.br: ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erro ao listar organizações:', error);
    return null;
  }
}

/**
 * Busca conjuntos de dados relacionados a transparência e políticos de Pernambuco
 */
export async function searchTransparencyDatasets(): Promise<Dataset[]> {
  const searchTerms = [
    'transparencia pernambuco',
    'deputados pernambuco',
    'emendas parlamentares',
    'gastos publicos pernambuco',
    'assembleia legislativa pernambuco',
    'camara municipal recife'
  ];
  
  const allDatasets: Dataset[] = [];
  const seenIds = new Set<string>();
  
  for (const term of searchTerms) {
    const result = await listDatasets({ q: term, tamanho: 10 });
    if (result?.dados) {
      for (const dataset of result.dados) {
        if (!seenIds.has(dataset.id)) {
          seenIds.add(dataset.id);
          allDatasets.push(dataset);
        }
      }
    }
  }
  
  return allDatasets;
}

/**
 * Busca dados de um recurso específico (baixa CSV/JSON)
 */
export async function fetchResourceData(resourceUrl: string): Promise<any | null> {
  try {
    const response = await fetch(resourceUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/csv, */*',
      },
    });
    
    if (!response.ok) {
      console.error(`Erro ao baixar recurso: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      return await response.json();
    } else if (contentType?.includes('text/csv')) {
      const text = await response.text();
      return parseCSV(text);
    } else {
      return await response.text();
    }
  } catch (error) {
    console.error('Erro ao baixar recurso:', error);
    return null;
  }
}

/**
 * Parser simples de CSV
 */
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  const data: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    data.push(row);
  }
  
  return data;
}

/**
 * Busca datasets específicos de órgãos de transparência
 */
export async function getTransparencyOrganizations(): Promise<Organization[]> {
  const orgNames = [
    'Controladoria-Geral da União',
    'Câmara dos Deputados',
    'Senado Federal',
    'Tribunal Superior Eleitoral',
    'Tribunal de Contas da União'
  ];
  
  const orgs: Organization[] = [];
  
  for (const name of orgNames) {
    const result = await listOrganizations({ q: name, tamanho: 5 });
    if (result?.dados) {
      orgs.push(...result.dados);
    }
  }
  
  return orgs;
}

/**
 * Busca dados de servidores públicos federais
 */
export async function searchServidoresDatasets(): Promise<Dataset[]> {
  const result = await listDatasets({
    q: 'servidores publicos federais',
    tamanho: 20
  });
  
  return result?.dados || [];
}

/**
 * Busca dados de emendas parlamentares
 */
export async function searchEmendasDatasets(): Promise<Dataset[]> {
  const result = await listDatasets({
    q: 'emendas parlamentares',
    tamanho: 20
  });
  
  return result?.dados || [];
}

/**
 * Busca dados de licitações e contratos
 */
export async function searchLicitacoesDatasets(): Promise<Dataset[]> {
  const result = await listDatasets({
    q: 'licitacoes contratos',
    tamanho: 20
  });
  
  return result?.dados || [];
}

export default {
  listDatasets,
  getDatasetById,
  listOrganizations,
  searchTransparencyDatasets,
  fetchResourceData,
  getTransparencyOrganizations,
  searchServidoresDatasets,
  searchEmendasDatasets,
  searchLicitacoesDatasets,
};
