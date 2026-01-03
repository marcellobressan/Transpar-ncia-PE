import React, { useState, useEffect, useCallback } from 'react';
import { Politician, EfficiencyRating, AmendmentHistory, SpendingRecord, CandidacyStatus, AdvisorStats } from '../types';
import { FORMATTER_BRL, PARTY_LOGOS } from '../constants';
import EfficiencyBadge from './EfficiencyBadge';
import Tooltip from './Tooltip';
import CSVEmendasViewer from './CSVEmendasViewer';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie } from 'recharts';
import { AlertTriangle, CheckCircle, Info, FileText, Search, RefreshCw, Globe, Database, Building2, Filter, ExternalLink, FileSearch, CheckSquare, XCircle, HelpCircle, Briefcase, MapPin, UserCheck, UserX, Fuel, BarChart2, Users, AlertOctagon, Siren, ShieldAlert, Calendar, ChevronLeft, Download, Link2, PieChart as PieChartIcon, TrendingUp, MapPinned, Landmark, Coins, FileDown, FileJson, Code, Upload } from 'lucide-react';
import { fetchAmendmentsByAuthor, DetailedAmendmentStats, fetchServidorId, fetchRemuneracaoByYear, Remuneracao, fetchResumoEmendasAutor, ResumoEmendasAutor, getUrlConsultaEmendas, formatarValorEmenda, getUrlsAnalise, PORTAL_URLS, DOWNLOAD_URLS } from '../services/portalTransparencia';
import { findDeputyByName, getDeputyExpenses, aggregateExpensesByCategory, getTopIndividualExpenses, analyzeFuelExpenses, FuelAnalysisResult, getDeputyStaff } from '../services/camaraDeputados';
import { searchFactChecks, FactCheckClaim } from '../services/factCheck';
import { getLinksConsulta, getResumoFontes, LinkConsulta, PORTAIS_PE } from '../services/transparenciaPE';

interface DetailViewProps {
  candidate: Politician;
  onBack: () => void;
}

interface RealAmendmentData {
  totalProposed: number;
  totalExecuted: number;
  topAreas: string[];
  geoDistribution: string[];
  history: AmendmentHistory[];
}

type SpendingFilter = 'TODOS' | 'REMUNERACAO' | 'CEAP' | 'EMENDAS';

const parseCurrency = (val: string) => {
  if (!val) return 0;
  return parseFloat(val.replace(/\./g, '').replace(',', '.'));
};

const DetailView: React.FC<DetailViewProps> = ({ candidate: politician, onBack }) => {
  
  // States ... (mantendo a mesma lógica de estados)
  const [isLoadingRealData, setIsLoadingRealData] = useState(false);
  const [realDataError, setRealDataError] = useState<string | null>(null);
  const [realAmendmentStats, setRealAmendmentStats] = useState<RealAmendmentData | null>(null);

  // Estado para novo sistema de emendas detalhado
  const [isLoadingEmendas, setIsLoadingEmendas] = useState(false);
  const [emendasError, setEmendasError] = useState<string | null>(null);
  const [resumoEmendas, setResumoEmendas] = useState<ResumoEmendasAutor | null>(null);
  const [showCSVViewer, setShowCSVViewer] = useState(false);

  const [isSyncingSalary, setIsSyncingSalary] = useState(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const [realSalaryData, setRealSalaryData] = useState<{name: string, amount: number}[] | null>(null);
  const [detailedSalaryData, setDetailedSalaryData] = useState<Remuneracao[] | null>(null);
  const [salarySourceInfo, setSalarySourceInfo] = useState<string>('');
  const [salaryYear, setSalaryYear] = useState<number>(2023);

  const [isSyncingCamara, setIsSyncingCamara] = useState(false);
  const [camaraError, setCamaraError] = useState<string | null>(null);
  const [ceapDataOverride, setCeapDataOverride] = useState<SpendingRecord[] | null>(null);
  const [ceapTopExpenses, setCeapTopExpenses] = useState<SpendingRecord[] | null>(null);
  const [fuelAnalysis, setFuelAnalysis] = useState<FuelAnalysisResult | null>(null);
  const [advisorStatsOverride, setAdvisorStatsOverride] = useState<AdvisorStats | null>(null);
  const [deputyPhotoOverride, setDeputyPhotoOverride] = useState<string | null>(null);

  const [isLoadingFactCheck, setIsLoadingFactCheck] = useState(false);
  const [factCheckError, setFactCheckError] = useState<string | null>(null);
  const [factChecks, setFactChecks] = useState<FactCheckClaim[] | null>(null);

  const [activeFilter, setActiveFilter] = useState<SpendingFilter>('TODOS');

  // Helper para normalizar amendments (pode ser array ou objeto)
  const normalizeAmendments = (amendments: typeof politician.amendments): RealAmendmentData => {
    if (Array.isArray(amendments)) {
      // Se for array, converte para o formato de objeto
      const totalProposed = amendments.reduce((sum, a) => sum + a.proposed, 0);
      const totalExecuted = amendments.reduce((sum, a) => sum + a.executed, 0);
      return {
        totalProposed,
        totalExecuted,
        topAreas: [],
        geoDistribution: [],
        history: amendments
      };
    }
    // Já é objeto, retorna diretamente
    return amendments;
  };

  // Computed Data
  const displaySalaryData = realSalaryData || (politician.salaryHistory ?? []).map(r => ({
    name: r.year.toString(),
    amount: r.amount,
  }));

  const displayAmendments = realAmendmentStats || normalizeAmendments(politician.amendments);
  const amendmentHistoryData = displayAmendments.history.map(h => ({
    year: h.year.toString(),
    proposed: h.proposed,
    executed: h.executed
  }));

  const ceapDisplayData = ceapDataOverride || (politician.ceapHistory ?? []);
  const advisorDisplayData = advisorStatsOverride || (politician.advisorStats ?? {
    totalAdvisors: 0,
    maxAdvisors: 0,
    monthlyCost: 0,
    maxMonthlyCost: 0
  });

  const AVAILABLE_YEARS = [2024, 2023, 2022, 2021, 2020];

  // Helper para identificar o tipo de político
  const getPoliticianType = (): 'deputado_federal' | 'senador' | 'governador' | 'prefeito' | 'deputado_estadual' | 'vereador' | 'outro' => {
    const role = (politician.currentRole ?? politician.position ?? '').toLowerCase();
    if (role.includes('deputado federal') || (role.includes('deputad') && politician.sphere === 'Federal')) return 'deputado_federal';
    if (role.includes('deputado estadual') || (role.includes('deputad') && politician.sphere === 'Estadual')) return 'deputado_estadual';
    if (role.includes('senador')) return 'senador';
    if (role.includes('governador')) return 'governador';
    if (role.includes('prefeito')) return 'prefeito';
    if (role.includes('vereador')) return 'vereador';
    return 'outro';
  };

  const politicianType = getPoliticianType();
  
  // Configuração dinâmica baseada no tipo de político
  const getTypeConfig = () => {
    switch (politicianType) {
      case 'deputado_federal':
        return {
          isLegislativo: true,
          remuneracaoTitulo: 'Subsídio Parlamentar',
          remuneracaoDescricao: 'Subsídio mensal fixo definido por decreto legislativo. Deputados federais recebem R$ 44.008,52/mês (2024).',
          fonteDados: 'Câmara dos Deputados',
          apiDisponivel: true,
          temCEAP: true,
          ceapTitulo: 'Cota Parlamentar (CEAP)',
          ceapDescricao: 'Cota para Exercício da Atividade Parlamentar - despesas de gabinete, passagens, combustível, etc.',
          temEmendas: true,
          emendasTitulo: 'Emendas Parlamentares',
          emendasDescricao: 'Emendas individuais, de bancada e de relator destinadas a Pernambuco.',
          temGabinete: true,
          gabineteTitulo: 'Verba de Gabinete',
          gabineteDescricao: 'Limite de 25 secretários parlamentares com verba mensal de até R$ 118.376,13.',
          portalUrl: 'https://www.camara.leg.br/deputados',
          subsidioFixo: 44008.52,
        };
      case 'senador':
        return {
          isLegislativo: true,
          remuneracaoTitulo: 'Subsídio Parlamentar',
          remuneracaoDescricao: 'Subsídio mensal fixo definido por decreto legislativo. Senadores recebem R$ 44.008,52/mês (2024).',
          fonteDados: 'Senado Federal',
          apiDisponivel: true,
          temCEAP: true,
          ceapTitulo: 'CEAPS - Cota do Senado',
          ceapDescricao: 'Cota para Exercício da Atividade Parlamentar dos Senadores.',
          temEmendas: true,
          emendasTitulo: 'Emendas Parlamentares',
          emendasDescricao: 'Emendas individuais e de bancada destinadas a Pernambuco.',
          temGabinete: true,
          gabineteTitulo: 'Verba de Gabinete',
          gabineteDescricao: 'Estrutura de gabinete do senador.',
          portalUrl: 'https://www12.senado.leg.br/transparencia',
          subsidioFixo: 44008.52,
        };
      case 'governador':
        return {
          isLegislativo: false,
          remuneracaoTitulo: 'Remuneração do Governador',
          remuneracaoDescricao: 'Subsídio definido pela Assembleia Legislativa de PE. Consulte o Portal de Transparência do Estado.',
          fonteDados: 'Portal da Transparência de PE',
          apiDisponivel: false,
          temCEAP: false,
          ceapTitulo: 'Despesas de Gabinete',
          ceapDescricao: 'Despesas do Gabinete do Governador.',
          temEmendas: false,
          emendasTitulo: 'Emendas Recebidas',
          emendasDescricao: 'Emendas parlamentares federais recebidas pelo estado.',
          temGabinete: false,
          gabineteTitulo: 'Estrutura de Governo',
          gabineteDescricao: 'Secretarias e órgãos do governo estadual.',
          portalUrl: 'https://transparencia.pe.gov.br',
          subsidioFixo: null,
        };
      case 'prefeito':
        return {
          isLegislativo: false,
          remuneracaoTitulo: 'Remuneração do Prefeito',
          remuneracaoDescricao: 'Subsídio definido pela Câmara Municipal. Consulte o Portal de Transparência do município.',
          fonteDados: politician.location?.includes('Recife') ? 'Portal da Transparência de Recife' : 'Portal da Transparência Municipal',
          apiDisponivel: false,
          temCEAP: false,
          ceapTitulo: 'Despesas de Gabinete',
          ceapDescricao: 'Despesas do Gabinete do Prefeito.',
          temEmendas: false,
          emendasTitulo: 'Transferências Recebidas',
          emendasDescricao: 'Transferências federais e estaduais recebidas pelo município.',
          temGabinete: false,
          gabineteTitulo: 'Estrutura da Prefeitura',
          gabineteDescricao: 'Secretarias municipais e órgãos da administração.',
          portalUrl: politician.location?.includes('Recife') ? 'https://transparencia.recife.pe.gov.br' : 'https://transparencia.pe.gov.br',
          subsidioFixo: null,
        };
      case 'deputado_estadual':
        return {
          isLegislativo: true,
          remuneracaoTitulo: 'Subsídio Parlamentar',
          remuneracaoDescricao: 'Subsídio definido pela Assembleia Legislativa de PE (75% do subsídio de deputado federal).',
          fonteDados: 'Assembleia Legislativa de PE',
          apiDisponivel: false,
          temCEAP: true,
          ceapTitulo: 'Verba Indenizatória',
          ceapDescricao: 'Verba para exercício da atividade parlamentar estadual.',
          temEmendas: true,
          emendasTitulo: 'Emendas Estaduais',
          emendasDescricao: 'Emendas ao orçamento estadual.',
          temGabinete: true,
          gabineteTitulo: 'Verba de Gabinete',
          gabineteDescricao: 'Estrutura de gabinete do deputado estadual.',
          portalUrl: 'https://www.alepe.pe.gov.br/transparencia',
          subsidioFixo: 33006.39, // 75% do federal
        };
      case 'vereador':
        return {
          isLegislativo: true,
          remuneracaoTitulo: 'Subsídio de Vereador',
          remuneracaoDescricao: 'Subsídio definido pela própria Câmara Municipal, limitado a percentual do subsídio de deputado estadual.',
          fonteDados: 'Câmara Municipal',
          apiDisponivel: false,
          temCEAP: false,
          ceapTitulo: 'Verba de Gabinete',
          ceapDescricao: 'Verba para exercício do mandato.',
          temEmendas: false,
          emendasTitulo: 'Emendas Municipais',
          emendasDescricao: 'Emendas impositivas ao orçamento municipal.',
          temGabinete: true,
          gabineteTitulo: 'Estrutura de Gabinete',
          gabineteDescricao: 'Assessores e estrutura do gabinete.',
          portalUrl: 'https://transparencia.recife.pe.gov.br',
          subsidioFixo: null,
        };
      default:
        return {
          isLegislativo: false,
          remuneracaoTitulo: 'Remuneração',
          remuneracaoDescricao: 'Consulte o portal de transparência correspondente.',
          fonteDados: 'Portal da Transparência',
          apiDisponivel: false,
          temCEAP: false,
          ceapTitulo: 'Despesas',
          ceapDescricao: 'Despesas relacionadas ao cargo.',
          temEmendas: false,
          emendasTitulo: 'Emendas/Transferências',
          emendasDescricao: 'Recursos destinados.',
          temGabinete: false,
          gabineteTitulo: 'Estrutura',
          gabineteDescricao: 'Estrutura administrativa.',
          portalUrl: 'https://portaldatransparencia.gov.br',
          subsidioFixo: null,
        };
    }
  };

  const typeConfig = getTypeConfig();
  const isLegislativo = typeConfig.isLegislativo;

  // --- Handlers (mantendo a lógica original) ---
  const handleSyncSalary = async () => {
    // Políticos com API não disponível devem consultar portais específicos
    if (!typeConfig.apiDisponivel || isLegislativo) {
      setSalaryError(`Dados de ${typeConfig.remuneracaoTitulo.toLowerCase()} não disponíveis via Portal da Transparência Federal. Fonte recomendada: ${typeConfig.fonteDados}`);
      return;
    }

    setIsSyncingSalary(true);
    setSalaryError(null);
    setRealSalaryData(null);
    setDetailedSalaryData(null);
    try {
      const servidor = await fetchServidorId(politician.name);
      if (!servidor) {
        setSalaryError("Servidor não encontrado na base do Poder Executivo Federal (Portal Transparência).");
        setIsSyncingSalary(false);
        return;
      }
      setSalarySourceInfo(`${servidor.orgaoServidorLotacao.nome} (${servidor.tipoServidor})`);
      const remuneracoes = await fetchRemuneracaoByYear(servidor.id, salaryYear);

      if (remuneracoes.length === 0) {
        setSalaryError(`Nenhum registro de remuneração encontrado para ${salaryYear}. Tente outro ano.`);
      } else {
        const sortedRemuneracoes = [...remuneracoes].sort((a, b) => a.mes - b.mes);
        setDetailedSalaryData(sortedRemuneracoes);
        const monthlyData = sortedRemuneracoes.map(r => {
            const bruto = parseCurrency(r.remuneracaoBasicaBruta);
            const outras = parseCurrency(r.outrasVerbasRemuneratorias);
            const indenizatorias = parseCurrency(r.verbasIndenizatorias);
            return {
              name: `${r.mes}/${r.ano}`,
              amount: bruto + outras + indenizatorias
            };
        });
        setRealSalaryData(monthlyData);
      }
    } catch (e) {
      setSalaryError("Erro ao conectar com Portal da Transparência.");
    } finally {
      setIsSyncingSalary(false);
    }
  };

  // Handler original (mantido para compatibilidade)
  const handleFetchRealData = async () => {
    setIsLoadingRealData(true);
    setRealDataError(null);
    try {
      const years = [2023, 2022, 2021, 2020];
      const results = await Promise.all(years.map(year => fetchAmendmentsByAuthor(politician.name, year)));
      const validResults = results.filter((r): r is DetailedAmendmentStats => r !== null);

      if (validResults.length === 0) {
        setRealDataError("Nenhum registro encontrado para este nome exato no Portal da Transparência.");
      } else {
        let totalProposed = 0;
        let totalExecuted = 0;
        const areaMap: Record<string, number> = {};
        const locationMap: Record<string, number> = {};
        const history: AmendmentHistory[] = validResults.map(r => {
          totalProposed += r.totalEmpenhado;
          totalExecuted += r.totalPago;
          Object.entries(r.areas).forEach(([area, val]) => { areaMap[area] = (areaMap[area] || 0) + val; });
          Object.entries(r.locations).forEach(([loc, val]) => { locationMap[loc] = (locationMap[loc] || 0) + val; });
          return { year: r.year, proposed: r.totalEmpenhado, executed: r.totalPago };
        }).sort((a, b) => b.year - a.year);

        const topAreas = Object.entries(areaMap).sort(([, a], [, b]) => b - a).slice(0, 3).map(([name]) => name);
        const geoDistribution = Object.entries(locationMap).sort(([, a], [, b]) => b - a).slice(0, 3).map(([name]) => name);

        setRealAmendmentStats({
          totalProposed,
          totalExecuted,
          topAreas: topAreas.length > 0 ? topAreas : ['Dados não categorizados'],
          geoDistribution: geoDistribution.length > 0 ? geoDistribution : ['Pernambuco'],
          history
        });
      }
    } catch (error: any) {
      setRealDataError("Erro de conexão com o Portal.");
    } finally {
      setIsLoadingRealData(false);
    }
  };

  // NOVO: Handler para buscar emendas detalhadas
  const handleFetchEmendasDetalhadas = async () => {
    setIsLoadingEmendas(true);
    setEmendasError(null);
    setResumoEmendas(null);
    
    try {
      const resumo = await fetchResumoEmendasAutor(politician.name, [2024, 2023, 2022, 2021, 2020]);
      
      if (!resumo) {
        setEmendasError("Nenhuma emenda encontrada para este parlamentar no Portal da Transparência.");
        return;
      }
      
      setResumoEmendas(resumo);
      
      // Também atualiza o estado antigo para compatibilidade com o gráfico
      if (resumo.historicoAnual.length > 0) {
        setRealAmendmentStats({
          totalProposed: resumo.valorTotalEmpenhado,
          totalExecuted: resumo.valorTotalPago,
          topAreas: resumo.porFuncao.slice(0, 3).map(f => f.funcao),
          geoDistribution: resumo.porLocalidade.slice(0, 3).map(l => l.localidade),
          history: resumo.historicoAnual.map(h => ({ year: h.ano, proposed: h.empenhado, executed: h.pago }))
        });
      }
    } catch (error: any) {
      setEmendasError("Erro ao consultar emendas no Portal da Transparência.");
      console.error('Erro ao buscar emendas:', error);
    } finally {
      setIsLoadingEmendas(false);
    }
  };

  const handleSyncCamara = async () => {
    if (politician.sphere !== 'Federal') return;
    setIsSyncingCamara(true);
    setCamaraError(null);
    setFuelAnalysis(null);
    setAdvisorStatsOverride(null);
    try {
      const deputy = await findDeputyByName(politician.name);
      if (!deputy) {
        setCamaraError(`Deputado "${politician.name}" não encontrado na base da Câmara.`);
        setIsSyncingCamara(false);
        return;
      }
      if (deputy.urlFoto) { setDeputyPhotoOverride(deputy.urlFoto); }
      const expensesPromise = getDeputyExpenses(deputy.id, 2023);
      const staffPromise = getDeputyStaff(deputy.id);
      const [expenses, staff] = await Promise.all([expensesPromise, staffPromise]);
      if (expenses.length === 0) {
        setCamaraError("Nenhuma despesa encontrada para o ano de referência (2023).");
      } else {
        const aggregated = aggregateExpensesByCategory(expenses);
        const topExpenses = getTopIndividualExpenses(expenses);
        const fuelStats = analyzeFuelExpenses(expenses);
        setCeapDataOverride(aggregated.slice(0, 5)); 
        setCeapTopExpenses(topExpenses);
        setFuelAnalysis(fuelStats);
        setAdvisorStatsOverride(staff);
      }
    } catch (e) {
      setCamaraError("Erro ao comunicar com a API da Câmara.");
    } finally {
      setIsSyncingCamara(false);
    }
  };

  const handleFetchFactCheck = async () => {
    setIsLoadingFactCheck(true);
    setFactCheckError(null);
    try {
      const results = await searchFactChecks(politician.name);
      if (results.length === 0) {
        setFactCheckError("Nenhuma checagem de fatos encontrada.");
        setFactChecks([]);
      } else {
        setFactChecks(results);
      }
    } catch (e: any) {
       setFactCheckError("Erro ao consultar serviço de Fact Check do Google.");
    } finally {
      setIsLoadingFactCheck(false);
    }
  };

  const FilterButton = ({ type, label, icon: Icon }: { type: SpendingFilter, label: string, icon?: React.ElementType }) => (
    <button
      onClick={() => setActiveFilter(type)}
      aria-pressed={activeFilter === type}
      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out-expo flex items-center gap-2 border focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
        activeFilter === type
          ? 'bg-slate-800 text-white border-slate-800 shadow-md'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
      }`}
    >
      {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
      {label}
    </button>
  );

  const getRatingBadge = (rating: string) => {
    const r = rating.toLowerCase();
    if (r.includes('falso') || r.includes('false') || r.includes('mentira')) return <span className="badge badge-danger"><XCircle className="w-3 h-3" aria-hidden="true" /> Falso</span>;
    if (r.includes('verdade') || r.includes('true')) return <span className="badge badge-success"><CheckCircle className="w-3 h-3" aria-hidden="true" /> Verdadeiro</span>;
    return <span className="badge badge-warning"><HelpCircle className="w-3 h-3" aria-hidden="true" /> {rating}</span>;
  };

  const getSeverityColor = (severity: string) => {
    switch(severity?.toUpperCase()) {
      case 'HIGH': return 'bg-rose-50 border-rose-200';
      case 'MEDIUM': return 'bg-amber-50 border-amber-200';
      case 'LOW': return 'bg-blue-50 border-blue-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const getSeverityInfo = (severity: string) => {
    switch(severity?.toUpperCase()) {
      case 'HIGH': return { label: 'Alto Risco', color: 'bg-rose-500', textColor: 'text-rose-700', icon: AlertOctagon };
      case 'MEDIUM': return { label: 'Atenção', color: 'bg-amber-500', textColor: 'text-amber-700', icon: AlertTriangle };
      case 'LOW': return { label: 'Baixo', color: 'bg-blue-500', textColor: 'text-blue-700', icon: Info };
      default: return { label: 'Info', color: 'bg-slate-500', textColor: 'text-slate-700', icon: Info };
    }
  };

  const getRedFlagCategory = (flag: typeof politician.redFlags[0]) => {
    const title = (flag.title || flag.description || '').toLowerCase();
    if (title.includes('cota') || title.includes('ceap') || title.includes('verba') || title.includes('gasto')) {
      return { name: 'Uso de Verbas', icon: Coins, color: 'text-amber-600' };
    }
    if (title.includes('processo') || title.includes('condenação') || title.includes('improbidade') || title.includes('criminal')) {
      return { name: 'Processo Judicial', icon: Siren, color: 'text-rose-600' };
    }
    if (title.includes('patrimônio') || title.includes('declaração') || title.includes('evolução')) {
      return { name: 'Patrimônio', icon: Building2, color: 'text-purple-600' };
    }
    if (title.includes('emenda') || title.includes('licitação') || title.includes('contrato')) {
      return { name: 'Contratações', icon: FileText, color: 'text-indigo-600' };
    }
    if (title.includes('assessor') || title.includes('funcionário') || title.includes('parente') || title.includes('nepotismo')) {
      return { name: 'Recursos Humanos', icon: Users, color: 'text-cyan-600' };
    }
    return { name: 'Outros', icon: ShieldAlert, color: 'text-slate-600' };
  };

  // Contadores de severidade
  const redFlagStats = {
    high: politician.redFlags?.filter(f => f.severity?.toUpperCase() === 'HIGH').length || 0,
    medium: politician.redFlags?.filter(f => f.severity?.toUpperCase() === 'MEDIUM').length || 0,
    low: politician.redFlags?.filter(f => f.severity?.toUpperCase() === 'LOW').length || 0,
    total: politician.redFlags?.length || 0,
  };

  return (
    <article className="animate-in pb-20" aria-labelledby="politician-name">
      {/* Back Button Floating */}
      <button 
        onClick={onBack}
        aria-label="Voltar para a lista de políticos"
        className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white p-4 rounded-full shadow-xl hover:bg-brand-600 transition-all duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 md:static md:bg-transparent md:text-brand-600 md:shadow-none md:p-0 md:hover:bg-transparent md:mb-6 md:flex md:items-center md:gap-2 md:font-semibold md:focus-visible:ring-brand-500 md:focus-visible:ring-offset-white"
      >
        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        <span className="hidden md:inline">Voltar para a lista</span>
      </button>

      {/* SEÇÃO 1 - PERFIL HERO */}
      <header className="card overflow-hidden mb-8">
        <div className="h-32 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
           <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px'}}></div>
        </div>
        <div className="px-6 md:px-8 pb-8">
          <div className="flex flex-col md:flex-row items-start md:items-end -mt-14 mb-8 gap-6 md:gap-8">
            <div className="relative flex-shrink-0">
              <img 
                src={deputyPhotoOverride || politician.photoUrl} 
                alt={`Foto de ${politician.name}`}
                className="w-32 h-32 md:w-40 md:h-40 rounded-2xl border-4 border-white shadow-lg bg-slate-100 object-cover"
                loading="eager"
              />
              <div className="absolute -bottom-2 -right-2 bg-white p-1.5 rounded-lg shadow-md border border-slate-100">
                <img 
                  src={PARTY_LOGOS[politician.party] || PARTY_LOGOS['DEFAULT']} 
                  alt={`Logo do partido ${politician.party}`}
                  className="w-8 h-8 object-contain"
                  onError={(e) => { e.currentTarget.src = PARTY_LOGOS['DEFAULT']; }}
                />
              </div>
            </div>
            
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 id="politician-name" className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">{politician.name}</h1>
                <EfficiencyBadge rating={politician.efficiencyRating} />
              </div>
              
              <div className="flex flex-wrap gap-2 text-sm" role="list" aria-label="Informações do político">
                <span role="listitem" className="px-3 py-1.5 bg-slate-100 rounded-full text-slate-700 font-medium border border-slate-200">{politician.currentRole ?? politician.position ?? 'Cargo não informado'}</span>
                <span role="listitem" className="px-3 py-1.5 bg-slate-100 rounded-full text-slate-700 font-medium border border-slate-200">{politician.sphere}</span>
                <span role="listitem" className="px-3 py-1.5 bg-slate-100 rounded-full text-slate-700 font-medium border border-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> {politician.location ?? politician.state ?? 'PE'}
                </span>
                
                {politician.candidacyStatus === CandidacyStatus.CONFIRMADA && (
                  <span role="listitem" className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full font-bold border border-emerald-200 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" aria-hidden="true" /> Candidato: {politician.disputedRole}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-6 border-t border-slate-100" role="list" aria-label="Métricas financeiras">
            <div role="listitem" className="metric-card bg-slate-50/80 border-slate-100 hover:border-brand-200 transition-all duration-200">
              <div className="flex items-center gap-1.5 mb-1">
                 <p className="metric-label">Total (10 Anos)</p>
                 <Tooltip content="Soma de todos os gastos de gabinete, emendas e salários declarados na última década." position="bottom">
                   <Info className="w-3 h-3 text-slate-400 cursor-help" aria-label="Mais informações" />
                 </Tooltip>
              </div>
              <p className="text-lg md:text-2xl font-black text-brand-700 truncate" title={FORMATTER_BRL.format(politician.totalSpending10Years ?? 0)}>
                {FORMATTER_BRL.format(politician.totalSpending10Years ?? 0)}
              </p>
            </div>
            <div role="listitem" className="metric-card bg-slate-50/80 border-slate-100 hover:border-brand-200 transition-all duration-200">
              <div className="flex items-center gap-1.5 mb-1">
                 <p className="metric-label">Custo / Eleitor</p>
                 <Tooltip content="Quanto o mandato deste político custou para cada eleitor da sua região/estado." position="bottom">
                   <Info className="w-3 h-3 text-slate-400 cursor-help" aria-label="Mais informações" />
                 </Tooltip>
              </div>
              <p className="text-lg md:text-2xl font-black text-slate-800">R$ {(politician.spendingPerCapita ?? 0).toFixed(2)}</p>
            </div>
            <div role="listitem" className="metric-card bg-slate-50/80 border-slate-100 hover:border-brand-200 transition-all duration-200">
              <p className="metric-label mb-1">Tendência</p>
              <div className="flex items-center gap-2">
                 <p className="text-lg md:text-2xl font-black text-slate-800">{politician.spendingTrend ?? 'N/D'}</p>
                 {politician.spendingTrend === 'Crescente' && <span className="w-2.5 h-2.5 rounded-full bg-rose-500" aria-label="Tendência negativa"></span>}
                 {politician.spendingTrend === 'Decrescente' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" aria-label="Tendência positiva"></span>}
              </div>
            </div>
            <div role="listitem" className="metric-card bg-slate-50/80 border-slate-100 hover:border-brand-200 transition-all duration-200">
              <div className="flex items-center gap-1.5 mb-1">
                 <p className="metric-label">Vs. Partido</p>
                 <Tooltip content="Comparação percentual dos gastos deste político em relação à média dos colegas do mesmo partido." position="bottom">
                   <Info className="w-3 h-3 text-slate-400 cursor-help" aria-label="Mais informações" />
                 </Tooltip>
              </div>
              <p className={`text-lg md:text-2xl font-black ${(politician.partyAverageComparison ?? 1) > 1 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {(((politician.partyAverageComparison ?? 1) - 1) * 100).toFixed(0)}% <span className="text-sm font-semibold">{(politician.partyAverageComparison ?? 1) > 1 ? 'Acima' : 'Abaixo'}</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* COLUNA ESQUERDA - DADOS FINANCEIROS */}
        <div className="xl:col-span-2 space-y-8">
          
          <div className="flex items-center justify-between sticky top-20 z-30 bg-slate-50/90 backdrop-blur py-4 border-b border-slate-200 mb-4">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
               <Database className="w-6 h-6 text-brand-600" />
               Raio-X Financeiro
            </h2>
          </div>

          <div className="flex flex-wrap gap-3 pb-2">
            <FilterButton type="TODOS" label="Visão Geral" />
            <FilterButton type="REMUNERACAO" label="Salários" icon={FileText} />
            <FilterButton type="CEAP" label="Cota (CEAP)" icon={Building2} />
            <FilterButton type="EMENDAS" label="Emendas" icon={Globe} />
          </div>

          {(activeFilter === 'TODOS' || activeFilter === 'REMUNERACAO') && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:border-brand-100 transition-colors">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-brand-500" />
                    {typeConfig.remuneracaoTitulo}
                  </h3>
                  <p className="text-sm text-slate-500">{typeConfig.remuneracaoDescricao}</p>
                </div>
                
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                   <div className="relative">
                      <select 
                        className="bg-transparent text-xs font-semibold text-slate-700 py-1.5 pl-2 pr-6 rounded-lg focus:outline-none cursor-pointer"
                        value={salaryYear}
                        onChange={(e) => setSalaryYear(Number(e.target.value))}
                        disabled={isSyncingSalary || !typeConfig.apiDisponivel}
                      >
                        {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <Calendar className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                   </div>
                   <div className="w-px h-6 bg-slate-200"></div>
                   {!typeConfig.apiDisponivel ? (
                     <a 
                       href={typeConfig.portalUrl} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="text-xs px-3 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-2 transition"
                     >
                       <ExternalLink className="w-3 h-3" />
                       Consultar {typeConfig.fonteDados}
                     </a>
                   ) : isLegislativo ? (
                     <span className="text-xs px-3 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-500 flex items-center gap-2">
                       <Info className="w-3 h-3" />
                       Dados via {typeConfig.fonteDados}
                     </span>
                   ) : (
                     <button 
                      onClick={handleSyncSalary}
                      disabled={isSyncingSalary}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition ${
                        realSalaryData 
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-brand-600 text-white hover:bg-brand-700 shadow-md'
                      }`}
                    >
                      {isSyncingSalary ? <RefreshCw className="w-3 h-3 animate-spin" /> : realSalaryData ? <CheckCircle className="w-3 h-3" /> : <Database className="w-3 h-3" />}
                      {isSyncingSalary ? 'Sincronizando...' : 'Conectar Portal'}
                    </button>
                   )}
                </div>
              </div>

              {/* Banner informativo baseado no tipo de político */}
              <div className="mb-6 bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-500" />
                <div>
                  <p className="font-semibold">Fonte: {typeConfig.fonteDados}</p>
                  <p className="text-blue-600 mt-1">
                    {typeConfig.remuneracaoDescricao}
                    {typeConfig.subsidioFixo && (
                      <span className="block mt-1 font-medium">
                        Subsídio atual: {FORMATTER_BRL.format(typeConfig.subsidioFixo)}/mês
                      </span>
                    )}
                  </p>
                  {!typeConfig.apiDisponivel && (
                    <a 
                      href={typeConfig.portalUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1 mt-2 text-brand-600 hover:text-brand-700 font-semibold"
                    >
                      Acessar portal oficial <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {salaryError && (
                <div className="mb-6 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>{salaryError}</span>
                </div>
              )}

              <div className="h-72 w-full mb-8" style={{ minHeight: '288px' }}>
                <ResponsiveContainer width="100%" height={288} minWidth={300}>
                  <BarChart data={displaySalaryData.length > 0 ? displaySalaryData : [{ name: 'N/A', amount: 0 }]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(val) => `R$${val/1000}k`} tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      cursor={{fill: '#f1f5f9'}}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                      formatter={(value: number) => [FORMATTER_BRL.format(value), 'Valor']}
                    />
                    <Bar dataKey="amount" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={40}>
                      {displaySalaryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === displaySalaryData.length - 1 ? '#0284c7' : '#bae6fd'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {detailedSalaryData && detailedSalaryData.length > 0 && (
                <div className="overflow-hidden border border-slate-100 rounded-xl bg-slate-50/50">
                   <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-sm flex items-center gap-2">
                     <FileText className="w-4 h-4" /> Detalhamento {salaryYear}
                   </div>
                   <div className="overflow-x-auto">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Mês</th>
                          <th className="px-4 py-3 text-right">Bruto</th>
                          <th className="px-4 py-3 text-right">Indenizações</th>
                          <th className="px-4 py-3 text-right">Outros</th>
                          <th className="px-4 py-3 text-right text-slate-800">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {detailedSalaryData.map((item, idx) => {
                          const bruto = parseCurrency(item.remuneracaoBasicaBruta);
                          const indenizatorias = parseCurrency(item.verbasIndenizatorias);
                          const outras = parseCurrency(item.outrasVerbasRemuneratorias);
                          const total = bruto + indenizatorias + outras;
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-600">{item.mes}/{item.ano}</td>
                              <td className="px-4 py-3 text-right text-slate-500">{FORMATTER_BRL.format(bruto)}</td>
                              <td className="px-4 py-3 text-right text-slate-500">{FORMATTER_BRL.format(indenizatorias)}</td>
                              <td className="px-4 py-3 text-right text-slate-500">{FORMATTER_BRL.format(outras)}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800">{FORMATTER_BRL.format(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CEAP SECTION - Apenas para tipos com cota parlamentar */}
          {(activeFilter === 'TODOS' || activeFilter === 'CEAP') && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
               <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-brand-500" />
                      {typeConfig.ceapTitulo}
                    </h3>
                    <p className="text-sm text-slate-500">{typeConfig.ceapDescricao}</p>
                 </div>
                 {typeConfig.temCEAP && politician.sphere === 'Federal' && (
                    <button 
                      onClick={handleSyncCamara}
                      disabled={isSyncingCamara}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition ${
                        ceapDataOverride ? 'bg-blue-100 text-blue-700' : 'bg-slate-800 text-white'
                      }`}
                    >
                      {isSyncingCamara ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Download className="w-3 h-3"/>}
                      {ceapDataOverride ? 'Atualizado' : 'Baixar Dados'}
                    </button>
                 )}
                 {!typeConfig.temCEAP && (
                   <a 
                     href={typeConfig.portalUrl} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="text-xs px-3 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-2 transition"
                   >
                     <ExternalLink className="w-3 h-3" />
                     Ver no Portal
                   </a>
                 )}
               </div>

               {/* Mensagem para políticos sem CEAP */}
               {!typeConfig.temCEAP && (
                 <div className="mb-6 bg-amber-50 border border-amber-100 text-amber-800 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                   <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-500" />
                   <div>
                     <p className="font-semibold">Dados não disponíveis via API</p>
                     <p className="text-amber-600 mt-1">
                       {politicianType === 'governador' && 'Despesas do Governo de Pernambuco devem ser consultadas no Portal da Transparência Estadual.'}
                       {politicianType === 'prefeito' && 'Despesas da Prefeitura devem ser consultadas no Portal da Transparência Municipal.'}
                       {politicianType === 'vereador' && 'Despesas de vereadores devem ser consultadas no Portal da Câmara Municipal.'}
                       {politicianType === 'outro' && 'Consulte o portal de transparência correspondente ao cargo.'}
                     </p>
                     <a 
                       href={typeConfig.portalUrl} 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       className="inline-flex items-center gap-1 mt-2 text-amber-700 hover:text-amber-900 font-semibold"
                     >
                       Acessar portal oficial <ExternalLink className="w-3 h-3" />
                     </a>
                   </div>
                 </div>
               )}

               {/* Fuel Warnings Card */}
               {fuelAnalysis && fuelAnalysis.warnings.length > 0 && (
                 <div className="mb-6 bg-amber-50 border border-amber-100 rounded-2xl p-5">
                   <h4 className="text-amber-900 font-bold text-sm flex items-center gap-2 mb-3">
                     <AlertTriangle className="w-4 h-4" />
                     Anomalias Detectadas (Combustível)
                   </h4>
                   <ul className="space-y-2">
                     {fuelAnalysis.warnings.map((warn, i) => (
                       <li key={i} className="text-xs text-amber-800 flex items-start gap-2 bg-white/50 p-2 rounded-lg">
                         <span className="mt-1 min-w-[6px] h-[6px] bg-amber-500 rounded-full"></span>
                         {warn}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}

               <div className="overflow-hidden border border-slate-100 rounded-xl">
                 <table className="min-w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3">Categoria</th>
                        <th className="px-5 py-3">Descrição</th>
                        <th className="px-5 py-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {ceapDisplayData.map((rec, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-700">{rec.category}</td>
                          <td className="px-5 py-3 text-slate-500 text-xs">{rec.description}</td>
                          <td className="px-5 py-3 text-right font-bold text-slate-800">{FORMATTER_BRL.format(rec.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
          )}

           {/* EMENDAS SECTION - VERSÃO EXPANDIDA */}
           {(activeFilter === 'TODOS' || activeFilter === 'EMENDAS') && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
               <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                 <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Landmark className="w-5 h-5 text-brand-500" />
                      {typeConfig.emendasTitulo}
                    </h3>
                    <p className="text-sm text-slate-500">{typeConfig.emendasDescricao}</p>
                 </div>
                 {typeConfig.temEmendas && politician.sphere === 'Federal' && (
                   <div className="flex items-center gap-2">
                     <button 
                       onClick={handleFetchEmendasDetalhadas} 
                       disabled={isLoadingEmendas} 
                       className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition ${
                         resumoEmendas ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-600 text-white hover:bg-brand-700'
                       }`}
                     >
                        {isLoadingEmendas ? <RefreshCw className="w-3 h-3 animate-spin"/> : resumoEmendas ? <CheckCircle className="w-3 h-3"/> : <Database className="w-3 h-3"/>}
                        {isLoadingEmendas ? 'Buscando...' : resumoEmendas ? 'Atualizado' : 'Buscar Emendas'}
                     </button>
                     <button 
                       onClick={() => setShowCSVViewer(true)}
                       className="text-xs px-3 py-1.5 rounded-lg font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center gap-2 transition"
                     >
                       <Upload className="w-3 h-3" />
                       Analisar CSV
                     </button>
                     <a 
                       href={getUrlConsultaEmendas(politician.name)} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="text-xs px-3 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-2 transition"
                     >
                       <ExternalLink className="w-3 h-3" />
                       Ver no Portal
                     </a>
                   </div>
                 )}
                 {!typeConfig.temEmendas && (
                   <a 
                     href={typeConfig.portalUrl} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="text-xs px-3 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-2 transition"
                   >
                     <ExternalLink className="w-3 h-3" />
                     Ver no Portal
                   </a>
                 )}
               </div>

               {/* Mensagem para políticos sem emendas parlamentares */}
               {!typeConfig.temEmendas && (
                 <div className="mb-6 bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                   <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-500" />
                   <div>
                     <p className="font-semibold">Informação sobre transferências</p>
                     <p className="text-blue-600 mt-1">
                       {politicianType === 'governador' && 'Emendas parlamentares federais recebidas pelo Estado de PE podem ser consultadas no Portal da Transparência.'}
                       {politicianType === 'prefeito' && 'Transferências federais e estaduais recebidas pelo município podem ser consultadas no Portal da Transparência.'}
                       {politicianType === 'vereador' && 'Vereadores podem propor emendas impositivas ao orçamento municipal. Consulte a Câmara Municipal.'}
                       {politicianType === 'deputado_estadual' && 'Emendas ao orçamento estadual podem ser consultadas no portal da ALEPE.'}
                       {politicianType === 'outro' && 'Consulte o portal de transparência correspondente.'}
                     </p>
                     <a 
                       href={typeConfig.portalUrl} 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       className="inline-flex items-center gap-1 mt-2 text-brand-600 hover:text-brand-700 font-semibold"
                     >
                       Acessar portal oficial <ExternalLink className="w-3 h-3" />
                     </a>
                   </div>
                 </div>
               )}

               {/* Erro ao buscar - mostrar recursos alternativos */}
               {emendasError && (
                 <div className="mb-6 bg-amber-50 border border-amber-100 text-amber-800 px-4 py-4 rounded-xl text-sm">
                   <div className="flex items-start gap-3 mb-4">
                     <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-500" />
                     <div>
                       <p className="font-semibold">{emendasError}</p>
                       <p className="text-amber-600 mt-1 text-xs">
                         A API pode estar temporariamente indisponível (CORS) ou não há dados para este parlamentar. Use os recursos abaixo:
                       </p>
                     </div>
                   </div>
                   
                   {/* Recursos alternativos */}
                   <div className="bg-white/50 rounded-lg p-4 space-y-4">
                     <h5 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                       <Database className="w-4 h-4" />
                       Fontes de Dados do Portal da Transparência
                     </h5>
                     
                     {/* Consulta Online */}
                     <div className="space-y-2">
                       <p className="text-xs font-semibold text-amber-800">🔍 Consulta Online</p>
                       <div className="flex flex-wrap gap-2">
                         <a 
                           href={getUrlConsultaEmendas(politician.name, 2024)} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition border border-amber-200"
                         >
                           <Search className="w-3 h-3" /> Buscar emendas 2024
                         </a>
                         <a 
                           href={getUrlConsultaEmendas(politician.name, 2023)} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition border border-amber-200"
                         >
                           <Search className="w-3 h-3" /> Buscar emendas 2023
                         </a>
                         <a 
                           href={`${PORTAL_URLS.transferencias}?uf=PE&de=${encodeURIComponent(politician.name)}`}
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition border border-amber-200"
                         >
                           <MapPin className="w-3 h-3" /> Transferências para PE
                         </a>
                       </div>
                     </div>

                     {/* Download de Dados */}
                     <div className="space-y-2">
                       <p className="text-xs font-semibold text-amber-800">📥 Download de Dados (CSV)</p>
                       <div className="flex flex-wrap gap-2">
                         <a 
                           href={DOWNLOAD_URLS.emendas(2024)} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition border border-amber-200"
                         >
                           <FileDown className="w-3 h-3" /> Emendas 2024 (CSV)
                         </a>
                         <a 
                           href={DOWNLOAD_URLS.emendas(2023)} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition border border-amber-200"
                         >
                           <FileDown className="w-3 h-3" /> Emendas 2023 (CSV)
                         </a>
                         <a 
                           href={PORTAL_URLS.downloadDados} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition border border-amber-200"
                         >
                           <Database className="w-3 h-3" /> Todos os downloads
                         </a>
                       </div>
                     </div>

                     {/* API */}
                     <div className="space-y-2">
                       <p className="text-xs font-semibold text-amber-800">🔗 API (para desenvolvedores)</p>
                       <div className="flex flex-wrap gap-2">
                         <a 
                           href={PORTAL_URLS.api} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition border border-amber-200"
                         >
                           <Code className="w-3 h-3" /> Documentação API
                         </a>
                         <a 
                           href={`https://api.portaldatransparencia.gov.br/api-de-dados/emendas?nomeAutor=${encodeURIComponent(politician.name)}&ano=2024&pagina=1`} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition border border-amber-200"
                         >
                           <FileJson className="w-3 h-3" /> Exemplo JSON
                         </a>
                       </div>
                       <p className="text-[10px] text-amber-600 mt-1">
                         A API requer chave de acesso. Cadastre-se em dados.gov.br para obter a sua.
                       </p>
                     </div>

                     {/* Análise CSV */}
                     <div className="mt-4 pt-4 border-t border-amber-200">
                       <button
                         onClick={() => setShowCSVViewer(true)}
                         className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition"
                       >
                         <Upload className="w-4 h-4" />
                         Analisar CSV Baixado (com gráficos)
                       </button>
                       <p className="text-[10px] text-amber-600 mt-2 text-center">
                         Baixe o CSV do Portal e faça upload para análise visual completa
                       </p>
                     </div>
                   </div>
                 </div>
               )}

               {/* RESUMO DETALHADO DE EMENDAS */}
               {resumoEmendas && (
                 <>
                   {/* Alertas */}
                   {resumoEmendas.alertas.length > 0 && (
                     <div className="mb-6 bg-amber-50 border border-amber-100 rounded-2xl p-5">
                       <h4 className="text-amber-900 font-bold text-sm flex items-center gap-2 mb-3">
                         <AlertTriangle className="w-4 h-4" />
                         Pontos de Atenção
                       </h4>
                       <ul className="space-y-2">
                         {resumoEmendas.alertas.map((alerta, i) => (
                           <li key={i} className="text-xs text-amber-800 flex items-start gap-2 bg-white/50 p-2 rounded-lg">
                             <span className="mt-1 min-w-[6px] h-[6px] bg-amber-500 rounded-full"></span>
                             {alerta}
                           </li>
                         ))}
                       </ul>
                     </div>
                   )}

                   {/* Cards de Resumo */}
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                     <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100 text-center">
                       <Coins className="w-5 h-5 text-brand-600 mx-auto mb-2" />
                       <span className="text-2xl font-black text-brand-700">{resumoEmendas.totalEmendas}</span>
                       <p className="text-xs font-medium text-brand-600 mt-1">Emendas</p>
                     </div>
                     <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                       <TrendingUp className="w-5 h-5 text-emerald-600 mx-auto mb-2" />
                       <span className="text-2xl font-black text-emerald-700">{formatarValorEmenda(resumoEmendas.valorTotalEmpenhado)}</span>
                       <p className="text-xs font-medium text-emerald-600 mt-1">Empenhado</p>
                     </div>
                     <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                       <CheckCircle className="w-5 h-5 text-blue-600 mx-auto mb-2" />
                       <span className="text-2xl font-black text-blue-700">{formatarValorEmenda(resumoEmendas.valorTotalPago)}</span>
                       <p className="text-xs font-medium text-blue-600 mt-1">Pago</p>
                     </div>
                     <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                       <BarChart2 className="w-5 h-5 text-slate-600 mx-auto mb-2" />
                       <span className={`text-2xl font-black ${resumoEmendas.percentualExecucao > 70 ? 'text-emerald-600' : resumoEmendas.percentualExecucao > 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                         {resumoEmendas.percentualExecucao}%
                       </span>
                       <p className="text-xs font-medium text-slate-500 mt-1">Execução</p>
                     </div>
                   </div>

                   {/* Por Tipo de Emenda */}
                   <div className="mb-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                     <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                       <PieChartIcon className="w-4 h-4 text-brand-500" />
                       Distribuição por Tipo
                     </h4>
                     <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                       {[
                         { label: 'Individual', valor: resumoEmendas.porTipo.individual, cor: 'bg-brand-100 text-brand-700 border-brand-200' },
                         { label: 'Bancada', valor: resumoEmendas.porTipo.bancada, cor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                         { label: 'Comissão', valor: resumoEmendas.porTipo.comissao, cor: 'bg-blue-100 text-blue-700 border-blue-200' },
                         { label: 'Relator', valor: resumoEmendas.porTipo.relator, cor: 'bg-amber-100 text-amber-700 border-amber-200' },
                         { label: 'Transf. Esp.', valor: resumoEmendas.porTipo.transferenciasEspeciais, cor: 'bg-purple-100 text-purple-700 border-purple-200' },
                       ].filter(t => t.valor > 0).map((tipo, i) => (
                         <div key={i} className={`p-3 rounded-xl border ${tipo.cor} text-center`}>
                           <p className="text-lg font-bold">{formatarValorEmenda(tipo.valor)}</p>
                           <p className="text-xs font-medium mt-1">{tipo.label}</p>
                         </div>
                       ))}
                     </div>
                   </div>

                   {/* Top Funções/Áreas */}
                   {resumoEmendas.porFuncao.length > 0 && (
                     <div className="mb-6">
                       <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                         <Building2 className="w-4 h-4 text-brand-500" />
                         Principais Áreas (Funções)
                       </h4>
                       <div className="overflow-hidden border border-slate-100 rounded-xl">
                         <table className="min-w-full text-sm">
                           <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase">
                             <tr>
                               <th className="px-4 py-3 text-left">Função</th>
                               <th className="px-4 py-3 text-right">Empenhado</th>
                               <th className="px-4 py-3 text-right">Pago</th>
                               <th className="px-4 py-3 text-center">Qtd.</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 bg-white">
                             {resumoEmendas.porFuncao.slice(0, 5).map((funcao, i) => (
                               <tr key={i} className="hover:bg-slate-50">
                                 <td className="px-4 py-3 font-medium text-slate-700">{funcao.funcao}</td>
                                 <td className="px-4 py-3 text-right text-slate-600">{FORMATTER_BRL.format(funcao.valorEmpenhado)}</td>
                                 <td className="px-4 py-3 text-right text-slate-600">{FORMATTER_BRL.format(funcao.valorPago)}</td>
                                 <td className="px-4 py-3 text-center">
                                   <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs font-medium">{funcao.quantidade}</span>
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     </div>
                   )}

                   {/* Distribuição Geográfica */}
                   {resumoEmendas.porLocalidade.length > 0 && (
                     <div className="mb-6">
                       <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                         <MapPinned className="w-4 h-4 text-brand-500" />
                         Distribuição Geográfica
                       </h4>
                       <div className="flex flex-wrap gap-2">
                         {resumoEmendas.porLocalidade.slice(0, 10).map((loc, i) => (
                           <div 
                             key={i} 
                             className={`px-3 py-2 rounded-xl border text-xs font-medium ${
                               loc.isPernambuco || loc.isRecife 
                                 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                 : 'bg-white border-slate-200 text-slate-600'
                             }`}
                           >
                             <span className="font-bold">{loc.localidade}</span>
                             <span className="ml-2 opacity-75">{formatarValorEmenda(loc.valorTotal)}</span>
                             {(loc.isPernambuco || loc.isRecife) && (
                               <span className="ml-1">🏠</span>
                             )}
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {/* Fontes de Dados - Links para Portal */}
                   <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                     <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                       <Database className="w-4 h-4" />
                       Fontes de Dados Oficiais
                     </h4>
                     <p className="text-xs text-blue-600 mb-3">
                       Dados obtidos via API do Portal da Transparência. Explore mais recursos:
                     </p>
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                       <a 
                         href={getUrlConsultaEmendas(politician.name, 2024)} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="flex flex-col items-center gap-1 p-3 bg-white rounded-xl border border-blue-100 hover:border-blue-300 hover:shadow-sm transition text-center group"
                       >
                         <Search className="w-4 h-4 text-blue-500 group-hover:text-blue-600" />
                         <span className="text-[10px] font-medium text-blue-700">Consulta Online</span>
                       </a>
                       <a 
                         href={DOWNLOAD_URLS.emendas(2024)} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="flex flex-col items-center gap-1 p-3 bg-white rounded-xl border border-blue-100 hover:border-blue-300 hover:shadow-sm transition text-center group"
                       >
                         <FileDown className="w-4 h-4 text-blue-500 group-hover:text-blue-600" />
                         <span className="text-[10px] font-medium text-blue-700">Download CSV</span>
                       </a>
                       <a 
                         href={PORTAL_URLS.api} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="flex flex-col items-center gap-1 p-3 bg-white rounded-xl border border-blue-100 hover:border-blue-300 hover:shadow-sm transition text-center group"
                       >
                         <Code className="w-4 h-4 text-blue-500 group-hover:text-blue-600" />
                         <span className="text-[10px] font-medium text-blue-700">API Swagger</span>
                       </a>
                       <a 
                         href={PORTAL_URLS.downloadDados} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="flex flex-col items-center gap-1 p-3 bg-white rounded-xl border border-blue-100 hover:border-blue-300 hover:shadow-sm transition text-center group"
                       >
                         <Database className="w-4 h-4 text-blue-500 group-hover:text-blue-600" />
                         <span className="text-[10px] font-medium text-blue-700">Todos Downloads</span>
                       </a>
                     </div>
                   </div>
                 </>
               )}

               {/* DADOS SIMPLIFICADOS (quando não há dados detalhados) */}
               {!resumoEmendas && (
                 <>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                      <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100 flex flex-col justify-center items-center text-center">
                        <span className="text-3xl font-black text-brand-600">
                          {displayAmendments.totalProposed > 0 ? Math.round((displayAmendments.totalExecuted / displayAmendments.totalProposed) * 100) : 0}%
                        </span>
                        <span className="text-xs font-bold text-brand-800 uppercase tracking-wide mt-1">Execução Financeira</span>
                      </div>
                      <div className="md:col-span-2 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                         <p className="text-xs font-bold text-slate-400 uppercase mb-3">Principais Destinos</p>
                         <div className="flex flex-wrap gap-2">
                            {displayAmendments.topAreas.map((area, i) => (
                              <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 shadow-sm">{area}</span>
                            ))}
                         </div>
                      </div>
                   </div>
                 </>
               )}

               {/* Gráfico de Histórico */}
               <div className="mt-6">
                 <h4 className="text-sm font-bold text-slate-700 mb-3">Evolução Anual</h4>
                 <div className="h-64 w-full" style={{ minHeight: '256px' }}>
                   <ResponsiveContainer width="100%" height={256} minWidth={300}>
                      <BarChart data={amendmentHistoryData.length > 0 ? amendmentHistoryData : [{ year: 'N/A', proposed: 0, executed: 0 }]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                        <YAxis hide />
                      <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                      <Legend />
                      <Bar dataKey="proposed" name="Empenhado" fill="#cbd5e1" radius={[4,4,0,0]} barSize={20} />
                      <Bar dataKey="executed" name="Pago" fill="#0ea5e9" radius={[4,4,0,0]} barSize={20} />
                    </BarChart>
                   </ResponsiveContainer>
                 </div>
               </div>
            </div>
           )}

        </div>

        {/* COLUNA DIREITA - ALERTA E CONTEXTO */}
        <div className="space-y-8">
           
           {/* RED FLAGS CARD - APRIMORADO */}
           <div className={`rounded-3xl border shadow-sm relative overflow-hidden ${
             redFlagStats.high > 0 
               ? 'bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200' 
               : redFlagStats.total > 0 
                 ? 'bg-gradient-to-br from-amber-50 to-amber-100/30 border-amber-200'
                 : 'bg-gradient-to-br from-emerald-50 to-emerald-100/30 border-emerald-200'
           }`}>
              {/* Header com Score Visual */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${
                      redFlagStats.high > 0 
                        ? 'bg-rose-200 text-rose-700' 
                        : redFlagStats.total > 0 
                          ? 'bg-amber-200 text-amber-700'
                          : 'bg-emerald-200 text-emerald-700'
                    }`}>
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className={`text-xl font-bold ${
                        redFlagStats.high > 0 ? 'text-rose-900' : redFlagStats.total > 0 ? 'text-amber-900' : 'text-emerald-900'
                      }`}>
                        Pontos de Atenção
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Análise de integridade e transparência</p>
                    </div>
                  </div>
                  
                  {/* Score Indicator */}
                  <div className={`px-4 py-2 rounded-2xl text-center ${
                    redFlagStats.high > 0 
                      ? 'bg-rose-200/80' 
                      : redFlagStats.total > 0 
                        ? 'bg-amber-200/80'
                        : 'bg-emerald-200/80'
                  }`}>
                    <span className={`text-2xl font-black ${
                      redFlagStats.high > 0 ? 'text-rose-700' : redFlagStats.total > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}>
                      {redFlagStats.total}
                    </span>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${
                      redFlagStats.high > 0 ? 'text-rose-600' : redFlagStats.total > 0 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {redFlagStats.total === 0 ? 'Limpo' : redFlagStats.total === 1 ? 'Alerta' : 'Alertas'}
                    </p>
                  </div>
                </div>

                {/* Severity Breakdown */}
                {redFlagStats.total > 0 && (
                  <div className="flex gap-2 mb-4">
                    {redFlagStats.high > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                        <span className="text-xs font-bold text-rose-700">{redFlagStats.high} Alto Risco</span>
                      </div>
                    )}
                    {redFlagStats.medium > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span className="text-xs font-bold text-amber-700">{redFlagStats.medium} Atenção</span>
                      </div>
                    )}
                    {redFlagStats.low > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-xs font-bold text-blue-700">{redFlagStats.low} Baixo</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Summary */}
                <div className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-white/50 shadow-sm">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {politician.redFlagsSummary}
                  </p>
                </div>
              </div>

              {/* Red Flags List */}
              <div className="px-6 pb-6">
                {(politician.redFlags ?? []).length > 0 ? (
                  <div className="space-y-3">
                    {(politician.redFlags ?? []).map((flag) => {
                      const severityInfo = getSeverityInfo(flag.severity);
                      const category = getRedFlagCategory(flag);
                      const SeverityIcon = severityInfo.icon;
                      const CategoryIcon = category.icon;
                      
                      return (
                        <div 
                          key={flag.id || flag.description} 
                          className={`p-4 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow ${getSeverityColor(flag.severity)}`}
                        >
                          <div className="flex gap-4">
                            {/* Severity Icon */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                              flag.severity?.toUpperCase() === 'HIGH' 
                                ? 'bg-rose-100' 
                                : flag.severity?.toUpperCase() === 'MEDIUM' 
                                  ? 'bg-amber-100' 
                                  : 'bg-blue-100'
                            }`}>
                              <SeverityIcon className={`w-5 h-5 ${severityInfo.textColor}`} />
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Header with Category & Severity */}
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                  flag.severity?.toUpperCase() === 'HIGH' 
                                    ? 'bg-rose-100 text-rose-700' 
                                    : flag.severity?.toUpperCase() === 'MEDIUM' 
                                      ? 'bg-amber-100 text-amber-700' 
                                      : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {severityInfo.label}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 ${category.color}`}>
                                  <CategoryIcon className="w-3 h-3" />
                                  {category.name}
                                </span>
                                {flag.date && (
                                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(flag.date).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>
                              
                              {/* Title & Description */}
                              <h4 className="font-bold text-sm text-slate-800 mb-1">
                                {flag.title || 'Ponto de Atenção'}
                              </h4>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {flag.description}
                              </p>
                              
                              {/* Source */}
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <Database className="w-3 h-3" />
                                  Fonte: {flag.source}
                                </span>
                                {flag.sourceUrl && (
                                  <a 
                                    href={flag.sourceUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-bold text-brand-600 uppercase tracking-wide flex items-center gap-1 hover:text-brand-700 transition-colors"
                                  >
                                    Verificar <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-5 bg-emerald-100/80 border border-emerald-200 rounded-2xl">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-emerald-200 rounded-xl">
                        <CheckCircle className="w-6 h-6 text-emerald-700" />
                      </div>
                      <div>
                        <h4 className="font-bold text-emerald-900 mb-1">Nenhuma Irregularidade Detectada</h4>
                        <p className="text-sm text-emerald-700">
                          Não foram encontradas condenações, processos por improbidade ou irregularidades graves nas fontes verificadas (TCU, CGU, MPF, TSE).
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-200 rounded-lg text-[10px] font-medium text-emerald-800">
                            <CheckCircle className="w-3 h-3" /> TCU Verificado
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-200 rounded-lg text-[10px] font-medium text-emerald-800">
                            <CheckCircle className="w-3 h-3" /> CGU Verificado
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-200 rounded-lg text-[10px] font-medium text-emerald-800">
                            <CheckCircle className="w-3 h-3" /> TSE Verificado
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Fact Check Section */}
              <div className="mx-6 mb-6 p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-brand-100 rounded-lg">
                      <CheckSquare className="w-4 h-4 text-brand-600" />
                    </div>
                    <span className="text-sm font-bold text-slate-700">Verificação de Fatos</span>
                  </div>
                  <button 
                    onClick={handleFetchFactCheck} 
                    disabled={isLoadingFactCheck} 
                    className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    {isLoadingFactCheck ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <Search className="w-3 h-3" />
                        Buscar no Google Fact Check
                      </>
                    )}
                  </button>
                </div>
                
                {factCheckError && (
                  <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{factCheckError}</p>
                )}
                
                {!factChecks && !factCheckError && !isLoadingFactCheck && (
                  <p className="text-xs text-slate-500">
                    Clique para buscar verificações de fatos sobre este político na API do Google Fact Check.
                  </p>
                )}
                
                {factChecks && factChecks.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                    <CheckCircle className="w-4 h-4" />
                    Nenhuma verificação de fatos encontrada para este nome.
                  </div>
                )}
                
                {factChecks && factChecks.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {factChecks.slice(0, 3).map((claim, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                        <p className="font-medium text-slate-800 text-xs mb-2 line-clamp-2">"{claim.text}"</p>
                        <div className="flex justify-between items-center">
                          {getRatingBadge(claim.claimReview[0].textualRating)}
                          <a 
                            href={claim.claimReview[0].url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                          >
                            Ler mais <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fontes Verificadas */}
              <div className="px-6 pb-6">
                <div className="p-4 bg-slate-100/80 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Fontes Consultadas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Portal da Transparência', 'TCU', 'CGU', 'TSE', 'Câmara dos Deputados', 'Serenata de Amor'].map((fonte, idx) => (
                      <span key={idx} className="px-2 py-1 bg-white rounded-lg text-[10px] font-medium text-slate-600 border border-slate-200">
                        {fonte}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
           </div>

           {/* INSIGHTS */}
           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
             <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
               <Search className="w-5 h-5 text-brand-500" />
               Principais Insights
             </h3>
             <ul className="space-y-4">
               {(politician.keyFindings ?? []).map((finding, idx) => (
                 <li key={idx} className="flex gap-3 text-sm text-slate-600">
                   <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-400 mt-2"></span>
                   {finding}
                 </li>
               ))}
             </ul>
           </div>

           {/* LINKS PARA PORTAIS DE TRANSPARÊNCIA DE PE */}
           <div className="bg-gradient-to-br from-brand-50 to-blue-50 p-6 rounded-3xl border border-brand-100">
             <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
               <Link2 className="w-5 h-5 text-brand-500" />
               Consultar Fontes Oficiais
             </h3>
             
             {/* Banner da fonte principal baseada no tipo de político */}
             <div className="mb-4 p-4 bg-white rounded-xl border border-slate-200">
               <div className="flex items-center gap-3">
                 <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                   isLegislativo ? 'bg-brand-100 text-brand-600' : 'bg-emerald-100 text-emerald-600'
                 }`}>
                   {isLegislativo ? <Building2 className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                 </div>
                 <div className="flex-1">
                   <p className="text-sm font-bold text-slate-800">Fonte Principal: {typeConfig.fonteDados}</p>
                   <p className="text-xs text-slate-500 mt-0.5">
                     {typeConfig.apiDisponivel ? 'Dados obtidos via API oficial' : 'Consulta manual necessária'}
                   </p>
                 </div>
                 <a 
                   href={typeConfig.portalUrl} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition flex items-center gap-1"
                 >
                   Acessar <ExternalLink className="w-3 h-3" />
                 </a>
               </div>
             </div>
             
             <p className="text-sm text-slate-600 mb-4">
               Acesse diretamente os portais de transparência para dados completos:
             </p>
             
             <div className="space-y-3">
               {getLinksConsulta(
                 politician.name, 
                 politician.currentRole ?? politician.position,
                 politician.sphere as any
               ).slice(0, 5).map((link, idx) => (
                 <a
                   key={idx}
                   href={link.url}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all group"
                 >
                   <div className="flex items-center gap-3">
                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                       link.tipo === 'remuneracao' ? 'bg-emerald-100 text-emerald-600' :
                       link.tipo === 'despesas' ? 'bg-amber-100 text-amber-600' :
                       link.tipo === 'servidores' ? 'bg-blue-100 text-blue-600' :
                       'bg-slate-100 text-slate-600'
                     }`}>
                       {link.tipo === 'remuneracao' ? <FileText className="w-4 h-4" /> :
                        link.tipo === 'despesas' ? <BarChart2 className="w-4 h-4" /> :
                        link.tipo === 'servidores' ? <Users className="w-4 h-4" /> :
                        <Globe className="w-4 h-4" />}
                     </div>
                     <div>
                       <p className="text-sm font-semibold text-slate-800 group-hover:text-brand-600 transition-colors">
                         {link.descricao}
                       </p>
                       <p className="text-xs text-slate-500">{link.portal}</p>
                     </div>
                   </div>
                   <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                 </a>
               ))}
             </div>

             {/* Portais de PE - Links Rápidos */}
             <div className="mt-6 pt-4 border-t border-brand-100">
               <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                 Portais de Transparência de PE
               </p>
               <div className="flex flex-wrap gap-2">
                 <a href={PORTAIS_PE.estadual.home} target="_blank" rel="noopener noreferrer" 
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
                   🏛️ Governo de PE
                 </a>
                 <a href={PORTAIS_PE.recife.home} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
                   🌆 Prefeitura de Recife
                 </a>
                 <a href={PORTAIS_PE.mppe.home} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
                   ⚖️ MP-PE
                 </a>
                 <a href={PORTAIS_PE.federal.localidade} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
                   🇧🇷 Portal Federal - PE
                 </a>
                 <a href={PORTAIS_PE.estadual.remuneracoes} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
                   💰 Remunerações PE
                 </a>
               </div>
             </div>
           </div>

           {/* DISPONIBILIDADE DE DADOS */}
           <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transparência dos Dados</h4>
                 <Tooltip content="Índice que mede a facilidade de encontrar dados abertos e estruturados sobre este político nas fontes oficiais (Câmara, TSE, Portal da Transparência)." position="top">
                    <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                 </Tooltip>
              </div>
              <div className="flex items-center gap-4 mb-2">
                 <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${(politician.dataAvailabilityScore ?? 50) > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{width: `${politician.dataAvailabilityScore ?? 50}%`}}></div>
                 </div>
                 <span className="font-bold text-slate-700">{politician.dataAvailabilityScore ?? 50}%</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                 {(politician.dataAvailabilityScore ?? 50) > 90 ? 'Excelente disponibilidade de dados públicos.' : 'Alguns dados podem estar incompletos nas fontes oficiais.'}
              </p>
              
              {/* Fontes de dados utilizadas */}
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fontes de Dados</p>
                <div className="flex flex-wrap gap-1.5">
                  {getResumoFontes(politician.currentRole ?? politician.position, politician.sphere as any).map((fonte, idx) => (
                    <span key={idx} className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-medium text-slate-600">
                      {fonte}
                    </span>
                  ))}
                </div>
              </div>
           </div>

        </div>
      </div>

      {/* Modal de Análise CSV */}
      {showCSVViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <CSVEmendasViewer 
              nomeAutorPadrao={politician.name}
              onClose={() => setShowCSVViewer(false)}
            />
          </div>
        </div>
      )}
    </article>
  );
};

export default DetailView;