/**
 * Serviço de integração com a API do Senado Federal
 * Fonte de dados de senadores, votações, despesas parlamentares e projetos de lei
 * 
 * APIs utilizadas:
 * - https://legis.senado.leg.br/dadosabertos/docs/
 * - https://www.senado.leg.br/transparencia/
 */

const SENADO_API_BASE = 'https://legis.senado.leg.br/dadosabertos';

// Cache local
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

// Interfaces
export interface SenadorInfo {
  codigo: number;
  nome: string;
  nomeCompleto: string;
  partido: string;
  uf: string;
  fotoUrl: string;
  email?: string;
  urlPagina?: string;
  situacao: string; // Exercício, Licença, Suplente
  mandatoInicio: string;
  mandatoFim: string;
}

export interface DespesaSenador {
  ano: number;
  mes: number;
  tipo: string;
  cnpjFornecedor?: string;
  fornecedor: string;
  valor: number;
  urlDocumento?: string;
}

export interface VotacaoSenador {
  data: string;
  materia: string;
  voto: string; // Sim, Não, Abstenção, Ausente
  descricaoMateria?: string;
}

export interface ProjetoLei {
  codigo: string;
  sigla: string;
  numero: number;
  ano: number;
  ementa: string;
  autores?: string[];
  situacao: string;
  dataApresentacao: string;
}

/**
 * Busca lista de senadores atuais
 * Endpoint: /senador/lista/atual
 */
export async function getSenadoresAtuais(): Promise<SenadorInfo[]> {
  const cacheKey = 'senadores_atuais';
  const cached = getCached<SenadorInfo[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${SENADO_API_BASE}/senador/lista/atual`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.warn('Senado: Erro ao buscar senadores', response.status);
      return [];
    }

    const data = await response.json();
    const parlamentares = data.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar || [];
    
    const senadores: SenadorInfo[] = parlamentares.map((s: any) => {
      const identificacao = s.IdentificacaoParlamentar || {};
      const mandato = s.Mandato || {};
      
      return {
        codigo: parseInt(identificacao.CodigoParlamentar),
        nome: identificacao.NomeParlamentar,
        nomeCompleto: identificacao.NomeCompletoParlamentar,
        partido: identificacao.SiglaPartidoParlamentar,
        uf: identificacao.UfParlamentar,
        fotoUrl: identificacao.UrlFotoParlamentar,
        email: identificacao.EmailParlamentar,
        urlPagina: identificacao.UrlPaginaParlamentar,
        situacao: s.DescricaoParticipacao || 'Exercício',
        mandatoInicio: mandato.PrimeiraLegislaturaDoMandato?.DataInicio || '',
        mandatoFim: mandato.SegundaLegislaturaDoMandato?.DataFim || ''
      };
    });

    setCache(cacheKey, senadores);
    return senadores;
  } catch (error) {
    console.error('Erro ao buscar senadores:', error);
    return [];
  }
}

/**
 * Busca senadores por UF (ex: PE para Pernambuco)
 */
export async function getSenadoresPorUF(uf: string = 'PE'): Promise<SenadorInfo[]> {
  const todos = await getSenadoresAtuais();
  return todos.filter(s => s.uf.toUpperCase() === uf.toUpperCase());
}

/**
 * Busca informações detalhadas de um senador específico
 */
export async function getSenadorById(codigo: number): Promise<SenadorInfo | null> {
  const cacheKey = `senador_${codigo}`;
  const cached = getCached<SenadorInfo>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${SENADO_API_BASE}/senador/${codigo}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.warn(`Senado: Senador ${codigo} não encontrado`);
      return null;
    }

    const data = await response.json();
    const parlamentar = data.DetalheParlamentar?.Parlamentar || {};
    const identificacao = parlamentar.IdentificacaoParlamentar || {};
    const dadosBasicos = parlamentar.DadosBasicosParlamentar || {};
    
    const senador: SenadorInfo = {
      codigo: parseInt(identificacao.CodigoParlamentar),
      nome: identificacao.NomeParlamentar,
      nomeCompleto: identificacao.NomeCompletoParlamentar,
      partido: identificacao.SiglaPartidoParlamentar,
      uf: identificacao.UfParlamentar,
      fotoUrl: identificacao.UrlFotoParlamentar,
      email: identificacao.EmailParlamentar,
      urlPagina: identificacao.UrlPaginaParlamentar,
      situacao: dadosBasicos.SituacaoAtual || 'Exercício',
      mandatoInicio: '',
      mandatoFim: ''
    };

    setCache(cacheKey, senador);
    return senador;
  } catch (error) {
    console.error(`Erro ao buscar senador ${codigo}:`, error);
    return null;
  }
}

/**
 * Busca despesas de um senador
 * Endpoint: /senador/{codigo}/despesas
 */
export async function getDespesasSenador(codigo: number, ano?: number): Promise<DespesaSenador[]> {
  const anoAtual = ano || new Date().getFullYear();
  const cacheKey = `despesas_senador_${codigo}_${anoAtual}`;
  const cached = getCached<DespesaSenador[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${SENADO_API_BASE}/senador/${codigo}/despesas?ano=${anoAtual}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      console.warn(`Senado: Despesas não encontradas para senador ${codigo}`);
      return [];
    }

    const data = await response.json();
    const despesasData = data.DespesasParlamentar?.Parlamentar?.Despesas?.Despesa || [];
    
    const despesas: DespesaSenador[] = (Array.isArray(despesasData) ? despesasData : [despesasData])
      .filter((d: any) => d)
      .map((d: any) => ({
        ano: parseInt(d.Ano),
        mes: parseInt(d.Mes),
        tipo: d.TipoDespesa,
        cnpjFornecedor: d.CnpjCpf,
        fornecedor: d.Fornecedor,
        valor: parseFloat(d.Valor) || 0,
        urlDocumento: d.UrlDocumento
      }));

    setCache(cacheKey, despesas);
    return despesas;
  } catch (error) {
    console.error(`Erro ao buscar despesas do senador ${codigo}:`, error);
    return [];
  }
}

/**
 * Calcula total de despesas por tipo para um senador
 */
export async function getDespesasSenadorPorTipo(codigo: number, ano?: number): Promise<Record<string, number>> {
  const despesas = await getDespesasSenador(codigo, ano);
  const porTipo: Record<string, number> = {};
  
  despesas.forEach(d => {
    porTipo[d.tipo] = (porTipo[d.tipo] || 0) + d.valor;
  });
  
  return porTipo;
}

/**
 * Busca histórico de despesas mensais de um senador
 */
export async function getHistoricoDespesasMensal(codigo: number, anos: number[] = [2024, 2023, 2022]): Promise<{ mes: string; valor: number }[]> {
  const historico: { mes: string; valor: number }[] = [];
  
  for (const ano of anos) {
    const despesas = await getDespesasSenador(codigo, ano);
    const porMes: Record<number, number> = {};
    
    despesas.forEach(d => {
      porMes[d.mes] = (porMes[d.mes] || 0) + d.valor;
    });
    
    for (let mes = 1; mes <= 12; mes++) {
      if (porMes[mes]) {
        historico.push({
          mes: `${String(mes).padStart(2, '0')}/${ano}`,
          valor: porMes[mes]
        });
      }
    }
  }
  
  return historico.sort((a, b) => {
    const [mesA, anoA] = a.mes.split('/').map(Number);
    const [mesB, anoB] = b.mes.split('/').map(Number);
    return anoA !== anoB ? anoA - anoB : mesA - mesB;
  });
}

/**
 * Busca votações de um senador
 */
export async function getVotacoesSenador(codigo: number, ano?: number): Promise<VotacaoSenador[]> {
  const anoAtual = ano || new Date().getFullYear();
  const cacheKey = `votacoes_senador_${codigo}_${anoAtual}`;
  const cached = getCached<VotacaoSenador[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${SENADO_API_BASE}/senador/${codigo}/votacoes?ano=${anoAtual}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      console.warn(`Senado: Votações não encontradas para senador ${codigo}`);
      return [];
    }

    const data = await response.json();
    const votacoesData = data.VotacaoParlamentar?.Parlamentar?.Votacoes?.Votacao || [];
    
    const votacoes: VotacaoSenador[] = (Array.isArray(votacoesData) ? votacoesData : [votacoesData])
      .filter((v: any) => v)
      .map((v: any) => ({
        data: v.SessaoPlenaria?.DataSessao,
        materia: `${v.Materia?.Sigla} ${v.Materia?.Numero}/${v.Materia?.Ano}`,
        voto: v.DescricaoVoto,
        descricaoMateria: v.Materia?.Ementa
      }));

    setCache(cacheKey, votacoes);
    return votacoes;
  } catch (error) {
    console.error(`Erro ao buscar votações do senador ${codigo}:`, error);
    return [];
  }
}

/**
 * Busca projetos de lei de autoria de um senador
 */
export async function getProjetosSenador(codigo: number): Promise<ProjetoLei[]> {
  const cacheKey = `projetos_senador_${codigo}`;
  const cached = getCached<ProjetoLei[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${SENADO_API_BASE}/senador/${codigo}/autorias`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      console.warn(`Senado: Projetos não encontrados para senador ${codigo}`);
      return [];
    }

    const data = await response.json();
    const materiasData = data.AutoriasParlamentar?.Parlamentar?.Autorias?.Autoria || [];
    
    const projetos: ProjetoLei[] = (Array.isArray(materiasData) ? materiasData : [materiasData])
      .filter((m: any) => m?.Materia)
      .map((m: any) => ({
        codigo: m.Materia.Codigo,
        sigla: m.Materia.Sigla,
        numero: parseInt(m.Materia.Numero),
        ano: parseInt(m.Materia.Ano),
        ementa: m.Materia.Ementa,
        situacao: m.Materia.SituacaoAtual,
        dataApresentacao: m.Materia.DataApresentacao
      }));

    setCache(cacheKey, projetos);
    return projetos;
  } catch (error) {
    console.error(`Erro ao buscar projetos do senador ${codigo}:`, error);
    return [];
  }
}

/**
 * URL da foto oficial de um senador
 */
export function getSenadorPhotoUrl(codigo: number): string {
  return `https://www.senado.leg.br/senadores/img/fotos-oficiais/senador${codigo}.jpg`;
}

export default {
  getSenadoresAtuais,
  getSenadoresPorUF,
  getSenadorById,
  getDespesasSenador,
  getDespesasSenadorPorTipo,
  getHistoricoDespesasMensal,
  getVotacoesSenador,
  getProjetosSenador,
  getSenadorPhotoUrl,
};
