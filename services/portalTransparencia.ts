export const API_KEY = '9133530778e9c7f8e161806b556373bd';
export const BASE_URL = 'https://api.portaldatransparencia.gov.br/api-de-dados';

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
 * Busca o ID de um servidor pelo nome exato ou aproximado.
 */
export const fetchServidorId = async (name: string): Promise<Servidor | null> => {
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
    console.error("Erro ao buscar servidor:", error);
    return null;
  }
};

/**
 * Busca a remuneração de um servidor por ID e Ano.
 */
export const fetchRemuneracaoByYear = async (servidorId: number, year: number): Promise<Remuneracao[]> => {
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
    console.error(`Erro ao buscar remuneração para ID ${servidorId}:`, error);
    return [];
  }
};

export const fetchAmendmentsByAuthor = async (authorName: string, year: number): Promise<DetailedAmendmentStats | null> => {
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