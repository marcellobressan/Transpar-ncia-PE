/**
 * Serviço de busca de notícias
 * Usa a API de busca do Google Custom Search para encontrar notícias relevantes
 */

export const GOOGLE_API_KEY = 'AIzaSyANdicbf8a-5qEgZnIn50aGp6CoYTUkIIw';
// Search Engine ID para buscas web gerais (criado no Google Custom Search)
// Para produção, criar um CSE específico em: https://programmablesearchengine.google.com/
const GOOGLE_CSE_ID = '017576662512468239146:omuauf_gy2o'; // CSE público de exemplo

export interface NewsResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  date?: string;
  thumbnail?: string;
}

export interface NewsSearchResponse {
  results: NewsResult[];
  totalResults: number;
  searchQuery: string;
  error?: string;
}

/**
 * Busca notícias no Google usando Custom Search API
 */
export const searchNews = async (
  query: string,
  options?: {
    dateRestrict?: string; // Ex: 'd7' (7 dias), 'm1' (1 mês), 'y1' (1 ano)
    numResults?: number;
    siteSearch?: string; // Restringir a um site específico
  }
): Promise<NewsSearchResponse> => {
  try {
    const params = new URLSearchParams({
      key: GOOGLE_API_KEY,
      cx: GOOGLE_CSE_ID,
      q: query,
      num: (options?.numResults || 5).toString(),
      lr: 'lang_pt', // Resultados em português
      gl: 'br', // Localização Brasil
      sort: 'date', // Ordenar por data
    });

    if (options?.dateRestrict) {
      params.append('dateRestrict', options.dateRestrict);
    }
    if (options?.siteSearch) {
      params.append('siteSearch', options.siteSearch);
    }

    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
    
    if (!response.ok) {
      if (response.status === 403) {
        return {
          results: [],
          totalResults: 0,
          searchQuery: query,
          error: 'API indisponível. Use os links de busca alternativos.'
        };
      }
      throw new Error(`Erro na busca: ${response.status}`);
    }

    const data = await response.json();
    
    const results: NewsResult[] = (data.items || []).map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      source: item.displayLink || new URL(item.link).hostname,
      date: item.pagemap?.metatags?.[0]?.['article:published_time'] || 
            item.pagemap?.metatags?.[0]?.['og:updated_time'] ||
            undefined,
      thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src || 
                 item.pagemap?.cse_image?.[0]?.src ||
                 undefined,
    }));

    return {
      results,
      totalResults: parseInt(data.searchInformation?.totalResults || '0'),
      searchQuery: query,
    };
  } catch (error) {
    console.error('Erro ao buscar notícias:', error);
    return {
      results: [],
      totalResults: 0,
      searchQuery: query,
      error: 'Não foi possível buscar notícias. Tente novamente.'
    };
  }
};

/**
 * Gera URLs de busca em portais de notícias conhecidos
 */
export const getNewsSearchUrls = (query: string): { name: string; url: string; icon: string }[] => {
  const encodedQuery = encodeURIComponent(query);
  
  return [
    {
      name: 'Google News',
      url: `https://news.google.com/search?q=${encodedQuery}&hl=pt-BR&gl=BR&ceid=BR:pt-419`,
      icon: '📰'
    },
    {
      name: 'G1',
      url: `https://g1.globo.com/busca/?q=${encodedQuery}`,
      icon: '🔴'
    },
    {
      name: 'Folha',
      url: `https://search.folha.uol.com.br/?q=${encodedQuery}&site=todos`,
      icon: '📄'
    },
    {
      name: 'UOL',
      url: `https://busca.uol.com.br/?q=${encodedQuery}`,
      icon: '🟡'
    },
    {
      name: 'Estadão',
      url: `https://busca.estadao.com.br/?q=${encodedQuery}`,
      icon: '📊'
    },
    {
      name: 'JC Online',
      url: `https://jc.ne10.uol.com.br/busca?q=${encodedQuery}`,
      icon: '🔵'
    },
    {
      name: 'Diário de PE',
      url: `https://www.diariodepernambuco.com.br/busca/?q=${encodedQuery}`,
      icon: '📋'
    },
    {
      name: 'Blog de Jamildo',
      url: `https://blogs.ne10.uol.com.br/jamildo/?s=${encodedQuery}`,
      icon: '✍️'
    },
  ];
};

/**
 * Gera URLs de busca em portais oficiais de transparência
 */
export const getOfficialSearchUrls = (politicianName: string): { name: string; url: string; icon: string }[] => {
  const encodedName = encodeURIComponent(politicianName);
  
  return [
    {
      name: 'TCU - Contas Julgadas',
      url: `https://portal.tcu.gov.br/contas/contas-julgadas-pelo-tcu/`,
      icon: '⚖️'
    },
    {
      name: 'CGU - Portal da Transparência',
      url: `https://portaldatransparencia.gov.br/busca?termo=${encodedName}`,
      icon: '🔍'
    },
    {
      name: 'TSE - Divulgacand',
      url: `https://divulgacandcontas.tse.jus.br/divulga/#/candidato/buscar/2024`,
      icon: '🗳️'
    },
    {
      name: 'CNPJ.ws',
      url: `https://cnpj.ws/busca?q=${encodedName}`,
      icon: '🏢'
    },
    {
      name: 'JusBrasil',
      url: `https://www.jusbrasil.com.br/busca?q=${encodedName}`,
      icon: '📚'
    },
    {
      name: 'Escavador',
      url: `https://www.escavador.com/busca?q=${encodedName}&qo=p`,
      icon: '🔎'
    },
  ];
};

/**
 * Gera query de busca otimizada para um alerta específico
 */
export const buildAlertSearchQuery = (
  politicianName: string, 
  alertTitle: string,
  alertDescription: string
): string => {
  // Extrai palavras-chave relevantes
  const keywords: string[] = [];
  
  // Adiciona nome do político
  keywords.push(`"${politicianName}"`);
  
  // Detecta tipo de alerta e adiciona termos relevantes
  const text = `${alertTitle} ${alertDescription}`.toLowerCase();
  
  if (text.includes('cota') || text.includes('ceap') || text.includes('verba')) {
    keywords.push('cota parlamentar');
  }
  if (text.includes('emenda')) {
    keywords.push('emenda parlamentar');
  }
  if (text.includes('processo') || text.includes('condenação')) {
    keywords.push('processo');
  }
  if (text.includes('improbidade')) {
    keywords.push('improbidade administrativa');
  }
  if (text.includes('licitação') || text.includes('contrato')) {
    keywords.push('licitação');
  }
  if (text.includes('patrimônio')) {
    keywords.push('patrimônio declarado');
  }
  if (text.includes('nepotismo') || text.includes('parente')) {
    keywords.push('nepotismo');
  }
  
  // Se não detectou nenhum tipo, usa palavras do título
  if (keywords.length === 1) {
    const titleWords = alertTitle.split(' ')
      .filter(w => w.length > 4)
      .slice(0, 3);
    keywords.push(...titleWords);
  }
  
  return keywords.join(' ');
};

/**
 * Interface para resultado combinado de verificação
 */
export interface VerificationResult {
  factChecks: any[];
  newsResults: NewsResult[];
  searchUrls: { news: ReturnType<typeof getNewsSearchUrls>; official: ReturnType<typeof getOfficialSearchUrls> };
  timestamp: string;
}
