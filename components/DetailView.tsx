import React, { useState } from 'react';
import { Politician, EfficiencyRating, AmendmentHistory, SpendingRecord, CandidacyStatus, AdvisorStats } from '../types';
import { FORMATTER_BRL, PARTY_LOGOS } from '../constants';
import EfficiencyBadge from './EfficiencyBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { AlertTriangle, CheckCircle, Info, FileText, Search, RefreshCw, Globe, Database, Building2, Filter, ExternalLink, FileSearch, CheckSquare, XCircle, HelpCircle, Briefcase, MapPin, UserCheck, UserX, Fuel, BarChart2, Users, AlertOctagon, Siren, ShieldAlert } from 'lucide-react';
import { fetchAmendmentsByAuthor, DetailedAmendmentStats, fetchServidorId, fetchRemuneracaoByYear, Remuneracao } from '../services/portalTransparencia';
import { findDeputyByName, getDeputyExpenses, aggregateExpensesByCategory, getTopIndividualExpenses, analyzeFuelExpenses, FuelAnalysisResult, getDeputyStaff } from '../services/camaraDeputados';
import { searchFactChecks, FactCheckClaim } from '../services/factCheck';

interface DetailViewProps {
  candidate: Politician; // Renamed type but keeping prop name for less churn if not necessary, but better to update to politician
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

// Helper parse para exibir na tabela
const parseCurrency = (val: string) => {
  if (!val) return 0;
  return parseFloat(val.replace(/\./g, '').replace(',', '.'));
};

const DetailView: React.FC<DetailViewProps> = ({ candidate: politician, onBack }) => {
  // Using 'politician' alias to be more generic inside the component
  
  // States for Portal Transparencia (Amendments)
  const [isLoadingRealData, setIsLoadingRealData] = useState(false);
  const [realDataError, setRealDataError] = useState<string | null>(null);
  const [realAmendmentStats, setRealAmendmentStats] = useState<RealAmendmentData | null>(null);

  // States for Portal Transparencia (Salary)
  const [isSyncingSalary, setIsSyncingSalary] = useState(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const [realSalaryData, setRealSalaryData] = useState<{name: string, amount: number}[] | null>(null);
  const [detailedSalaryData, setDetailedSalaryData] = useState<Remuneracao[] | null>(null);
  const [salarySourceInfo, setSalarySourceInfo] = useState<string>('');

  // States for Camara API (CEAP & Staff)
  const [isSyncingCamara, setIsSyncingCamara] = useState(false);
  const [camaraError, setCamaraError] = useState<string | null>(null);
  const [ceapDataOverride, setCeapDataOverride] = useState<SpendingRecord[] | null>(null);
  const [ceapTopExpenses, setCeapTopExpenses] = useState<SpendingRecord[] | null>(null);
  const [fuelAnalysis, setFuelAnalysis] = useState<FuelAnalysisResult | null>(null);
  const [advisorStatsOverride, setAdvisorStatsOverride] = useState<AdvisorStats | null>(null);
  const [deputyPhotoOverride, setDeputyPhotoOverride] = useState<string | null>(null);

  // States for Google Fact Check
  const [isLoadingFactCheck, setIsLoadingFactCheck] = useState(false);
  const [factCheckError, setFactCheckError] = useState<string | null>(null);
  const [factChecks, setFactChecks] = useState<FactCheckClaim[] | null>(null);

  // Filter State
  const [activeFilter, setActiveFilter] = useState<SpendingFilter>('TODOS');

  // Determine which data to show for Salary
  const displaySalaryData = realSalaryData || politician.salaryHistory.map(r => ({
    name: r.year.toString(),
    amount: r.amount,
  }));

  // Determine which data to show for Amendments
  const displayAmendments = realAmendmentStats || politician.amendments;
  const amendmentHistoryData = displayAmendments.history.map(h => ({
    year: h.year.toString(),
    proposed: h.proposed,
    executed: h.executed
  }));

  const ceapDisplayData = ceapDataOverride || politician.ceapHistory;
  const advisorDisplayData = advisorStatsOverride || politician.advisorStats;

  // --- Handlers ---

  const handleSyncSalary = async () => {
    setIsSyncingSalary(true);
    setSalaryError(null);
    try {
      const servidor = await fetchServidorId(politician.name);
      
      if (!servidor) {
        setSalaryError("Servidor não encontrado na base do Poder Executivo Federal (Portal Transparência).");
        setIsSyncingSalary(false);
        return;
      }

      setSalarySourceInfo(`${servidor.orgaoServidorLotacao.nome} (${servidor.tipoServidor})`);

      const targetYear = 2023;
      const remuneracoes = await fetchRemuneracaoByYear(servidor.id, targetYear);

      if (remuneracoes.length === 0) {
        setSalaryError(`Nenhum registro de remuneração encontrado para ${targetYear}.`);
      } else {
        // Ordenar cronologicamente para o gráfico e tabela
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
      const results = await Promise.all(
        years.map(year => fetchAmendmentsByAuthor(politician.name, year))
      );

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

          Object.entries(r.areas).forEach(([area, val]) => {
            areaMap[area] = (areaMap[area] || 0) + val;
          });

          Object.entries(r.locations).forEach(([loc, val]) => {
            locationMap[loc] = (locationMap[loc] || 0) + val;
          });

          return {
            year: r.year,
            proposed: r.totalEmpenhado,
            executed: r.totalPago
          };
        }).sort((a, b) => b.year - a.year);

        const topAreas = Object.entries(areaMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([name]) => name);

        const geoDistribution = Object.entries(locationMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([name]) => name);

        setRealAmendmentStats({
          totalProposed,
          totalExecuted,
          topAreas: topAreas.length > 0 ? topAreas : ['Dados não categorizados'],
          geoDistribution: geoDistribution.length > 0 ? geoDistribution : ['Pernambuco'],
          history
        });
      }
    } catch (error: any) {
      setRealDataError("Erro de conexão com o Portal. Possível bloqueio CORS ou indisponibilidade.");
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

      if (deputy.urlFoto) {
        setDeputyPhotoOverride(deputy.urlFoto);
      }

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
        setFactCheckError("Nenhuma checagem de fatos encontrada recentemente para este político.");
        setFactChecks([]);
      } else {
        setFactChecks(results);
      }
    } catch (e: any) {
      if (e.message && e.message.includes("Chave de API")) {
        setFactCheckError("Configuração necessária: Adicione uma chave válida do Google API em 'services/factCheck.ts'.");
      } else {
        setFactCheckError("Erro ao consultar serviço de Fact Check do Google.");
      }
    } finally {
      setIsLoadingFactCheck(false);
    }
  };

  const FilterButton = ({ type, label, icon: Icon }: { type: SpendingFilter, label: string, icon?: React.ElementType }) => (
    <button
      onClick={() => setActiveFilter(type)}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
        activeFilter === type
          ? 'bg-brand-600 text-white shadow-md'
          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {label}
    </button>
  );

  const getRatingBadge = (rating: string) => {
    const r = rating.toLowerCase();
    if (r.includes('falso') || r.includes('false') || r.includes('mentira')) {
      return <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded"><XCircle className="w-3 h-3"/> Falso</span>;
    }
    if (r.includes('verdade') || r.includes('true')) {
      return <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded"><CheckCircle className="w-3 h-3"/> Verdadeiro</span>;
    }
    return <span className="flex items-center gap-1 text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-1 rounded"><HelpCircle className="w-3 h-3"/> {rating}</span>;
  };

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'HIGH': return 'bg-red-50 border-red-200 text-red-900';
      case 'MEDIUM': return 'bg-orange-50 border-orange-200 text-orange-900';
      case 'LOW': return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      default: return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch(severity) {
      case 'HIGH': return <AlertOctagon className="w-5 h-5 text-red-600" />;
      case 'MEDIUM': return <Siren className="w-5 h-5 text-orange-600" />;
      case 'LOW': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default: return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <button 
        onClick={onBack}
        className="text-brand-600 hover:text-brand-800 font-medium flex items-center gap-2 mb-4"
      >
        ← Voltar para lista
      </button>

      {/* SEÇÃO 1 - IDENTIFICAÇÃO */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-brand-900 h-24 relative"></div>
        <div className="px-8 pb-8">
          <div className="flex flex-col md:flex-row items-start md:items-end -mt-12 mb-6 gap-6">
            <img 
              src={PARTY_LOGOS[politician.party] || PARTY_LOGOS['DEFAULT']}
              alt={`Logo ${politician.party}`}
              className="w-32 h-32 rounded-full border-4 border-white shadow-md bg-white object-contain p-2"
            />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                {politician.name}
              </h1>
              
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                <span className="px-2 py-1 bg-gray-100 rounded text-gray-800 font-semibold">{politician.party}</span>
                <span className="px-2 py-1 bg-gray-100 rounded">Atual: {politician.currentRole}</span>
                
                {/* Status Badge */}
                {politician.candidacyStatus === CandidacyStatus.CONFIRMADA && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 border border-green-200 rounded flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> Candidatura Confirmada: <strong>{politician.disputedRole}</strong>
                  </span>
                )}
                {politician.candidacyStatus === CandidacyStatus.PRE_CANDIDATO && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> Pré-Candidato: <strong>{politician.disputedRole}</strong>
                  </span>
                )}
                {politician.candidacyStatus === CandidacyStatus.NAO_CANDIDATO && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded flex items-center gap-1">
                    <UserX className="w-3 h-3" /> Não é candidato
                  </span>
                )}
                
                <span className="px-2 py-1 bg-gray-100 rounded">{politician.location}</span>
              </div>
            </div>
            <div className="mt-4 md:mt-0">
               <EfficiencyBadge rating={politician.efficiencyRating} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 border-t border-gray-100 pt-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Gasto Total (10 Anos)</p>
              <p className="text-2xl font-bold text-brand-700">{FORMATTER_BRL.format(politician.totalSpending10Years)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Custo Per Capita</p>
              <p className="text-2xl font-bold text-gray-800">R$ {politician.spendingPerCapita.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Tendência</p>
              <p className="text-2xl font-bold text-gray-800">{politician.spendingTrend}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Comp. Média Partido</p>
              <p className={`text-2xl font-bold ${politician.partyAverageComparison > 1 ? 'text-red-600' : 'text-green-600'}`}>
                {((politician.partyAverageComparison - 1) * 100).toFixed(0)}% {politician.partyAverageComparison > 1 ? 'Acima' : 'Abaixo'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* SEÇÃO 3 - DETALHAMENTO DE GASTOS */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Detalhamento de Gastos</h2>
            <div className="flex gap-2">
               <Filter className="w-5 h-5 text-gray-400" />
               <span className="text-sm text-gray-500">Filtrar por:</span>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 pb-2">
            <FilterButton type="TODOS" label="Todos" />
            <FilterButton type="REMUNERACAO" label="Remuneração" icon={FileText} />
            <FilterButton type="CEAP" label="CEAP / Cotas" icon={Building2} />
            <FilterButton type="EMENDAS" label="Emendas" icon={Globe} />
          </div>

          {(activeFilter === 'TODOS' || activeFilter === 'REMUNERACAO') && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-600" />
                  Evolução Salarial {realSalaryData ? '(Mensal)' : '(Anual)'}
                </h3>
                
                <button 
                  onClick={handleSyncSalary}
                  disabled={isSyncingSalary}
                  className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 transition ${
                    realSalaryData 
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100'
                  }`}
                >
                  {isSyncingSalary ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : realSalaryData ? (
                    <Database className="w-3 h-3" />
                  ) : (
                    <Briefcase className="w-3 h-3" />
                  )}
                  {isSyncingSalary ? 'Buscando...' : realSalaryData ? 'Dados Sincronizados' : 'Sincronizar (Portal Transparência)'}
                </button>
              </div>

              {salaryError && (
                <div className="mb-4 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{salaryError}</span>
                </div>
              )}

              {salarySourceInfo && (
                <div className="mb-4 bg-blue-50 border border-blue-100 text-blue-800 px-4 py-2 rounded-lg text-xs flex items-center gap-2">
                  <Info className="w-3 h-3" />
                  <span>Vínculo identificado: {salarySourceInfo}</span>
                </div>
              )}

              <div className="h-64 w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={displaySalaryData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(val) => `R$${val/1000}k`} />
                    <Tooltip formatter={(value: number) => FORMATTER_BRL.format(value)} />
                    <Bar dataKey="amount" fill="#0ea5e9" radius={[4, 4, 0, 0]}>
                      {displaySalaryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === displaySalaryData.length - 1 ? '#0284c7' : '#bae6fd'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela Detalhada de Remuneração (Apenas quando sincronizado com a API) */}
              {detailedSalaryData && detailedSalaryData.length > 0 && (
                <div className="overflow-x-auto border-t border-gray-100 pt-6 animate-fade-in">
                  <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4 text-brand-600" />
                    Histórico Detalhado (Categorias e Valores)
                  </h4>
                  <table className="min-w-full text-xs text-left border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                      <tr>
                        <th className="px-3 py-2">Competência</th>
                        <th className="px-3 py-2 text-right">Rem. Básica Bruta</th>
                        <th className="px-3 py-2 text-right">Verbas Indenizatórias</th>
                        <th className="px-3 py-2 text-right">Outras Verbas</th>
                        <th className="px-3 py-2 text-right font-bold text-gray-800">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detailedSalaryData.map((item, idx) => {
                        const bruto = parseCurrency(item.remuneracaoBasicaBruta);
                        const indenizatorias = parseCurrency(item.verbasIndenizatorias);
                        const outras = parseCurrency(item.outrasVerbasRemuneratorias);
                        const total = bruto + indenizatorias + outras;

                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.mes}/{item.ano}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{FORMATTER_BRL.format(bruto)}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{FORMATTER_BRL.format(indenizatorias)}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{FORMATTER_BRL.format(outras)}</td>
                            <td className="px-3 py-2 text-right font-bold text-gray-800">{FORMATTER_BRL.format(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-gray-400 mt-2 italic">
                    * Dados brutos obtidos diretamente da API do Portal da Transparência do Governo Federal.
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-4 text-center">
                * {realSalaryData ? 'Valores brutos mensais do último ano disponível.' : 'Valores anuais estimados corrigidos pela inflação.'} Fonte: Portal da Transparência.
              </p>
            </div>
          )}

          {/* CEAP Breakdown */}
          {(activeFilter === 'TODOS' || activeFilter === 'CEAP') && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                 <h3 className="text-lg font-bold text-gray-900">Principais Despesas (CEAP)</h3>
                 
                 {politician.sphere === 'Federal' && (
                    <button 
                      onClick={handleSyncCamara}
                      disabled={isSyncingCamara}
                      className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 transition ${
                        ceapDataOverride 
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {isSyncingCamara ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Building2 className="w-3 h-3" />
                      )}
                      {isSyncingCamara ? 'Buscando API Câmara...' : ceapDataOverride ? 'Dados da Câmara Sincronizados' : 'Sincronizar Câmara (CEAP)'}
                    </button>
                 )}
              </div>

              {camaraError && (
                <div className="mb-4 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{camaraError}</span>
                </div>
              )}

              {/* GESTÃO DE GABINETE / ASSESSORES (Nova Seção) */}
              {politician.sphere === 'Federal' && advisorDisplayData && (
                <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4 animate-fade-in">
                  <h4 className="text-md font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-600" />
                    Gestão de Gabinete (Mensal)
                    {advisorStatsOverride && <span className="text-[10px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded ml-2">Sincronizado</span>}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Contagem de Pessoal */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600">Secretários Parlamentares</span>
                        <span className="font-semibold text-slate-800">{advisorDisplayData.totalAdvisors} / {advisorDisplayData.maxAdvisors}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${advisorDisplayData.totalAdvisors > advisorDisplayData.maxAdvisors ? 'bg-red-500' : 'bg-brand-500'}`}
                          style={{ width: `${Math.min(100, (advisorDisplayData.totalAdvisors / advisorDisplayData.maxAdvisors) * 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 text-right">Limite Legal: {advisorDisplayData.maxAdvisors}</p>
                    </div>

                    {/* Custo de Verba */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600">Verba de Gabinete (Utilizada)</span>
                        <span className="font-semibold text-slate-800">{FORMATTER_BRL.format(advisorDisplayData.monthlyCost)}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${advisorDisplayData.monthlyCost > advisorDisplayData.maxMonthlyCost ? 'bg-red-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(100, (advisorDisplayData.monthlyCost / advisorDisplayData.maxMonthlyCost) * 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 text-right">Teto Disponível: {FORMATTER_BRL.format(advisorDisplayData.maxMonthlyCost)}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* FUEL ANALYSIS SECTION */}
              {fuelAnalysis && fuelAnalysis.warnings.length > 0 && (
                 <div className="mb-6 bg-orange-50 border border-orange-100 rounded-lg p-4 animate-fade-in">
                   <h4 className="text-orange-900 font-bold text-sm flex items-center gap-2 mb-2">
                     <Fuel className="w-4 h-4" />
                     Análise de Irregularidades (Combustível)
                   </h4>
                   <ul className="space-y-2">
                     {fuelAnalysis.warnings.map((warn, i) => (
                       <li key={i} className="text-xs text-orange-800 flex items-start gap-2">
                         <span className="mt-0.5 min-w-[4px] h-[4px] bg-orange-400 rounded-full"></span>
                         {warn}
                       </li>
                     ))}
                   </ul>
                   <p className="text-[10px] text-orange-600 mt-2 italic">* Baseado na análise algorítmica de {fuelAnalysis.totalSpent > 0 ? 'gastos com combustíveis' : 'notas fiscais'} sincronizadas.</p>
                 </div>
              )}

              {/* Tabela de Categorias Agregadas */}
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                      <th className="px-4 py-2">Categoria</th>
                      <th className="px-4 py-2">Descrição</th>
                      <th className="px-4 py-2 text-right">Valor Total (2023)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ceapDisplayData.map((rec, i) => (
                      <tr key={i} className={ceapDataOverride ? "bg-blue-50/30" : ""}>
                        <td className="px-4 py-3 font-medium text-gray-800">{rec.category}</td>
                        <td className="px-4 py-3 text-gray-600">{rec.description}</td>
                        <td className="px-4 py-3 text-right font-semibold">{FORMATTER_BRL.format(rec.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Nova Tabela: Top 10 Gastos Individuais (Apenas quando sincronizado) */}
              {ceapTopExpenses && ceapTopExpenses.length > 0 && (
                <div className="mt-6 border-t border-gray-100 pt-6 animate-fade-in">
                  <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <FileSearch className="w-4 h-4 text-brand-600" />
                    Maiores Gastos Individuais (Detalhamento da Nota)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left border border-gray-100 rounded-lg overflow-hidden">
                      <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                          <th className="px-4 py-2 w-1/3">Fornecedor / Data</th>
                          <th className="px-4 py-2">Tipo de Despesa</th>
                          <th className="px-4 py-2">Fonte / Nota</th>
                          <th className="px-4 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ceapTopExpenses.map((exp, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="block font-medium text-gray-800">{exp.description}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs uppercase tracking-wide">{exp.category}</td>
                            <td className="px-4 py-3">
                              {exp.source.startsWith('http') ? (
                                <a 
                                  href={exp.source} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium"
                                >
                                  Ver Nota Fiscal <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-gray-400 text-xs italic">{exp.source}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800">{FORMATTER_BRL.format(exp.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 italic">
                     * Exibindo os 10 maiores valores individuais encontrados no período. A verificação da nota fiscal é essencial para confirmar a natureza do gasto.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Emendas */}
          {(activeFilter === 'TODOS' || activeFilter === 'EMENDAS') && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h3 className="text-lg font-bold text-gray-900">Análise de Emendas Parlamentares</h3>
                
                {/* API Integration Button */}
                {politician.sphere === 'Federal' && (
                   <button 
                    onClick={handleFetchRealData}
                    disabled={isLoadingRealData}
                    className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 transition ${
                      realAmendmentStats 
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100'
                    }`}
                   >
                     {isLoadingRealData ? (
                       <RefreshCw className="w-3 h-3 animate-spin" />
                     ) : realAmendmentStats ? (
                       <Database className="w-3 h-3" />
                     ) : (
                       <Globe className="w-3 h-3" />
                     )}
                     {isLoadingRealData ? 'Buscando dados...' : realAmendmentStats ? 'Dados Reais (Portal da Transparência)' : 'Sincronizar Portal Transparência'}
                   </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-brand-50 p-4 rounded-lg">
                  <p className="text-sm text-brand-800 font-medium mb-1">Taxa de Execução</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-brand-900">
                      {displayAmendments.totalProposed > 0 
                        ? Math.round((displayAmendments.totalExecuted / displayAmendments.totalProposed) * 100) 
                        : 0}%
                    </span>
                    <span className="text-xs text-brand-700 mb-1">proposto vs pago</span>
                  </div>
                  <div className="w-full bg-brand-200 h-2 mt-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand-600 h-full" 
                      style={{ width: `${displayAmendments.totalProposed > 0 ? (displayAmendments.totalExecuted / displayAmendments.totalProposed) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Áreas Prioritárias {realAmendmentStats && '(Dados Reais)'}</p>
                  <ul className="space-y-1">
                    {displayAmendments.topAreas.map((area, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-2 h-2 rounded-full bg-brand-400"></div>
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                   <p className="text-sm font-medium text-gray-700 mb-2">Distribuição Geográfica {realAmendmentStats && '(Top 3)'}</p>
                   <ul className="space-y-1">
                    {displayAmendments.geoDistribution.map((loc, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        {loc}
                      </li>
                    ))}
                   </ul>
                </div>
              </div>

              {/* Bar Chart: Amendment Evolution */}
              {amendmentHistoryData.length > 0 && (
                <div className="border-t border-gray-100 pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h4 className="text-md font-bold text-gray-900 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-brand-600"/>
                      Evolução de Emendas (Proposto vs Executado)
                    </h4>
                    {realAmendmentStats ? (
                       <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full font-medium">Dados do Portal da Transparência</span>
                    ) : (
                       <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">Dados Simulados</span>
                    )}
                  </div>
                  
                  <div className="h-64 w-full bg-gray-50 rounded-lg p-2 border border-gray-100">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={amendmentHistoryData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} />
                        <YAxis 
                          tickFormatter={(val) => {
                             if (val >= 1000000) return `R$${(val/1000000).toFixed(0)}M`;
                             if (val >= 1000) return `R$${(val/1000).toFixed(0)}k`;
                             return val;
                          }} 
                          axisLine={false} 
                          tickLine={false}
                          width={60}
                        />
                        <Tooltip 
                          formatter={(value: number) => [FORMATTER_BRL.format(value), '']}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="top" height={36}/>
                        <Bar 
                          dataKey="proposed" 
                          name="Proposto (Empenhado)" 
                          fill="#bfdbfe" 
                          radius={[4, 4, 0, 0]} 
                          barSize={32}
                        />
                        <Bar 
                          dataKey="executed" 
                          name="Executado (Pago)" 
                          fill="#16a34a" 
                          radius={[4, 4, 0, 0]} 
                          barSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {realAmendmentStats 
                      ? 'Fonte: API Portal da Transparência - CGU. Valores atualizados em tempo real.' 
                      : 'Fonte: Estimativas baseadas em declarações públicas e dados históricos.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SEÇÃO 5 - ACHADOS E RECOMENDAÇÕES */}
        <div className="space-y-8">
           
           {/* BANDEIRAS VERMELHAS (RED FLAGS) - NOVA SEÇÃO */}
           <div className={`p-6 rounded-xl shadow-sm border ${politician.redFlags.some(f => f.severity === 'HIGH') ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${politician.redFlags.some(f => f.severity === 'HIGH') ? 'text-red-900' : 'text-gray-900'}`}>
                 <ShieldAlert className={`w-5 h-5 ${politician.redFlags.some(f => f.severity === 'HIGH') ? 'text-red-600' : 'text-brand-600'}`} />
                 Bandeiras Vermelhas & Irregularidades
              </h3>

              <div className="mb-6 text-sm text-gray-700 leading-relaxed bg-white/50 p-3 rounded-lg border border-gray-100">
                <p><strong>Resumo da Auditoria:</strong> {politician.redFlagsSummary}</p>
              </div>

              {politician.redFlags.length > 0 ? (
                <div className="space-y-4">
                  {politician.redFlags.map((flag) => (
                    <div key={flag.id} className={`p-4 rounded-lg border ${getSeverityColor(flag.severity)} bg-white shadow-sm`}>
                       <div className="flex items-start gap-3">
                         <div className="mt-1 flex-shrink-0">
                           {getSeverityIcon(flag.severity)}
                         </div>
                         <div className="flex-1">
                           <h4 className="font-bold text-sm mb-1">{flag.title}</h4>
                           <p className="text-xs text-gray-600 mb-2">{flag.description}</p>
                           <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                             <div className="flex items-center gap-2 text-xs text-gray-500">
                               <span>{new Date(flag.date).toLocaleDateString()}</span>
                               <span>•</span>
                               <span>{flag.source}</span>
                             </div>
                             <a 
                               href={flag.sourceUrl} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                             >
                               Ver Fonte <ExternalLink className="w-3 h-3" />
                             </a>
                           </div>
                         </div>
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-green-50 text-green-800 rounded-lg border border-green-100">
                   <CheckCircle className="w-5 h-5 flex-shrink-0" />
                   <p className="text-sm font-medium">Nenhuma denúncia grave ou condenação encontrada nas fontes oficiais verificadas.</p>
                </div>
              )}

               {/* FACT CHECK INTEGRADO */}
               <div className="mt-6 pt-6 border-t border-gray-200">
                 <div className="flex items-center justify-between mb-4">
                   <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                     <CheckSquare className="w-4 h-4 text-gray-500" />
                     Verificação Adicional (Google Fact Check)
                   </h4>
                   {!factChecks && (
                      <button 
                        onClick={handleFetchFactCheck}
                        disabled={isLoadingFactCheck}
                        className="text-xs bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 px-2 py-1 rounded shadow-sm flex items-center gap-1 transition"
                      >
                        {isLoadingFactCheck ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Search className="w-3 h-3"/>}
                        Buscar
                      </button>
                   )}
                 </div>

                 {isLoadingFactCheck && (
                   <div className="py-2 text-center text-xs text-gray-500">
                     Buscando checagens de fatos recentes...
                   </div>
                 )}

                 {factCheckError && (
                   <div className="text-red-600 text-xs mb-2">
                     {factCheckError}
                   </div>
                 )}

                 {factChecks && factChecks.length === 0 && !factCheckError && (
                    <div className="text-xs text-gray-400 italic">
                      Nenhuma checagem adicional encontrada.
                    </div>
                 )}

                 {factChecks && factChecks.length > 0 && (
                   <div className="space-y-2">
                     {factChecks.slice(0, 3).map((claim, idx) => {
                       const review = claim.claimReview[0];
                       return (
                         <div key={idx} className="bg-gray-50 rounded p-2 hover:bg-gray-100 transition border border-gray-100">
                           <p className="text-xs font-medium text-gray-800 mb-1 line-clamp-1">"{claim.text}"</p>
                           <div className="flex items-center justify-between">
                              {getRatingBadge(review.textualRating)}
                              <a href={review.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-[10px] flex items-center gap-1">
                                Ler <ExternalLink className="w-2 h-2"/>
                              </a>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}
               </div>
           </div>

           <div className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-brand-500 border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-brand-600" />
              Insights de Dados (Key Findings)
            </h3>
            <ul className="space-y-3">
              {politician.keyFindings.map((finding, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-gray-700">
                  <Info className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
           </div>

           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <h3 className="text-lg font-bold text-gray-900 mb-4">Dados e Transparência</h3>
             <div className="flex items-center gap-4 mb-4">
               <div className="flex-1">
                 <div className="flex justify-between text-sm mb-1">
                   <span className="font-medium text-gray-700">Disponibilidade de Dados</span>
                   <span className="font-bold text-brand-700">{politician.dataAvailabilityScore}%</span>
                 </div>
                 <div className="w-full bg-gray-100 rounded-full h-2.5">
                   <div 
                    className={`h-2.5 rounded-full ${politician.dataAvailabilityScore > 80 ? 'bg-green-500' : 'bg-yellow-500'}`} 
                    style={{ width: `${politician.dataAvailabilityScore}%` }}
                   ></div>
                 </div>
               </div>
             </div>
             {politician.missingDataWarnings.length > 0 && (
               <div className="bg-yellow-50 p-3 rounded border border-yellow-100 text-xs text-yellow-800 flex gap-2">
                 <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                 <div>
                   <p className="font-bold mb-1">Atenção:</p>
                   {politician.missingDataWarnings.map((w, i) => <p key={i}>{w}</p>)}
                 </div>
               </div>
             )}
             <div className="mt-4 pt-4 border-t border-gray-100">
               <p className="text-xs text-gray-500 mb-2 font-medium uppercase">Fontes Consultadas:</p>
               <div className="flex flex-wrap gap-2">
                 <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">Portal Transparência PE</span>
                 <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">TCE-PE</span>
                 <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">Serenata de Amor</span>
                 <span className="text-xs bg-brand-100 text-brand-700 px-2 py-1 rounded font-semibold">API CGU</span>
                 <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">API Câmara</span>
                 <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">Google Fact Check</span>
               </div>
             </div>
           </div>

           {/* SEÇÃO 7 - COMO USAR PARA O VOTO */}
           <div className="bg-gradient-to-br from-brand-50 to-white p-6 rounded-xl border border-brand-100">
              <h3 className="text-lg font-bold text-brand-900 mb-2">Decisão de Voto</h3>
              <p className="text-sm text-gray-600 mb-4">
                Compare a eficiência deste político com a média do partido ({((politician.partyAverageComparison - 1) * 100).toFixed(0)}% vs média). 
                {politician.efficiencyRating === EfficiencyRating.ALTA 
                  ? ' Parlamentar apresenta boa gestão de recursos.' 
                  : ' Avalie se os gastos elevados trouxeram retorno direto para sua região.'}
              </p>
              <div className="flex items-center gap-2 text-sm text-brand-700 font-medium">
                <CheckCircle className="w-4 h-4" />
                <span>Verificado por metodologia de auditoria cívica.</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DetailView;