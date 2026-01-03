import React, { useState, useMemo, useCallback } from 'react';
import { PARTY_LOGOS } from './constants';
import { Sphere, CandidacyStatus, Politician } from './types';
import ComparisonTable from './components/ComparisonTable';
import DetailView from './components/DetailView';
import { usePoliticians } from './hooks/usePoliticians';
import { Search, BarChart2, Shield, AlertCircle, TrendingUp, Users, ChevronRight, Filter, X, RefreshCw, Loader2, Wifi, WifiOff, Database } from 'lucide-react';

// Formatador de data/hora
const formatDateTime = (isoDate: string): string => {
  return new Date(isoDate).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

enum ViewState {
  LIST = 'list',
  DETAIL = 'detail',
  METHODOLOGY = 'methodology'
}

const App: React.FC = () => {
  // Hook para carregar dados reais das APIs oficiais
  const { 
    politicians, 
    loading, 
    error, 
    lastUpdated, 
    apiStatus, 
    refresh, 
    isRefreshing 
  } = usePoliticians();

  const [view, setView] = useState<ViewState>(ViewState.LIST);
  const [selectedPoliticianId, setSelectedPoliticianId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sphereFilter, setSphereFilter] = useState<Sphere | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<CandidacyStatus | 'All'>('All');

  const filteredPoliticians = useMemo(() => {
    return politicians.filter((c: Politician) => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            c.party.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSphere = sphereFilter === 'All' || c.sphere === sphereFilter;
      const matchesStatus = statusFilter === 'All' || c.candidacyStatus === statusFilter;
      
      return matchesSearch && matchesSphere && matchesStatus;
    });
  }, [politicians, searchTerm, sphereFilter, statusFilter]);

  const handleSelectPolitician = useCallback((id: string) => {
    setSelectedPoliticianId(id);
    setView(ViewState.DETAIL);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBack = useCallback(() => {
    setSelectedPoliticianId(null);
    setView(ViewState.LIST);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setSphereFilter('All');
    setStatusFilter('All');
  }, []);

  const selectedPolitician = politicians.find((c: Politician) => c.id === selectedPoliticianId);
  const hasActiveFilters = searchTerm || sphereFilter !== 'All' || statusFilter !== 'All';

  // Status indicator component
  const StatusIndicator = () => {
    const isOnline = apiStatus?.camara || apiStatus?.senado;
    return (
      <div className="flex items-center gap-2 text-xs">
        {isOnline ? (
          <Wifi className="w-3.5 h-3.5 text-green-500" aria-hidden="true" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
        )}
        <span className={`font-medium ${isOnline ? 'text-green-600' : 'text-amber-600'}`}>
          {isOnline ? 'APIs Online' : 'Modo Offline'}
        </span>
        {lastUpdated && (
          <span className="text-slate-400">
            • Atualizado: {formatDateTime(lastUpdated.toISOString())}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Skip Link para acessibilidade */}
      <a href="#main-content" className="skip-link">
        Pular para conteúdo principal
      </a>

      {/* Modern Glassmorphism Header */}
      <header 
        className="fixed w-full top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/80 shadow-sm transition-all duration-300"
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button 
            className="flex items-center gap-2.5 group focus-ring rounded-xl p-1 -ml-1" 
            onClick={() => setView(ViewState.LIST)}
            aria-label="Ir para página inicial"
          >
            <div className="p-1.5 bg-brand-600 rounded-lg shadow-lg shadow-brand-200/50 group-hover:scale-105 group-hover:shadow-brand-300/50 transition-all duration-300 ease-out-expo">
              <Shield className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none text-slate-800 tracking-tight">
                Transparência<span className="text-brand-600">PE</span>
              </h1>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Auditoria Cívica</p>
            </div>
          </button>
          
          <nav className="hidden md:flex gap-1 bg-slate-100/50 p-1 rounded-full border border-slate-200" role="navigation" aria-label="Navegação principal">
            <button 
              onClick={() => setView(ViewState.LIST)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-250 ease-out-expo focus-ring ${
                view === ViewState.LIST 
                  ? 'bg-white text-brand-700 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
              aria-current={view === ViewState.LIST ? 'page' : undefined}
            >
              Monitoramento
            </button>
            <button 
              onClick={() => setView(ViewState.METHODOLOGY)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-250 ease-out-expo focus-ring ${
                view === ViewState.METHODOLOGY 
                  ? 'bg-white text-brand-700 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
              aria-current={view === ViewState.METHODOLOGY ? 'page' : undefined}
            >
              Metodologia
            </button>
          </nav>

          {/* Refresh Button & Status */}
          <div className="flex items-center gap-3">
            <StatusIndicator />
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-ring disabled:opacity-50"
              aria-label={isRefreshing ? 'Atualizando dados...' : 'Atualizar dados'}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 w-full pt-20" role="main">
        
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-in">
            <div className="relative">
              <Database className="w-16 h-16 text-slate-200" aria-hidden="true" />
              <Loader2 className="w-8 h-8 text-brand-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" aria-hidden="true" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-700">Carregando dados das APIs oficiais...</p>
              <p className="text-sm text-slate-500 mt-1">
                Consultando Câmara dos Deputados, Senado Federal e TSE
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="max-w-2xl mx-auto px-4 py-20">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-red-800 mb-2">Erro ao carregar dados</h2>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={refresh}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus-ring"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {!loading && !error && view === ViewState.LIST && (
          <div className="animate-in">
            {/* Hero Section */}
            <section 
              className="bg-gradient-to-b from-slate-50 via-white to-white pt-10 pb-16 px-4 border-b border-slate-200"
              aria-labelledby="hero-title"
            >
              <div className="max-w-4xl mx-auto text-center space-y-6">
                <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-xs font-bold uppercase tracking-wide border border-brand-100 shadow-sm">
                  <span className="w-2 h-2 bg-brand-500 rounded-full mr-2 animate-pulse-soft" aria-hidden="true"></span>
                  Dados atualizados: 2024
                </span>
                <h2 id="hero-title" className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight text-balance">
                  Siga o dinheiro <br className="hidden md:block" />
                  <span className="gradient-text">
                     antes de dar o seu voto.
                  </span>
                </h2>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed text-balance">
                  Monitoramos gastos, emendas e eficiência parlamentar em Pernambuco. 
                  Transformamos dados complexos em informação clara para sua decisão.
                </p>
                
                {/* Enhanced Search Bar */}
                <div className="relative max-w-2xl mx-auto mt-8 group">
                  <label htmlFor="search-politicians" className="sr-only">
                    Pesquisar políticos
                  </label>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors duration-200" aria-hidden="true" />
                  </div>
                  <input
                    id="search-politicians"
                    type="search"
                    className="block w-full pl-12 pr-12 py-4 border-0 rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-brand-500 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 hover:ring-slate-300 text-lg transition-all duration-200"
                    placeholder="Pesquise por nome, partido ou cargo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-describedby="search-hint"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label="Limpar pesquisa"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                  <span id="search-hint" className="sr-only">
                    Digite para pesquisar por nome de político, partido ou cargo
                  </span>
                </div>
                
                {/* Visual Filters */}
                <div className="flex flex-col md:flex-row justify-center items-center gap-4 pt-4" role="group" aria-label="Filtros">
                  <fieldset className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <legend className="sr-only">Filtrar por esfera de governo</legend>
                    {(['All', 'Federal', 'Estadual', 'Municipal'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSphereFilter(s as Sphere | 'All')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ease-out-expo focus-ring ${
                          sphereFilter === s 
                            ? 'bg-slate-800 text-white shadow-md' 
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                        }`}
                        aria-pressed={sphereFilter === s}
                      >
                        {s === 'All' ? 'Todas' : s}
                      </button>
                    ))}
                  </fieldset>

                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    <label htmlFor="status-filter" className="sr-only">Filtrar por status eleitoral</label>
                    <select 
                      id="status-filter"
                      className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus-ring cursor-pointer hover:border-slate-300 transition-colors"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as CandidacyStatus | 'All')}
                    >
                      <option value="All">Todos os Status</option>
                      <option value={CandidacyStatus.CONFIRMADA}>Candidaturas Confirmadas</option>
                      <option value={CandidacyStatus.PRE_CANDIDATO}>Pré-Candidatos</option>
                    </select>
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors focus-ring"
                      aria-label="Limpar todos os filtros"
                    >
                      <X className="w-3.5 h-3.5" />
                      Limpar filtros
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Content Container */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" aria-labelledby="results-title">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-brand-100 rounded-xl">
                      <BarChart2 className="w-5 h-5 text-brand-600" aria-hidden="true" />
                   </div>
                   <div>
                     <h3 id="results-title" className="text-xl font-bold text-slate-800">Ranking & Análise</h3>
                     <p className="text-sm text-slate-500">Dados públicos consolidados</p>
                   </div>
                 </div>
                 <span className="text-sm font-medium text-slate-600 bg-slate-100 px-4 py-2 rounded-full" role="status" aria-live="polite">
                   {filteredPoliticians.length} {filteredPoliticians.length === 1 ? 'político encontrado' : 'políticos encontrados'}
                 </span>
              </div>
              
              {filteredPoliticians.length > 0 ? (
                <div className="space-y-10">
                  {/* Cards Grid */}
                  <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" role="list" aria-label="Lista de políticos">
                     {filteredPoliticians.map((c, index) => (
                        <li key={c.id} className="animate-in" style={{ animationDelay: `${index * 50}ms` }}>
                          <article 
                            onClick={() => handleSelectPolitician(c.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSelectPolitician(c.id)}
                            tabIndex={0}
                            role="button"
                            aria-label={`Ver análise completa de ${c.name}`}
                            className="group card card-hover card-interactive h-full flex flex-col overflow-hidden"
                          >
                            {/* Card Header */}
                            <div className="relative h-24 bg-gradient-to-br from-slate-100 via-slate-50 to-white">
                               <div 
                                 className={`absolute top-3 right-3 w-3 h-3 rounded-full ring-2 ring-white shadow-sm ${
                                   c.candidacyStatus === CandidacyStatus.CONFIRMADA ? 'bg-emerald-500' :
                                   c.candidacyStatus === CandidacyStatus.PRE_CANDIDATO ? 'bg-amber-400' :
                                   'bg-slate-400'
                                 }`}
                                 title={c.candidacyStatus === CandidacyStatus.CONFIRMADA ? 'Candidatura confirmada' : c.candidacyStatus === CandidacyStatus.PRE_CANDIDATO ? 'Pré-candidato' : 'Não concorre'}
                                 aria-hidden="true"
                               ></div>
                            </div>
                            
                            {/* Avatar & Info */}
                            <div className="px-5 pb-5 -mt-10 flex-1 flex flex-col relative">
                              <div className="flex justify-between items-end mb-3">
                                <img 
                                  src={PARTY_LOGOS[c.party] || PARTY_LOGOS['DEFAULT']} 
                                  className="w-16 h-16 rounded-xl object-contain bg-white shadow-elevated border border-slate-100 p-1.5 group-hover:scale-105 group-hover:shadow-elevated-lg transition-all duration-300 ease-out-expo" 
                                  alt={`Logo do partido ${c.party}`}
                                  loading="lazy"
                                />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.party}</span>
                              </div>
                              
                              <h4 className="text-lg font-bold text-slate-900 leading-tight mb-1 group-hover:text-brand-600 transition-colors duration-200">{c.name}</h4>
                              <p className="text-sm text-slate-500 font-medium mb-4">{c.currentRole || c.position}</p>
                              
                              {/* Metrics Mini-Grid */}
                              <div className="grid grid-cols-2 gap-2 mb-4 mt-auto">
                                 <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Eficiência</p>
                                    <p className="text-sm font-bold text-slate-700">{c.efficiencyRating}</p>
                                 </div>
                                 <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Alertas</p>
                                    <p className={`text-sm font-bold ${c.redFlags.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      {c.redFlags.length > 0 ? `${c.redFlags.length} Pontos` : 'Nenhum'}
                                    </p>
                                 </div>
                              </div>

                              <span className="flex items-center text-brand-600 font-semibold text-sm group-hover:gap-2 transition-all duration-200">
                                Ver análise completa <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform duration-200" aria-hidden="true" />
                              </span>
                            </div>
                          </article>
                        </li>
                     ))}
                  </ul>

                  {/* Comparison Table Section */}
                  <section className="card overflow-hidden" aria-labelledby="comparison-title">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                       <h4 id="comparison-title" className="font-bold text-slate-700">Visão Tabular Comparativa</h4>
                       <button className="btn-ghost text-xs font-medium text-brand-600 hover:text-brand-800 px-3 py-1.5 rounded-lg focus-ring">
                         Exportar Dados
                       </button>
                    </div>
                    <ComparisonTable politicians={filteredPoliticians} />
                  </section>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300" role="status" aria-live="polite">
                  <div className="p-4 bg-slate-50 rounded-full mb-4">
                    <Search className="w-8 h-8 text-slate-400" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Nenhum resultado encontrado</h3>
                  <p className="text-slate-500 mb-4">Tente ajustar seus filtros ou buscar por outro termo.</p>
                  <button 
                    onClick={clearFilters}
                    className="btn btn-primary"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {view === ViewState.DETAIL && selectedPolitician && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in">
             <DetailView candidate={selectedPolitician} onBack={handleBack} />
          </div>
        )}

        {view === ViewState.METHODOLOGY && (
          <article className="max-w-3xl mx-auto px-4 py-12 animate-in">
            <div className="card p-8 md:p-12">
               <button 
                 onClick={() => setView(ViewState.LIST)} 
                 className="mb-8 flex items-center text-sm font-semibold text-slate-500 hover:text-brand-600 transition-colors focus-ring rounded-lg p-1 -ml-1"
               >
                 <ChevronRight className="w-4 h-4 rotate-180 mr-1" aria-hidden="true" /> Voltar para lista
               </button>
               
               <div className="prose prose-slate prose-lg max-w-none">
                 <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Metodologia e Transparência</h1>
                 <p className="lead text-xl text-slate-600 mb-8 text-balance">
                   Como calculamos eficiência e identificamos irregularidades de forma imparcial.
                 </p>

                 <div className="grid md:grid-cols-2 gap-6 my-8 not-prose">
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all duration-200">
                       <TrendingUp className="w-8 h-8 text-brand-600 mb-4" aria-hidden="true" />
                       <h3 className="text-lg font-bold text-slate-900 mb-2">Eficiência Financeira</h3>
                       <p className="text-slate-600 text-sm leading-relaxed">Cruzamos o custo do gabinete com a produção legislativa e a taxa de execução de emendas que viraram obras reais.</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all duration-200">
                       <AlertCircle className="w-8 h-8 text-rose-500 mb-4" aria-hidden="true" />
                       <h3 className="text-lg font-bold text-slate-900 mb-2">Bandeiras Vermelhas</h3>
                       <p className="text-slate-600 text-sm leading-relaxed">Monitoramos processos judiciais, irregularidades no CEAP (combustível, refeições) e alertas de Tribunais de Contas.</p>
                    </div>
                 </div>
                 
                 <h3>Fontes de Dados Confiáveis</h3>
                 <p>Utilizamos apenas dados públicos abertos e APIs oficiais:</p>
                 <ul className="list-disc pl-5 space-y-2 text-slate-700">
                   <li><strong>API da Câmara dos Deputados:</strong> Para gastos de cota parlamentar (CEAP) e presença.</li>
                   <li><strong>Portal da Transparência (CGU):</strong> Para emendas parlamentares e salários do executivo.</li>
                   <li><strong>TSE (DivulgaCand):</strong> Para status de candidatura e patrimônio.</li>
                   <li><strong>Google Fact Check Tools:</strong> Para verificação cruzada de notícias falsas.</li>
                 </ul>

                 <aside className="mt-10 p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4 items-start not-prose" role="note">
                   <Shield className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                   <div>
                     <h4 className="font-bold text-amber-900 text-base">Compromisso de Neutralidade</h4>
                     <p className="text-sm text-amber-800 mt-2 leading-relaxed">
                       Este é um projeto de tecnologia cívica Open Source. Não possuímos afiliação partidária. 
                       Os dados apresentados são automatizados e podem conter simulações para fins demonstrativos desta interface ("Mock Data"). 
                       Sempre consulte as fontes oficiais linkadas antes de votar.
                     </p>
                   </div>
                 </aside>
               </div>
            </div>
          </article>
        )}

      </main>

      <footer className="bg-slate-900 text-slate-400 py-12 mt-auto border-t border-slate-800" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4 text-white">
              <Shield className="w-6 h-6" aria-hidden="true" />
              <span className="font-bold text-lg">TransparênciaPE</span>
            </div>
            <p className="text-sm leading-relaxed">
              Empoderando o cidadão pernambucano com dados claros e acessíveis para uma democracia mais forte.
            </p>
          </div>
          <nav aria-label="Links de fontes">
            <h4 className="font-bold text-white mb-4">Fontes</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="https://portaldatransparencia.gov.br" target="_blank" rel="noopener noreferrer" className="hover:text-brand-400 transition-colors focus-ring rounded">Portal da Transparência</a></li>
              <li><a href="https://dadosabertos.camara.leg.br" target="_blank" rel="noopener noreferrer" className="hover:text-brand-400 transition-colors focus-ring rounded">Dados Abertos Câmara</a></li>
              <li><a href="https://divulgacandcontas.tse.jus.br" target="_blank" rel="noopener noreferrer" className="hover:text-brand-400 transition-colors focus-ring rounded">TSE DivulgaCand</a></li>
            </ul>
          </nav>
          <nav aria-label="Links legais">
            <h4 className="font-bold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-brand-400 transition-colors focus-ring rounded">Termos de Uso</a></li>
              <li><a href="#" className="hover:text-brand-400 transition-colors focus-ring rounded">Política de Privacidade</a></li>
              <li><span className="text-slate-600">v1.2.0 (Beta)</span></li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default App;