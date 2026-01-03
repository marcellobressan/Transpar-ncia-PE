import React, { useState, useEffect, useCallback } from 'react';
import { Politician, EfficiencyRating, AmendmentHistory, SpendingRecord, CandidacyStatus, AdvisorStats } from '../types';
import { FORMATTER_BRL, PARTY_LOGOS } from '../constants';
import EfficiencyBadge from './EfficiencyBadge';
import Tooltip from './Tooltip';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { AlertTriangle, CheckCircle, Info, FileText, Search, RefreshCw, Globe, Database, Building2, Filter, ExternalLink, FileSearch, CheckSquare, XCircle, HelpCircle, Briefcase, MapPin, UserCheck, UserX, Fuel, BarChart2, Users, AlertOctagon, Siren, ShieldAlert, Calendar, ChevronLeft, Download, Link2 } from 'lucide-react';
import { fetchAmendmentsByAuthor, DetailedAmendmentStats, fetchServidorId, fetchRemuneracaoByYear, Remuneracao } from '../services/portalTransparencia';
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
  const getPoliticianType = (): 'deputado' | 'senador' | 'executivo' | 'outro' => {
    const role = (politician.currentRole ?? politician.position ?? '').toLowerCase();
    if (role.includes('deputad')) return 'deputado';
    if (role.includes('senador')) return 'senador';
    if (role.includes('governador') || role.includes('prefeito') || role.includes('ministro') || role.includes('secretário')) return 'executivo';
    return 'outro';
  };

  const politicianType = getPoliticianType();
  const isLegislativo = politicianType === 'deputado' || politicianType === 'senador';

  // --- Handlers (mantendo a lógica original) ---
  const handleSyncSalary = async () => {
    // Deputados e senadores não estão no Portal da Transparência (Executivo Federal)
    if (isLegislativo) {
      const sourceInfo = politicianType === 'deputado' 
        ? 'Câmara dos Deputados (dados já carregados via API da Câmara)'
        : 'Senado Federal (dados já carregados via API do Senado)';
      setSalaryError(`${politicianType === 'deputado' ? 'Deputados' : 'Senadores'} não constam no Portal da Transparência (apenas servidores do Executivo Federal). Fonte de dados: ${sourceInfo}`);
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
    switch(severity) {
      case 'HIGH': return 'bg-rose-50 border-rose-200';
      case 'MEDIUM': return 'bg-amber-50 border-amber-200';
      case 'LOW': return 'bg-blue-50 border-blue-200';
      default: return 'bg-slate-50 border-slate-200';
    }
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
                    Histórico de Remuneração
                  </h3>
                  <p className="text-sm text-slate-500">Valores brutos recebidos mensal ou anualmente.</p>
                </div>
                
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                   <div className="relative">
                      <select 
                        className="bg-transparent text-xs font-semibold text-slate-700 py-1.5 pl-2 pr-6 rounded-lg focus:outline-none cursor-pointer"
                        value={salaryYear}
                        onChange={(e) => setSalaryYear(Number(e.target.value))}
                        disabled={isSyncingSalary || isLegislativo}
                      >
                        {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <Calendar className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                   </div>
                   <div className="w-px h-6 bg-slate-200"></div>
                   {isLegislativo ? (
                     <span className="text-xs px-3 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-500 flex items-center gap-2">
                       <Info className="w-3 h-3" />
                       {politicianType === 'deputado' ? 'Dados via Câmara' : 'Dados via Senado'}
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

              {/* Banner informativo para Legislativo */}
              {isLegislativo && (
                <div className="mb-6 bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                  <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-500" />
                  <div>
                    <p className="font-semibold">Fonte: {politicianType === 'deputado' ? 'Câmara dos Deputados' : 'Senado Federal'}</p>
                    <p className="text-blue-600 mt-1">
                      {politicianType === 'deputado' 
                        ? 'Os subsídios de deputados federais são fixos e definidos por decreto legislativo. Os dados de despesas de gabinete (CEAP) são obtidos da API da Câmara.'
                        : 'Os subsídios de senadores são fixos e definidos por decreto legislativo. Os dados de despesas são obtidos da API do Senado.'}
                    </p>
                  </div>
                </div>
              )}

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

          {/* CEAP SECTION */}
          {(activeFilter === 'TODOS' || activeFilter === 'CEAP') && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
               <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-brand-500" />
                      Cota Parlamentar (CEAP)
                    </h3>
                    <p className="text-sm text-slate-500">Gastos operacionais do mandato.</p>
                 </div>
                 {politician.sphere === 'Federal' && (
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
               </div>

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

           {/* EMENDAS SECTION */}
           {(activeFilter === 'TODOS' || activeFilter === 'EMENDAS') && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
               <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Globe className="w-5 h-5 text-brand-500" />
                      Emendas Parlamentares
                    </h3>
                    <p className="text-sm text-slate-500">Recursos destinados a obras e serviços.</p>
                 </div>
                 {politician.sphere === 'Federal' && (
                   <button onClick={handleFetchRealData} disabled={isLoadingRealData} className="text-xs px-3 py-1.5 bg-slate-800 text-white rounded-lg font-bold flex items-center gap-2">
                      {isLoadingRealData ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Globe className="w-3 h-3"/>}
                      Buscar Portal
                   </button>
                 )}
               </div>

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
               
               <div className="h-64 w-full" style={{ minHeight: '256px' }}>
                 <ResponsiveContainer width="100%" height={256} minWidth={300}>
                    <BarChart data={amendmentHistoryData.length > 0 ? amendmentHistoryData : [{ year: 'N/A', proposed: 0, executed: 0 }]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                      <YAxis hide />
                      <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                      <Bar dataKey="proposed" name="Empenhado" fill="#cbd5e1" radius={[4,4,0,0]} barSize={20} />
                      <Bar dataKey="executed" name="Pago" fill="#0ea5e9" radius={[4,4,0,0]} barSize={20} />
                    </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>
           )}

        </div>

        {/* COLUNA DIREITA - ALERTA E CONTEXTO */}
        <div className="space-y-8">
           
           {/* RED FLAGS CARD */}
           <div className={`p-6 rounded-3xl border shadow-sm relative overflow-hidden ${politician.redFlags.some(f => f.severity === 'HIGH') ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3 mb-4 relative z-10">
                 <div className={`p-2 rounded-xl ${politician.redFlags.some(f => f.severity === 'HIGH') ? 'bg-rose-200 text-rose-700' : 'bg-brand-100 text-brand-600'}`}>
                    <ShieldAlert className="w-6 h-6" />
                 </div>
                 <h3 className={`text-lg font-bold ${politician.redFlags.some(f => f.severity === 'HIGH') ? 'text-rose-900' : 'text-slate-800'}`}>
                   Pontos de Atenção
                 </h3>
              </div>

              <div className="bg-white/60 p-4 rounded-xl border border-black/5 text-sm text-slate-700 leading-relaxed mb-6 backdrop-blur-sm">
                {politician.redFlagsSummary}
              </div>

              {(politician.redFlags ?? []).length > 0 ? (
                <div className="space-y-3 relative z-10">
                  {(politician.redFlags ?? []).map((flag) => (
                    <div key={flag.id} className={`p-4 rounded-xl border bg-white shadow-sm ${getSeverityColor(flag.severity)}`}>
                       <div className="flex gap-3">
                         <div className="mt-0.5">{flag.severity === 'HIGH' ? <AlertOctagon className="w-4 h-4 text-rose-600"/> : <AlertTriangle className="w-4 h-4 text-amber-500"/>}</div>
                         <div>
                           <h4 className="font-bold text-sm text-slate-800">{flag.title}</h4>
                           <p className="text-xs text-slate-500 mt-1 line-clamp-2">{flag.description}</p>
                           <a href={flag.sourceUrl} target="_blank" className="mt-2 text-[10px] font-bold text-brand-600 uppercase tracking-wide flex items-center gap-1 hover:underline">
                             Ver Fonte <ExternalLink className="w-2.5 h-2.5" />
                           </a>
                         </div>
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-800">
                   <CheckCircle className="w-5 h-5" />
                   <p className="text-sm font-medium">Sem irregularidades graves nas fontes verificadas.</p>
                </div>
              )}

              {/* Fact Check Tool */}
              <div className="mt-6 pt-6 border-t border-black/10">
                 <div className="flex justify-between items-center mb-3">
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                     <CheckSquare className="w-3 h-3" /> Fact Check Google
                   </span>
                   <button onClick={handleFetchFactCheck} disabled={isLoadingFactCheck} className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded shadow-sm hover:bg-slate-50 disabled:opacity-50">
                     {isLoadingFactCheck ? 'Verificando...' : 'Verificar Agora'}
                   </button>
                 </div>
                 
                 {factCheckError && <p className="text-xs text-red-500">{factCheckError}</p>}
                 
                 {factChecks && factChecks.length > 0 && (
                   <div className="space-y-2">
                     {factChecks.slice(0, 2).map((claim, idx) => (
                       <div key={idx} className="bg-white p-2 rounded border border-slate-100 text-xs shadow-sm">
                         <p className="font-medium text-slate-800 mb-1 line-clamp-2">"{claim.text}"</p>
                         <div className="flex justify-between items-center">
                            {getRatingBadge(claim.claimReview[0].textualRating)}
                            <a href={claim.claimReview[0].url} target="_blank" className="text-brand-600 hover:underline">Ler</a>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
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
    </article>
  );
};

export default DetailView;