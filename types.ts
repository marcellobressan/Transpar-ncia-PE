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

export interface Candidate {
  id: string;
  name: string;
  party: string;
  currentRole: string;
  disputedRole: string;
  sphere: Sphere;
  location: string; // e.g., "Pernambuco", "Recife"
  photoUrl: string;
  
  // Section 2: Summary
  totalSpending10Years: number;
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
  
  // Section 5: Key Findings
  keyFindings: string[];
  
  // Section 6: Data Availability
  dataAvailabilityScore: number; // 0-100
  missingDataWarnings: string[];
}

export interface FilterState {
  sphere: Sphere | 'All';
  search: string;
}