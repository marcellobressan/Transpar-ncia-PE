import React, { useState } from 'react';
import { Candidate, EfficiencyRating, AmendmentHistory, SpendingRecord } from '../types';
import { FORMATTER_BRL } from '../constants';
import EfficiencyBadge from './EfficiencyBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { AlertTriangle, CheckCircle, Info, FileText, Search, RefreshCw, Globe, Database, Building2, Filter, ExternalLink, FileSearch, CheckSquare, XCircle, HelpCircle, Briefcase } from 'lucide-react';
import { fetchAmendmentsByAuthor, DetailedAmendmentStats, fetchServidorId, fetchRemuneracaoByYear } from '../services/portalTransparencia';
import { findDeputyByName, getDeputyExpenses, aggregateExpensesByCategory, getTopIndividualExpenses } from '../services/camaraDeputados';
import { searchFactChecks, FactCheckClaim } from '../services/factCheck';

interface DetailViewProps {
  candidate: Candidate;
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

const DetailView: React.FC<DetailViewProps> = ({ candidate, onBack }) => {
  // States for Portal Transparencia (Amendments)
  const [isLoadingRealData, setIsLoadingRealData] = useState(false);
  const [realDataError, setRealDataError] = useState<string | null>(null);
  const [realAmendmentStats, setRealAmendmentStats] = useState<RealAmendmentData | null>(null);

  // States for Portal Transparencia (Salary)
  const [isSyncingSalary, setIsSyncingSalary] = useState(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const [realSalaryData, setRealSalaryData] = useState<{name: string, amount: number}[] | null>(null);
  const [salarySourceInfo, setSalarySourceInfo] = useState<string>('');

  // States for Camara API (CEAP)
  const [isSyncingCamara, setIsSyncingCamara] = useState(false);
  const [camaraError, setCamaraError] = useState<string | null>(null);
  const [ceapDataOverride, setCeapDataOverride] = useState<SpendingRecord[] | null>(null);
  const [ceapTopExpenses, setCeapTopExpenses] = useState<SpendingRecord[] | null>(null);
  const [deputyPhotoOverride, setDeputyPhotoOverride] = useState<string | null>(null);

  // States for Google Fact Check
  const [isLoadingFactCheck, setIsLoadingFactCheck] = useState(false);
  const [factCheckError, setFactCheckError] = useState<string | null>(null);
  const [factChecks, setFactChecks] = useState<FactCheckClaim[] | null>(null);

  // Filter State
  const [activeFilter, setActiveFilter] = useState<SpendingFilter>('TODOS');

  // Determine which data to show for Salary
  // If we have real monthly data, use it. Otherwise use the yearly mock history.
  const displaySalaryData = realSalaryData || candidate.salaryHistory.map(r => ({
    name: r.year.toString(),
    amount: r.amount,
  }));

  // Determine which data to show for Amendments
  const displayAmendments = realAmendmentStats || candidate.amendments;
  const amendmentHistoryData = displayAmendments.history.map(h => ({
    year: h.year.toString(),
    proposed: h.proposed,
    executed: h.executed
  }));

  const ceapDisplayData = ceapDataOverride || candidate.ceapHistory;

  // --- Handlers ---

  const handleSyncSalary = async () => {
    setIsSyncingSalary(true);
    setSalaryError(null);
    try {
      // 1. Find Servidor ID
      const servidor = await fetchServidorId(candidate.name);
      
      if (!servidor) {
        setSalaryError("Servidor não encontrado na base do Poder Executivo Federal (Portal Transparência).");
        setIsSyncingSalary(false);
        return;
      }

      setSalarySourceInfo(`${servidor.orgaoServidorLotacao.nome} (${servidor.tipoServidor})`);

      // 2. Fetch Remuneration for a specific year (e.g., 2023)
      const targetYear = 2023;
      const remuneracoes = await fetchRemuneracaoByYear(servidor.id, targetYear);

      if (remuneracoes.length === 0) {
        setSalaryError(`Nenhum registro de remuneração encontrado para ${targetYear}.`);
      } else {
        // Map to chart format (Monthly breakdown)
        const monthlyData = remuneracoes.map(r => {
            // Calculate Gross Total (Bruto + Indenizações + Outras)
            // Note: values come as strings "10.000,00"
            const bruto = parseFloat(r.remuneracaoBasicaBruta.replace(/\./g, '').replace(',', '.')) || 0;
            const outras = parseFloat(r.outrasVerbasRemuneratorias.replace(/\./g, '').replace(',', '.')) || 0;
            const indenizatorias = parseFloat(r.verbasIndenizatorias.replace(/\./g, '').replace(',', '.')) || 0;
            
            return {
              name: `${r.mes}/${r.ano}`,
              amount: bruto + outras + indenizatorias
            };
        }).sort((a, b) => {
           // Sort by month/year string roughly
           const [mesA] = a.name.split('/');
           const [mesB] = b.name.split('/');
           return parseInt(mesA) - parseInt(mesB);
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
        years.map(year => fetchAmendmentsByAuthor(candidate.name, year))
      );

      const validResults = results.filter((r): r is DetailedAmendmentStats => r !== null);

      if (validResults.length === 0) {
        setRealDataError("Nenhum registro encontrado para este nome exato no Portal da Transparência.");
      } else {
        // Aggregate all years for global stats
        let totalProposed = 0;
        let totalExecuted = 0;
        const areaMap: Record<string, number> = {};
        const locationMap: Record<string, number> = {};

        const history: AmendmentHistory[] = validResults.map(r => {
          totalProposed += r.totalEmpenhado;
          totalExecuted += r.totalPago;

          // Merge Areas
          Object.entries(r.areas).forEach(([area, val]) => {
            areaMap[area] = (areaMap[area] || 0) + val;
          });

          // Merge Locations
          Object.entries(r.locations).forEach(([loc, val]) => {
            locationMap[loc] = (locationMap[loc] || 0) + val;
          });

          return {
            year: r.year,
            proposed: r.totalEmpenhado,
            executed: r.totalPago
          };
        }).sort((a, b) => b.year - a.year);

        // Get Top 3 Areas
        const topAreas = Object.entries(areaMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([name]) => name);

        // Get Top Locations (for Geo Distribution)
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
    if (candidate.sphere !== 'Federal') return;
    
    setIsSyncingCamara(true);
    setCamaraError(null);
    
    try {
      // 1. Find Deputy ID
      const deputy = await findDeputyByName(candidate.name);
      
      if (!deputy) {
        setCamaraError(`Deputado "${candidate.name}" não encontrado na base da Câmara.`);
        setIsSyncingCamara(false);
        return;
      }

      // Update photo if available
      if (deputy.urlFoto) {
        setDeputyPhotoOverride(deputy.urlFoto);
      }

      // 2. Fetch Expenses for current year
      const expenses = await getDeputyExpenses(deputy.id, 2023); 

      if (expenses.length === 0) {
        setCamaraError("Nenhuma despesa encontrada para o ano de referência (2023).");
      } else {
        const aggregated = aggregateExpensesByCategory(expenses);
        const topExpenses = getTopIndividualExpenses(expenses);
        
        setCeapDataOverride(aggregated.slice(0, 5)); // Take top 5 categories
        setCeapTopExpenses(topExpenses);
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
      const results = await searchFactChecks(candidate.name);
      if (results.length === 0) {
        setFactCheckError("Nenhuma checagem de fatos encontrada recentemente para este candidato.");
        setFactChecks([]);
      } else {
        setFactChecks(results);
      }
    } catch (e: any) {
      if (e.message.includes("Chave de API")) {
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
              src={deputyPhotoOverride || candidate.photoUrl} 
              alt={candidate.name} 
              className="w-32 h-32 rounded-full border-4 border-white shadow-md bg-gray-200 object-cover"
            />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{candidate.name}</h1>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                <span className="px-2 py-1 bg-gray-100 rounded text-gray-800 font-semibold">{candidate.party}</span>
                <span className="px-2 py-1 bg-gray-100 rounded">Disputa: <strong>{candidate.disputedRole}</strong></span>
                <span className="px-2 py-1 bg-gray-100 rounded">Atual: {candidate.currentRole}</span>
                <span className="px-2 py-1 bg-gray-100 rounded">{candidate.location}</span>
              </div>
            </div>
            <div className="mt-4 md:mt-0">
               <EfficiencyBadge rating={candidate.efficiencyRating} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 border-t border-gray-100 pt-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Gasto Total (10 Anos)</p>
              <p className="text-2xl font-bold text-brand-700">{FORMATTER_BRL.format(candidate.totalSpending10Years)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Custo Per Capita</p>
              <p className="text-2xl font-bold text-gray-800">R$ {candidate.spendingPerCapita.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Tendência</p>
              <p className="text-2xl font-bold text-gray-800">{candidate.spendingTrend}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Comp. Média Partido</p>
              <p className={`text-2xl font-bold ${candidate.partyAverageComparison > 1 ? 'text-red-600' : 'text-green-600'}`}>
                {((candidate.partyAverageComparison - 1) * 100).toFixed(0)}% {candidate.partyAverageComparison > 1 ? 'Acima' : 'Abaixo'}
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

              <div className="h-64 w-full">
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
                 
                 {candidate.sphere === 'Federal' && (
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

              {ceapDataOverride && (
                <p className="text-xs text-gray-500 mt-4 px-4 italic text-right border-t border-gray-100 pt-2">
                  Fonte Oficial: API de Dados Abertos da Câmara dos Deputados (v2).
                </p>
              )}
            </div>
          )}

          {/* Emendas */}
          {(activeFilter === 'TODOS' || activeFilter === 'EMENDAS') && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h3 className="text-lg font-bold text-gray-900">Análise de Emendas Parlamentares</h3>
                
                {/* API Integration Button */}
                {candidate.sphere === 'Federal' && (
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

              {realDataError && (
                <div className="mb-4 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{realDataError}</span>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
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
              </div>

              {/* Bar Chart: Amendment Evolution */}
              {amendmentHistoryData.length > 0 && (
                <div className="border-t border-gray-100 pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h4 className="text-md font-bold text-gray-900">Evolução de Emendas (Proposto vs Executado)</h4>
                    {realAmendmentStats && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full font-medium">Dados Reais</span>}
                  </div>
                  
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={amendmentHistoryData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="year" />
                        <YAxis tickFormatter={(val) => `R$${(val/1000000).toFixed(1)}M`} />
                        <Tooltip formatter={(value: number) => FORMATTER_BRL.format(value)} />
                        <Legend />
                        <Bar dataKey="proposed" name="Proposto (Empenhado)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="executed" name="Executado (Pago)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {realAmendmentStats && (
                     <p className="text-xs text-gray-500 mt-2 text-center">Fonte: API Portal da Transparência - CGU. Consulta em tempo real.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SEÇÃO 5 - ACHADOS E RECOMENDAÇÕES */}
        <div className="space-y-8">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-brand-500 border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-brand-600" />
              Achados da Auditoria
            </h3>
            <ul className="space-y-3">
              {candidate.keyFindings.map((finding, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-gray-700">
                  <Info className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
           </div>

           {/* NOVA SEÇÃO: FACT CHECK */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                 <CheckSquare className="w-5 h-5 text-brand-600" />
                 Verificação de Fatos
               </h3>
               {!factChecks && (
                  <button 
                    onClick={handleFetchFactCheck}
                    disabled={isLoadingFactCheck}
                    className="text-xs bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 px-3 py-2 rounded-lg flex items-center gap-2 transition"
                  >
                    {isLoadingFactCheck ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Search className="w-3 h-3"/>}
                    Buscar no Google
                  </button>
               )}
             </div>

             {isLoadingFactCheck && (
               <div className="py-4 text-center text-sm text-gray-500">
                 Buscando checagens de fatos recentes...
               </div>
             )}

             {factCheckError && (
               <div className="bg-red-50 text-red-700 text-xs p-3 rounded border border-red-100 mb-2">
                 {factCheckError}
               </div>
             )}

             {factChecks && factChecks.length === 0 && !factCheckError && (
                <div className="text-sm text-gray-500 italic py-2">
                  Nenhuma checagem recente encontrada para este nome.
                </div>
             )}

             {factChecks && factChecks.length > 0 && (
               <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                 {factChecks.slice(0, 3).map((claim, idx) => {
                   const review = claim.claimReview[0];
                   return (
                     <div key={idx} className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition">
                       <p className="text-xs font-semibold text-gray-800 mb-1 line-clamp-2">"{claim.text}"</p>
                       <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">Reivindicado por: {claim.claimant || "Desconhecido"}</span>
                          {getRatingBadge(review.textualRating)}
                       </div>
                       <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-gray-50">
                          <span className="text-gray-500">{review.publisher.name}</span>
                          <a href={review.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                            Ler checagem <ExternalLink className="w-3 h-3"/>
                          </a>
                       </div>
                     </div>
                   );
                 })}
                 <p className="text-xs text-center text-gray-400 mt-2">Powered by Google Fact Check Tools</p>
               </div>
             )}
           </div>

           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <h3 className="text-lg font-bold text-gray-900 mb-4">Dados e Transparência</h3>
             <div className="flex items-center gap-4 mb-4">
               <div className="flex-1">
                 <div className="flex justify-between text-sm mb-1">
                   <span className="font-medium text-gray-700">Disponibilidade de Dados</span>
                   <span className="font-bold text-brand-700">{candidate.dataAvailabilityScore}%</span>
                 </div>
                 <div className="w-full bg-gray-100 rounded-full h-2.5">
                   <div 
                    className={`h-2.5 rounded-full ${candidate.dataAvailabilityScore > 80 ? 'bg-green-500' : 'bg-yellow-500'}`} 
                    style={{ width: `${candidate.dataAvailabilityScore}%` }}
                   ></div>
                 </div>
               </div>
             </div>
             {candidate.missingDataWarnings.length > 0 && (
               <div className="bg-yellow-50 p-3 rounded border border-yellow-100 text-xs text-yellow-800 flex gap-2">
                 <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                 <div>
                   <p className="font-bold mb-1">Atenção:</p>
                   {candidate.missingDataWarnings.map((w, i) => <p key={i}>{w}</p>)}
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
                Compare a eficiência deste candidato com a média do partido ({((candidate.partyAverageComparison - 1) * 100).toFixed(0)}% vs média). 
                {candidate.efficiencyRating === EfficiencyRating.ALTA 
                  ? ' Candidato apresenta boa gestão de recursos.' 
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