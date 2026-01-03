export const GOOGLE_API_KEY = ''; // Insira sua chave de API do Google Cloud aqui habilitada para Fact Check Tools
const BASE_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

export interface FactCheckReview {
  publisher: {
    name: string;
    site: string;
  };
  url: string;
  title: string;
  reviewDate: string;
  textualRating: string;
  languageCode: string;
}

export interface FactCheckClaim {
  text: string;
  claimant: string;
  claimDate: string;
  claimReview: FactCheckReview[];
}

export const searchFactChecks = async (query: string): Promise<FactCheckClaim[]> => {
  if (!GOOGLE_API_KEY) {
    console.warn("Google API Key não configurada em services/factCheck.ts");
    throw new Error("Chave de API do Google não configurada.");
  }

  try {
    // Busca por reivindicações relacionadas ao nome do candidato, em português
    const url = `${BASE_URL}?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&languageCode=pt-BR`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 403) throw new Error("Chave de API inválida ou sem permissão.");
      if (response.status === 400) throw new Error("Requisição inválida.");
      throw new Error("Erro ao consultar Google Fact Check.");
    }

    const data = await response.json();
    
    // A API retorna um objeto vazio {} se não achar nada, ou { claims: [...] }
    return data.claims || [];
  } catch (error) {
    console.error("Erro na busca de Fact Check:", error);
    throw error;
  }
};