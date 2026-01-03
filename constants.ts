import { Politician, Sphere, EfficiencyRating, CandidacyStatus } from './types';

export const PARTY_LOGOS: Record<string, string> = {
  'PT': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Partido_dos_Trabalhadores_Emblema.svg/1024px-Partido_dos_Trabalhadores_Emblema.svg.png',
  'PL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Logo_do_Partido_Liberal_%282006%29.svg/2048px-Logo_do_Partido_Liberal_%282006%29.svg.png',
  'PSB': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Logo_PSB.png/800px-Logo_PSB.png',
  'PSDB': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/PSDB_logo.svg/2560px-PSDB_logo.svg.png',
  'REDE': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Rede_Sustentabilidade_logo.svg/1200px-Rede_Sustentabilidade_logo.svg.png',
  'DEFAULT': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Political_party.svg/1200px-Political_party.svg.png'
};

export const MOCK_POLITICIANS: Politician[] = [
  {
    id: '1',
    name: 'Túlio Gadêlha',
    party: 'REDE',
    currentRole: 'Deputado Federal',
    disputedRole: 'Prefeito',
    candidacyStatus: CandidacyStatus.PRE_CANDIDATO,
    sphere: Sphere.FEDERAL,
    location: 'Recife',
    photoUrl: 'https://www.camara.leg.br/internet/deputado/bandep/204464.jpg',
    totalSpending10Years: 15450000,
    totalSpendingLastMandate: 2150000,
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
    advisorStats: {
      totalAdvisors: 22,
      maxAdvisors: 25,
      monthlyCost: 105000,
      maxMonthlyCost: 118376
    },
    redFlagsSummary: "Até o momento, não foram encontradas condenações criminais ou processos por improbidade administrativa transitados em julgado. As verificações indicam apenas questionamentos pontuais sobre o uso da Cota Parlamentar para divulgação de mandato, situações comuns e justificadas internamente sem abertura de inquérito.",
    redFlags: [
      {
        id: '1',
        title: 'Questionamento sobre Uso de Cota (Divulgação)',
        description: 'Operação Serenata de Amor identificou gastos elevados com impulsionamento, mas dentro do limite legal.',
        source: 'Jarbas / Serenata de Amor',
        sourceUrl: 'https://jarbas.serenata.ai/',
        date: '2023-05-12',
        severity: 'LOW'
      }
    ],
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
    candidacyStatus: CandidacyStatus.CONFIRMADA,
    sphere: Sphere.ESTADUAL,
    location: 'Pernambuco',
    photoUrl: 'https://picsum.photos/200/200?random=2',
    totalSpending10Years: 8200000,
    totalSpendingLastMandate: 1850000,
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
    advisorStats: {
      totalAdvisors: 18,
      maxAdvisors: 23, // Limite estadual varia, estimativa
      monthlyCost: 85000,
      maxMonthlyCost: 90000
    },
    redFlagsSummary: "A parlamentar apresenta pendências relacionadas à prestação de contas de campanhas anteriores junto ao TRE-PE. Além disso, auditorias independentes levantaram inconsistências no uso de verbas indenizatórias para combustíveis, com valores incompatíveis com a quilometragem média de um mandato estadual, embora sem condenação formal até o momento.",
    redFlags: [
      {
        id: '2',
        title: 'Contas de Campanha com Ressalvas',
        description: 'O Tribunal Regional Eleitoral aprovou as contas de 2020 com ressalvas devido a inconsistências em doações.',
        source: 'TRE-PE (DivulgaCand)',
        sourceUrl: 'https://divulgacandcontas.tse.jus.br/',
        date: '2021-08-15',
        severity: 'MEDIUM'
      },
      {
        id: '3',
        title: 'Investigação Preliminar (Combustíveis)',
        description: 'Ministério Público solicitou esclarecimentos sobre notas fiscais de abastecimento em dias não úteis.',
        source: 'MPPE - Diário Oficial',
        sourceUrl: '#',
        date: '2023-02-10',
        severity: 'MEDIUM'
      }
    ],
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
    candidacyStatus: CandidacyStatus.CONFIRMADA,
    sphere: Sphere.MUNICIPAL,
    location: 'Recife',
    photoUrl: 'https://picsum.photos/200/200?random=3',
    totalSpending10Years: 4100000,
    totalSpendingLastMandate: 750000,
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
    advisorStats: {
      totalAdvisors: 12,
      maxAdvisors: 15,
      monthlyCost: 28000,
      maxMonthlyCost: 32000
    },
    redFlagsSummary: "Histórico limpo em fontes oficiais. Não constam processos no TJPE ou TCE-PE relacionados ao mandato. O candidato mantém certificação de transparência ativa e publica voluntariamente extratos que excedem a exigência legal da Câmara Municipal.",
    redFlags: [],
    keyFindings: [
      'Economia de verba de gabinete superior a 30% todo ano.',
      'Não utiliza carro oficial, usa transporte próprio.',
      'Alta eficiência em emendas impositivas para creches.',
      'Equipe de gabinete reduzida e técnica.'
    ],
    dataAvailabilityScore: 95,
    missingDataWarnings: []
  },
  {
    id: '4',
    name: 'João Campos',
    party: 'PSB',
    currentRole: 'Prefeito',
    disputedRole: 'Reeleição',
    candidacyStatus: CandidacyStatus.CONFIRMADA,
    sphere: Sphere.MUNICIPAL,
    location: 'Recife',
    photoUrl: 'https://conteudo.imguol.com.br/c/noticias/3c/2020/11/29/joao-campos-psb-vota-no-recife-1606660167683_v2_1x1.jpg',
    totalSpending10Years: 22000000,
    totalSpendingLastMandate: 5400000,
    spendingPerCapita: 1.20,
    spendingTrend: 'Crescente',
    efficiencyRating: EfficiencyRating.MEDIA,
    partyAverageComparison: 1.15,
    stateAverageComparison: 1.10,
    salaryHistory: [
      { year: 2023, category: 'Remuneração', amount: 300000, description: 'Subsídio Prefeito', source: 'Portal Transparência Recife' },
    ],
    ceapHistory: [],
    amendments: {
      totalProposed: 0, // Executivo não propõe emenda parlamentar da mesma forma
      totalExecuted: 0,
      topAreas: [],
      geoDistribution: [],
      history: []
    },
    advisorStats: {
      totalAdvisors: 0, // Estrutura de executivo é diferente de gabinete parlamentar
      maxAdvisors: 0,
      monthlyCost: 0,
      maxMonthlyCost: 0
    },
    redFlagsSummary: "Como gestor do executivo, responde a processos administrativos padrão no Tribunal de Contas (TCE-PE) referentes a licitações municipais, sem condenações pessoais por improbidade ou dolo. Existem apontamentos da oposição sobre dispensa de licitação em obras emergenciais, atualmente sob análise técnica do órgão fiscalizador.",
    redFlags: [
      {
        id: '4',
        title: 'Análise de Contas de Governo (Em trâmite)',
        description: 'Processo regular de prestação de contas anual junto ao TCE-PE em fase de instrução.',
        source: 'TCE-PE',
        sourceUrl: 'https://tce.pe.gov.br/',
        date: '2023-11-01',
        severity: 'LOW'
      },
      {
        id: '5',
        title: 'Denúncia sobre Dispensa de Licitação',
        description: 'Apuração preliminar sobre contratos emergenciais no período de chuvas. Sem julgamento de mérito.',
        source: 'MPPE',
        sourceUrl: '#',
        date: '2023-06-15',
        severity: 'MEDIUM'
      }
    ],
    keyFindings: [
      'Aumento de investimentos em obras de encostas.',
      'Digitalização de serviços públicos (GO Recife).',
      'Crescimento da folha de pagamento da prefeitura.'
    ],
    dataAvailabilityScore: 98,
    missingDataWarnings: []
  },
  {
    id: '5',
    name: 'Raquel Lyra',
    party: 'PSDB',
    currentRole: 'Governadora',
    disputedRole: null,
    candidacyStatus: CandidacyStatus.NAO_CANDIDATO,
    sphere: Sphere.ESTADUAL,
    location: 'Pernambuco',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Raquel_Lyra_em_2022.jpg/640px-Raquel_Lyra_em_2022.jpg',
    totalSpending10Years: 18500000,
    totalSpendingLastMandate: 4200000,
    spendingPerCapita: 1.05,
    spendingTrend: 'Estável',
    efficiencyRating: EfficiencyRating.MEDIA,
    partyAverageComparison: 1.0,
    stateAverageComparison: 1.0,
    salaryHistory: [
      { year: 2023, category: 'Remuneração', amount: 350000, description: 'Subsídio Governadora', source: 'Portal Transparência PE' },
    ],
    ceapHistory: [],
    amendments: {
      totalProposed: 0,
      totalExecuted: 0,
      topAreas: [],
      geoDistribution: [],
      history: []
    },
    advisorStats: {
      totalAdvisors: 0,
      maxAdvisors: 0,
      monthlyCost: 0,
      maxMonthlyCost: 0
    },
    redFlagsSummary: "Não é candidata na eleição atual. Possui histórico de aprovação de contas nos mandatos anteriores como prefeita de Caruaru, com algumas ressalvas técnicas sanadas. Enfrenta ações civis públicas comuns ao cargo de chefe do executivo estadual referentes a obrigações de fazer (saúde, educação), sem imputação de crime de responsabilidade.",
    redFlags: [],
    keyFindings: [
      'Foco em ajuste fiscal no primeiro ano de mandato.',
      'Redução de cargos comissionados em relação à gestão anterior.'
    ],
    dataAvailabilityScore: 92,
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