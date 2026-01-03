/**
 * Serviço de integração com Portais de Transparência de Pernambuco
 * 
 * Este serviço centraliza as buscas nos portais de transparência estaduais e municipais de PE.
 * A maioria dessas APIs não permite CORS, então fornecemos links diretos para consulta manual
 * e tentamos buscar dados quando possível.
 * 
 * Fontes integradas:
 * - Portal da Transparência de Recife (Municipal)
 * - Portal da Transparência de PE (Estadual)
 * - PGE-PE (Procuradoria Geral do Estado)
 * - MP-PE (Ministério Público de PE)
 * - Portal da Transparência Federal - Localidades PE
 */

// URLs dos portais de transparência de PE
export const PORTAIS_PE = {
  // Municipal - Recife
  recife: {
    nome: 'Portal da Transparência de Recife',
    baseUrl: 'https://transparencia.recife.pe.gov.br',
    home: 'https://transparencia.recife.pe.gov.br/codigos/web/geral/home.php',
    servidores: 'https://transparencia.recife.pe.gov.br/codigos/web/servidores/servidores.php',
    despesas: 'https://transparencia.recife.pe.gov.br/codigos/web/despesas/despesas.php',
    receitas: 'https://transparencia.recife.pe.gov.br/codigos/web/receitas/receitas.php',
    contratos: 'https://transparencia.recife.pe.gov.br/codigos/web/contratos/contratos.php',
    licitacoes: 'https://transparencia.recife.pe.gov.br/codigos/web/licitacoes/licitacoes.php',
  },
  
  // Estadual - Governo de PE
  estadual: {
    nome: 'Portal da Transparência de Pernambuco',
    baseUrl: 'https://transparencia.pe.gov.br',
    home: 'https://transparencia.pe.gov.br/',
    remuneracoes: 'https://transparencia.pe.gov.br/recursos-humanos/remuneracoes/',
    servidores: 'https://transparencia.pe.gov.br/recursos-humanos/',
    despesas: 'https://transparencia.pe.gov.br/despesas/',
    receitas: 'https://transparencia.pe.gov.br/receitas/',
    contratos: 'https://transparencia.pe.gov.br/contratos/',
    licitacoes: 'https://transparencia.pe.gov.br/licitacoes/',
    diarias: 'https://transparencia.pe.gov.br/diarias/',
  },
  
  // PGE-PE - Procuradoria Geral do Estado
  pge: {
    nome: 'PGE-PE - Procuradoria Geral do Estado',
    baseUrl: 'https://www.pge.pe.gov.br',
    home: 'https://www.pge.pe.gov.br/transparenciaapresentacao.aspx',
    servidores: 'https://www.pge.pe.gov.br/transparenciaservidores.aspx',
    remuneracoes: 'https://www.pge.pe.gov.br/transparenciaremuneracoes.aspx',
  },
  
  // MP-PE - Ministério Público de Pernambuco
  mppe: {
    nome: 'MP-PE - Ministério Público de Pernambuco',
    baseUrl: 'https://transparencia.mppe.mp.br',
    home: 'https://transparencia.mppe.mp.br/',
    membros: 'https://transparencia.mppe.mp.br/membros',
    servidores: 'https://transparencia.mppe.mp.br/servidores',
    remuneracoes: 'https://transparencia.mppe.mp.br/remuneracoes',
    despesas: 'https://transparencia.mppe.mp.br/despesas',
  },
  
  // Portal Federal - Localidades PE
  federal: {
    nome: 'Portal da Transparência Federal - PE',
    baseUrl: 'https://portaldatransparencia.gov.br',
    home: 'https://portaldatransparencia.gov.br/localidades/PE-PERNAMBUCO',
    localidade: 'https://portaldatransparencia.gov.br/localidades/PE-PERNAMBUCO',
    servidores: 'https://portaldatransparencia.gov.br/servidores/consulta?paginacaoSimples=true&tamanhoPagina=100&offset=0&direcaoOrdenacao=asc&colunaOrdenacao=nome&uf=PE',
    despesas: 'https://portaldatransparencia.gov.br/despesas?uf=PE',
    transferencias: 'https://portaldatransparencia.gov.br/transferencias?uf=PE',
    beneficios: 'https://portaldatransparencia.gov.br/beneficios?uf=PE',
  },
};

// Tipos para os dados retornados
export interface PortalInfo {
  nome: string;
  tipo: 'municipal' | 'estadual' | 'federal' | 'ministerio_publico' | 'pge';
  url: string;
  disponivel: boolean;
  ultimaVerificacao: Date;
}

export interface ServidorPE {
  nome: string;
  cargo?: string;
  orgao?: string;
  remuneracaoBruta?: number;
  remuneracaoLiquida?: number;
  lotacao?: string;
  vinculo?: string;
  fonte: string;
  urlConsulta: string;
}

export interface DespesaPE {
  ano: number;
  mes?: number;
  categoria: string;
  valor: number;
  descricao?: string;
  fonte: string;
  urlConsulta: string;
}

export interface LinkConsulta {
  portal: string;
  tipo: 'remuneracao' | 'despesas' | 'contratos' | 'servidores' | 'geral';
  url: string;
  descricao: string;
}

// Cache para status dos portais
const portalStatusCache: Map<string, { disponivel: boolean; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Verifica se um portal está acessível
 * Nota: A maioria vai falhar por CORS, mas registramos para UI
 */
export async function checkPortalStatus(portalKey: keyof typeof PORTAIS_PE): Promise<boolean> {
  const cached = portalStatusCache.get(portalKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.disponivel;
  }

  const portal = PORTAIS_PE[portalKey];
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Tentamos um HEAD request simples
    await fetch(portal.home, {
      method: 'HEAD',
      mode: 'no-cors', // Para evitar erros de CORS no console
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Com mode: 'no-cors', não temos como saber se funcionou, mas pelo menos não deu timeout
    portalStatusCache.set(portalKey, { disponivel: true, timestamp: Date.now() });
    return true;
  } catch (error) {
    portalStatusCache.set(portalKey, { disponivel: false, timestamp: Date.now() });
    return false;
  }
}

/**
 * Retorna todos os portais com seus status
 */
export async function getAllPortaisStatus(): Promise<PortalInfo[]> {
  const portais: PortalInfo[] = [];

  for (const [key, portal] of Object.entries(PORTAIS_PE)) {
    let tipo: PortalInfo['tipo'];
    switch (key) {
      case 'recife': tipo = 'municipal'; break;
      case 'estadual': tipo = 'estadual'; break;
      case 'federal': tipo = 'federal'; break;
      case 'mppe': tipo = 'ministerio_publico'; break;
      case 'pge': tipo = 'pge'; break;
      default: tipo = 'estadual';
    }

    portais.push({
      nome: portal.nome,
      tipo,
      url: portal.home,
      disponivel: await checkPortalStatus(key as keyof typeof PORTAIS_PE),
      ultimaVerificacao: new Date(),
    });
  }

  return portais;
}

/**
 * Gera links de consulta para um político baseado no seu cargo/esfera
 */
export function getLinksConsulta(
  nome: string,
  cargo?: string,
  esfera?: 'Federal' | 'Estadual' | 'Municipal'
): LinkConsulta[] {
  const links: LinkConsulta[] = [];
  const nomeEncoded = encodeURIComponent(nome);
  const cargoLower = (cargo ?? '').toLowerCase();

  // Links universais - Portal Federal (todos os níveis)
  links.push({
    portal: PORTAIS_PE.federal.nome,
    tipo: 'servidores',
    url: `${PORTAIS_PE.federal.servidores}&nome=${nomeEncoded}`,
    descricao: 'Buscar no Portal da Transparência Federal',
  });

  // Para prefeitos de Recife ou servidores municipais
  if (cargoLower.includes('prefeito') || cargoLower.includes('recife') || esfera === 'Municipal') {
    links.push({
      portal: PORTAIS_PE.recife.nome,
      tipo: 'servidores',
      url: PORTAIS_PE.recife.servidores,
      descricao: 'Consultar servidores de Recife',
    });
    links.push({
      portal: PORTAIS_PE.recife.nome,
      tipo: 'despesas',
      url: PORTAIS_PE.recife.despesas,
      descricao: 'Ver despesas da Prefeitura de Recife',
    });
  }

  // Para governador ou servidores estaduais
  if (cargoLower.includes('governador') || cargoLower.includes('secretár') || esfera === 'Estadual') {
    links.push({
      portal: PORTAIS_PE.estadual.nome,
      tipo: 'remuneracao',
      url: PORTAIS_PE.estadual.remuneracoes,
      descricao: 'Consultar remunerações do Estado de PE',
    });
    links.push({
      portal: PORTAIS_PE.estadual.nome,
      tipo: 'servidores',
      url: PORTAIS_PE.estadual.servidores,
      descricao: 'Consultar servidores do Estado',
    });
    links.push({
      portal: PORTAIS_PE.estadual.nome,
      tipo: 'despesas',
      url: PORTAIS_PE.estadual.despesas,
      descricao: 'Ver despesas do Governo de PE',
    });
  }

  // Para promotores/procuradores do MP
  if (cargoLower.includes('promotor') || cargoLower.includes('procurador') && cargoLower.includes('mp')) {
    links.push({
      portal: PORTAIS_PE.mppe.nome,
      tipo: 'remuneracao',
      url: PORTAIS_PE.mppe.remuneracoes,
      descricao: 'Consultar remunerações do MP-PE',
    });
    links.push({
      portal: PORTAIS_PE.mppe.nome,
      tipo: 'servidores',
      url: PORTAIS_PE.mppe.membros,
      descricao: 'Ver membros do MP-PE',
    });
  }

  // Para procuradores da PGE
  if (cargoLower.includes('procurador') && !cargoLower.includes('mp')) {
    links.push({
      portal: PORTAIS_PE.pge.nome,
      tipo: 'remuneracao',
      url: PORTAIS_PE.pge.remuneracoes,
      descricao: 'Consultar remunerações da PGE-PE',
    });
  }

  // Deputados e Senadores - links para emendas direcionadas a PE
  if (cargoLower.includes('deputad') || cargoLower.includes('senador')) {
    links.push({
      portal: PORTAIS_PE.federal.nome,
      tipo: 'despesas',
      url: PORTAIS_PE.federal.transferencias,
      descricao: 'Ver transferências federais para PE',
    });
    links.push({
      portal: PORTAIS_PE.estadual.nome,
      tipo: 'geral',
      url: PORTAIS_PE.estadual.home,
      descricao: 'Portal de Transparência de PE (emendas recebidas)',
    });
  }

  // Link geral para todos
  links.push({
    portal: PORTAIS_PE.federal.nome,
    tipo: 'geral',
    url: PORTAIS_PE.federal.localidade,
    descricao: 'Dados federais sobre Pernambuco',
  });

  return links;
}

/**
 * Gera um resumo das fontes de dados disponíveis para o político
 */
export function getResumoFontes(cargo?: string, esfera?: 'Federal' | 'Estadual' | 'Municipal'): string[] {
  const fontes: string[] = [];
  const cargoLower = (cargo ?? '').toLowerCase();

  if (cargoLower.includes('deputad')) {
    fontes.push('Câmara dos Deputados (API Oficial)');
    fontes.push('Portal da Transparência Federal');
  } else if (cargoLower.includes('senador')) {
    fontes.push('Senado Federal (API Oficial)');
    fontes.push('Portal da Transparência Federal');
  } else if (cargoLower.includes('governador') || esfera === 'Estadual') {
    fontes.push('Portal da Transparência de PE');
    fontes.push('Portal da Transparência Federal');
  } else if (cargoLower.includes('prefeito') || cargoLower.includes('recife') || esfera === 'Municipal') {
    fontes.push('Portal da Transparência de Recife');
    fontes.push('Portal da Transparência de PE');
  }

  fontes.push('TSE - Tribunal Superior Eleitoral');
  fontes.push('dados.gov.br');

  return fontes;
}

/**
 * Tenta buscar dados de remuneração do Portal de PE (Estadual)
 * Nota: Provavelmente vai falhar por CORS, mas tentamos mesmo assim
 */
export async function fetchRemuneracaoEstadual(nome: string): Promise<ServidorPE | null> {
  try {
    // O portal estadual de PE não tem API pública documentada
    // Retornamos null e fornecemos o link para consulta manual
    console.info(`Busca de ${nome} no Portal de PE requer consulta manual`);
    return null;
  } catch (error) {
    console.warn('Erro ao buscar no Portal de PE:', error);
    return null;
  }
}

/**
 * Tenta buscar dados de remuneração do Portal de Recife (Municipal)
 */
export async function fetchRemuneracaoRecife(nome: string): Promise<ServidorPE | null> {
  try {
    // O portal de Recife não tem API pública documentada
    // Retornamos null e fornecemos o link para consulta manual
    console.info(`Busca de ${nome} no Portal de Recife requer consulta manual`);
    return null;
  } catch (error) {
    console.warn('Erro ao buscar no Portal de Recife:', error);
    return null;
  }
}

/**
 * Busca dados em todos os portais disponíveis e retorna o que encontrar
 */
export async function buscarEmTodosPortais(nome: string, cargo?: string): Promise<{
  dados: ServidorPE[];
  linksConsulta: LinkConsulta[];
  fontes: string[];
}> {
  const dados: ServidorPE[] = [];
  const esfera = cargo?.toLowerCase().includes('governador') || cargo?.toLowerCase().includes('estadual')
    ? 'Estadual'
    : cargo?.toLowerCase().includes('prefeito') || cargo?.toLowerCase().includes('recife')
      ? 'Municipal'
      : 'Federal';

  // Tenta buscar nos portais (provavelmente vai falhar por CORS)
  const [estadual, recife] = await Promise.all([
    fetchRemuneracaoEstadual(nome),
    fetchRemuneracaoRecife(nome),
  ]);

  if (estadual) dados.push(estadual);
  if (recife) dados.push(recife);

  return {
    dados,
    linksConsulta: getLinksConsulta(nome, cargo, esfera as any),
    fontes: getResumoFontes(cargo, esfera as any),
  };
}

/**
 * URLs úteis para cada tipo de político de PE
 */
export const URLS_UTEIS = {
  // Para deputados federais de PE
  deputadoFederal: {
    despesas: 'https://www.camara.leg.br/transparencia/gastos-parlamentares',
    presenca: 'https://www.camara.leg.br/transparencia/frequencia-e-votacoes',
    emendas: 'https://portaldatransparencia.gov.br/emendas',
    salario: 'Subsídio fixo: R$ 44.008,52/mês (2024)',
  },
  
  // Para senadores de PE
  senador: {
    despesas: 'https://www12.senado.leg.br/transparencia/',
    presenca: 'https://www25.senado.leg.br/web/atividade/votacoes',
    salario: 'Subsídio fixo: R$ 44.008,52/mês (2024)',
  },
  
  // Para governador de PE
  governador: {
    portal: PORTAIS_PE.estadual.home,
    remuneracoes: PORTAIS_PE.estadual.remuneracoes,
    despesas: PORTAIS_PE.estadual.despesas,
    salario: 'Consultar Portal de Transparência de PE',
  },
  
  // Para prefeito de Recife
  prefeito: {
    portal: PORTAIS_PE.recife.home,
    servidores: PORTAIS_PE.recife.servidores,
    despesas: PORTAIS_PE.recife.despesas,
    salario: 'Consultar Portal de Transparência de Recife',
  },
};

export default {
  PORTAIS_PE,
  URLS_UTEIS,
  checkPortalStatus,
  getAllPortaisStatus,
  getLinksConsulta,
  getResumoFontes,
  buscarEmTodosPortais,
  fetchRemuneracaoEstadual,
  fetchRemuneracaoRecife,
};
