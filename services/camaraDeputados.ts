const BASE_URL = 'https://dadosabertos.camara.leg.br/api/v2';
import { SpendingRecord } from '../types';

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

/**
 * Busca um deputado pelo nome. Retorna o primeiro resultado encontrado.
 */
export const findDeputyByName = async (name: string): Promise<Deputy | null> => {
  try {
    // Busca aproximada pelo nome
    const url = `${BASE_URL}/deputados?nome=${encodeURIComponent(name)}&ordem=ASC&ordenarPor=nome`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error('Falha ao buscar deputado');
    
    const data = await response.json();
    
    // A API retorna uma lista. Tentamos encontrar um match exato ou retornamos o primeiro
    if (data.dados && data.dados.length > 0) {
      // Tenta filtrar por PE se possível, mas aqui retornaremos o primeiro match
      // Idealmente, filtraríamos pela UF do candidato no app
      return data.dados[0];
    }
    
    return null;
  } catch (error) {
    console.error("Erro na API da Câmara:", error);
    return null;
  }
};

/**
 * Busca as despesas (CEAP) de um deputado para um ano específico.
 */
export const getDeputyExpenses = async (id: number, year: number): Promise<Expense[]> => {
  try {
    // Trazemos até 100 itens ordenados por valor para pegar os mais relevantes rapidamente na demo
    // Em produção, deveria haver paginação para pegar TODOS
    const url = `${BASE_URL}/deputados/${id}/despesas?ano=${year}&itens=100&ordem=DESC&ordenarPor=valorLiquido`;
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