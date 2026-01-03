export enum Sphere {
  FEDERAL = 'Federal',
  ESTADUAL = 'Estadual',
  MUNICIPAL = 'Municipal'
}

export enum EfficiencyRating {
  ALTA = 'Alta Eficiência',
  MEDIA = 'Média',
  BAIXA = 'Baixa Eficiência',
  CRITICA = 'Crítica'
}

export enum CandidacyStatus {
  CONFIRMADA = 'Candidatura Confirmada',
  PRE_CANDIDATO = 'Pré-Candidato',
  NAO_CANDIDATO = 'Não é candidato(a)'
}

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
  maxAdvisors: number; // Limite legal (ex: 25 para deputados federais)
  monthlyCost: number;
  maxMonthlyCost: number; // Verba de Gabinete (ex: ~R$ 118k)
}

export interface RedFlag {
  id: string;
  title: string;
  description: string;
  source: string;
  sourceUrl: string;
  date: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW'; // HIGH: Processo/Condenação, MEDIUM: Investigação, LOW: Questionamento
}

export interface Politician {
  id: string;
  name: string;
  party: string;
  currentRole: string;
  disputedRole: string | null; // Null se não for candidato
  candidacyStatus: CandidacyStatus;
  sphere: Sphere;
  location: string; // e.g., "Pernambuco", "Recife"
  photoUrl: string;
  
  // Section 2: Summary
  totalSpending10Years: number;
  totalSpendingLastMandate: number; // Novo campo
  spendingPerCapita: number;
  spendingTrend: 'Crescente' | 'Estável' | 'Decrescente';
  efficiencyRating: EfficiencyRating;
  partyAverageComparison: number; // percentage relative to average (e.g., 1.2 = 20% above)
  stateAverageComparison: number;

  // Section 3: Details
  salaryHistory: SpendingRecord[];
  ceapHistory: SpendingRecord[];
  amendments: {
    totalProposed: number;
    totalExecuted: number;
    topAreas: string[];
    geoDistribution: string[]; // e.g., "Sertão", "Agreste"
    history: AmendmentHistory[];
  };

  // Section 4: Cabinet & Staff
  advisorStats: AdvisorStats;

  // Section 5: Red Flags (Novo)
  redFlagsSummary: string; // Resumo de parágrafo único (max 150 palavras)
  redFlags: RedFlag[]; // Lista detalhada com fontes
  
  // Section 6: Key Findings (Insights de dados, menos graves que Red Flags)
  keyFindings: string[];
  
  // Section 7: Data Availability
  dataAvailabilityScore: number; // 0-100
  missingDataWarnings: string[];
}

export interface FilterState {
  sphere: Sphere | 'All';
  search: string;
  status: CandidacyStatus | 'All';
}