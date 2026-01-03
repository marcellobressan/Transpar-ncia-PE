/**
 * Tipos do Sistema de Transparência - Pernambuco
 * 
 * Estes tipos são compatíveis com os dados retornados pelas APIs oficiais:
 * - Câmara dos Deputados
 * - Senado Federal
 * - TSE
 * - Portal da Transparência
 */

// =============================================================================
// ENUMS
// =============================================================================

export enum Sphere {
  FEDERAL = 'Federal',
  ESTADUAL = 'Estadual',
  MUNICIPAL = 'Municipal',
  // Aliases para compatibilidade com dataAggregator
  Federal = 'Federal',
  Estadual = 'Estadual',
  Municipal = 'Municipal'
}

export enum EfficiencyRating {
  ALTA = 'Alta Eficiência',
  MEDIA = 'Média',
  BAIXA = 'Baixa Eficiência',
  CRITICA = 'Crítica',
  // Aliases para compatibilidade com dataAggregator
  Excellent = 'Alta Eficiência',
  Good = 'Bom',
  Average = 'Média',
  BelowAverage = 'Abaixo da Média',
  Poor = 'Baixa Eficiência'
}

export enum CandidacyStatus {
  CONFIRMADA = 'Candidatura Confirmada',
  PRE_CANDIDATO = 'Pré-Candidato',
  NAO_CANDIDATO = 'Não é candidato(a)',
  // Aliases para compatibilidade com dataAggregator
  Confirmado = 'Candidatura Confirmada',
  Aguardando = 'Aguardando Registro',
  Indeferido = 'Indeferido',
  Desistente = 'Desistente'
}

// =============================================================================
// INTERFACES DE DADOS
// =============================================================================

export interface SpendingRecord {
  year: number;
  category: string;
  amount: number;
  description: string;
  source: string;
}

export interface AmendmentHistory {
  year: number;
  proposed: number;
  executed: number;
}

export interface AdvisorStats {
  totalAdvisors: number;
  maxAdvisors: number;
  monthlyCost: number;
  maxMonthlyCost: number;
}

export interface RedFlag {
  // Campos originais
  id?: string;
  title?: string;
  sourceUrl?: string;
  date?: string;
  // Campos usados pelo dataAggregator
  type?: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'high' | 'medium' | 'low';
  description: string;
  details?: string;
  source: string;
}

/** Histórico mensal de CEAP (formato do dataAggregator) */
export interface CeapHistoryItem {
  month: string;
  amount: number;
}

/** Fonte de dados */
export interface DataSource {
  name: string;
  url: string;
  lastFetch: string;
}

/** Disponibilidade de dados por tipo */
export interface DataAvailability {
  salary: boolean;
  ceap: boolean;
  amendments: boolean;
  staff: boolean;
  tse: boolean;
}

// =============================================================================
// INTERFACE PRINCIPAL: POLITICIAN
// =============================================================================

export interface Politician {
  id: string;
  name: string;
  party: string;
  sphere: Sphere;
  photoUrl: string;
  
  // Cargo atual e disputa
  currentRole?: string;      // Legacy: cargo atual
  position?: string;         // Novo: cargo/posição
  disputedRole?: string | null;
  candidacyStatus: CandidacyStatus;
  location?: string;         // Legacy: localização
  state?: string;            // Novo: UF
  
  // Sumário de gastos (campos legacy)
  totalSpending10Years?: number;
  totalSpendingLastMandate?: number;
  spendingPerCapita?: number;
  spendingTrend?: 'Crescente' | 'Estável' | 'Decrescente';
  partyAverageComparison?: number;
  stateAverageComparison?: number;
  
  // Eficiência
  efficiencyRating: EfficiencyRating;

  // Histórico de salários (legacy format)
  salaryHistory: SpendingRecord[];
  
  // CEAP - suporta ambos os formatos
  ceapHistory: SpendingRecord[] | CeapHistoryItem[];
  ceapTotal?: number;        // Novo: total calculado
  ceapLimit?: number;        // Novo: limite mensal * 12

  // Emendas parlamentares
  amendments: {
    totalProposed: number;
    totalExecuted: number;
    topAreas: string[];
    geoDistribution: string[];
    history: AmendmentHistory[];
  } | AmendmentHistory[];    // Suporta array simples também
  totalAmendments?: number;  // Novo: total de emendas

  // Gabinete
  advisorStats: AdvisorStats;

  // Red Flags
  redFlagsSummary?: string;  // Legacy
  redFlags: RedFlag[];
  
  // Achados principais
  keyFindings: string[];
  
  // Disponibilidade de dados (suporta ambos os formatos)
  dataAvailabilityScore?: number;    // Legacy: 0-100
  missingDataWarnings?: string[];    // Legacy
  dataAvailability?: DataAvailability; // Novo: por tipo
  
  // Metadados (novo)
  lastUpdated?: string;
  sources?: DataSource[];
}

// =============================================================================
// INTERFACES DE FILTRO E UI
// =============================================================================

export interface FilterState {
  sphere: Sphere | 'All';
  search: string;
  status: CandidacyStatus | 'All';
}

export interface SortConfig {
  field: keyof Politician | 'ceapTotal' | 'redFlagsCount';
  direction: 'asc' | 'desc';
}

// =============================================================================
// INTERFACES DE API STATUS
// =============================================================================

export interface ApiStatus {
  camara: boolean;
  senado: boolean;
  tse: boolean;
  portalTransparencia: boolean;
  lastCheck: Date;
}