const BASE_URL = 'https://dadosabertos.camara.leg.br/api/v2';
import { SpendingRecord, AdvisorStats } from '../types';

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

export interface FuelAnalysisResult {
  totalSpent: number;
  warnings: string[];
  suspiciousTransactions: Expense[];
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