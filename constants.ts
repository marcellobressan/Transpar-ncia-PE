import { Candidate, Sphere, EfficiencyRating } from './types';

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: '1',
    name: 'Túlio Gadêlha',
    party: 'REDE',
    currentRole: 'Deputado Federal',
    disputedRole: 'Prefeito',
    sphere: Sphere.FEDERAL,
    location: 'Recife',
    photoUrl: 'https://www.camara.leg.br/internet/deputado/bandep/204464.jpg',
    totalSpending10Years: 15450000,
    spendingPerCapita: 1.65,
    spendingTrend: 'Estável',
    efficiencyRating: EfficiencyRating.MEDIA,
    partyAverageComparison: 1.05,
    stateAverageComparison: 1.10,
    salaryHistory: [
      { year: 2023, category: 'Remuneração', amount: 410000, description: 'Subsídio e 13º', source: 'Câmara dos Deputados' },
      { year: 2022, category: 'Remuneração', amount: 395000, description: 'Subsídio e 13º', source: 'Câmara dos Deputados' },
    ],
    ceapHistory: [
      { year: 2023, category: 'Divulgação Parlamentar', amount: 120000, description: 'Gestão de redes', source: 'Serenata de Amor' },
      { year: 2023, category: 'Passagens Aéreas', amount: 85000, description: 'Deslocamento PE-DF', source: 'Câmara Transparência' },
    ],
    amendments: {
      totalProposed: 25000000,
      totalExecuted: 18000000,
      topAreas: ['Saúde (Hospitais Regionais)', 'Pavimentação', 'Educação Básica'],
      geoDistribution: ['Recife (40%)', 'Agreste (30%)', 'Sertão (30%)'],
      history: [
        { year: 2023, proposed: 10000000, executed: 7500000 },
        { year: 2022, proposed: 8000000, executed: 6000000 },
        { year: 2021, proposed: 7000000, executed: 4500000 }
      ]
    },
    keyFindings: [
      'Utilização de verba de gabinete na média do partido.',
      'Alta taxa de execução de emendas focadas em projetos sociais.',
      'Transparência ativa em redes sociais sobre gastos.',
      'Mantém equipe técnica para avaliação de projetos.'
    ],
    dataAvailabilityScore: 90,
    missingDataWarnings: []
  },
  {
    id: '2',
    name: 'Carla Dias',
    party: 'PL',
    currentRole: 'Deputada Estadual',
    disputedRole: 'Deputada Federal',
    sphere: Sphere.ESTADUAL,
    location: 'Pernambuco',
    photoUrl: 'https://picsum.photos/200/200?random=2',
    totalSpending10Years: 8200000,
    spendingPerCapita: 0.89,
    spendingTrend: 'Crescente',
    efficiencyRating: EfficiencyRating.BAIXA,
    partyAverageComparison: 1.30,
    stateAverageComparison: 1.45,
    salaryHistory: [
      { year: 2023, category: 'Remuneração', amount: 350000, description: 'Subsídio ALEP', source: 'Portal da Transparência PE' },
    ],
    ceapHistory: [
      { year: 2023, category: 'Combustível', amount: 95000, description: 'Abastecimento frota gabinete', source: 'ALEP Transparência' },
    ],
    amendments: {
      totalProposed: 5000000,
      totalExecuted: 1200000,
      topAreas: ['Eventos Culturais', 'Associações Privadas'],
      geoDistribution: ['Região Metropolitana (90%)'],
      history: [
        { year: 2023, proposed: 2000000, executed: 400000 },
        { year: 2022, proposed: 1500000, executed: 300000 },
        { year: 2021, proposed: 1500000, executed: 500000 }
      ]
    },
    keyFindings: [
      'Gasto com combustível incompatível com quilometragem média.',
      'Baixa execução de emendas (24%).',
      'Foco de emendas em shows e eventos, baixo impacto estrutural.',
      'Crescimento de 15% nos gastos de gabinete ao ano (acima da inflação).'
    ],
    dataAvailabilityScore: 85,
    missingDataWarnings: []
  },
  {
    id: '3',
    name: 'Antônio Silva',
    party: 'PT',
    currentRole: 'Vereador',
    disputedRole: 'Prefeito',
    sphere: Sphere.MUNICIPAL,
    location: 'Recife',
    photoUrl: 'https://picsum.photos/200/200?random=3',
    totalSpending10Years: 4100000,
    spendingPerCapita: 0.45,
    spendingTrend: 'Decrescente',
    efficiencyRating: EfficiencyRating.ALTA,
    partyAverageComparison: 0.85,
    stateAverageComparison: 0.70,
    salaryHistory: [
      { year: 2023, category: 'Remuneração', amount: 210000, description: 'Subsídio Câmara Recife', source: 'Câmara Municipal' },
    ],
    ceapHistory: [
      { year: 2023, category: 'Material de Escritório', amount: 15000, description: 'Consumo interno', source: 'Portal da Transparência Recife' },
    ],
    amendments: {
      totalProposed: 2000000,
      totalExecuted: 1900000,
      topAreas: ['Creches', 'Saneamento'],
      geoDistribution: ['Zona Norte Recife'],
      history: [
        { year: 2023, proposed: 800000, executed: 800000 },
        { year: 2022, proposed: 700000, executed: 650000 },
        { year: 2021, proposed: 500000, executed: 450000 }
      ]
    },
    keyFindings: [
      'Economia de verba de gabinete superior a 30% todo ano.',
      'Não utiliza carro oficial, usa transporte próprio.',
      'Alta eficiência em emendas impositivas para creches.',
      'Equipe de gabinete reduzida e técnica.'
    ],
    dataAvailabilityScore: 95,
    missingDataWarnings: []
  }
];

export const FORMATTER_BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const FORMATTER_PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
});