import React, { useState, useMemo } from 'react';
import { MOCK_POLITICIANS, PARTY_LOGOS } from './constants';
import { Sphere, CandidacyStatus } from './types';
import ComparisonTable from './components/ComparisonTable';
import DetailView from './components/DetailView';
import { Search, BarChart2, Shield, AlertCircle, TrendingUp, Users, ChevronRight, Filter } from 'lucide-react';

enum ViewState {
  LIST = 'list',
  DETAIL = 'detail',
  METHODOLOGY = 'methodology'
}

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.LIST);
  const [selectedPoliticianId, setSelectedPoliticianId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sphereFilter, setSphereFilter] = useState<Sphere | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<CandidacyStatus | 'All'>('All');

  const filteredPoliticians = useMemo(() => {
    return MOCK_POLITICIANS.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            c.party.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSphere = sphereFilter === 'All' || c.sphere === sphereFilter;
      const matchesStatus = statusFilter === 'All' || c.candidacyStatus === statusFilter;
      
      return matchesSearch && matchesSphere && matchesStatus;
    });
  }, [searchTerm, sphereFilter, statusFilter]);

  const handleSelectPolitician = (id: string) => {
    setSelectedPoliticianId(id);
    setView(ViewState.DETAIL);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setSelectedPoliticianId(null);
    setView(ViewState.LIST);
  };

  const selectedPolitician = MOCK_POLITICIANS.find(c => c.id === selectedPoliticianId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Modern Glassmorphism Header */}
      <header className="fixed w-full top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2.5 cursor-pointer group" 
            onClick={() => setView(ViewState.LIST)}
          >
            <div className="p-1.5 bg-brand-600 rounded-lg shadow-brand-200 shadow-lg group-hover:scale-105 transition-transform duration-300">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none text-slate-800 tracking-tight">Transparência<span className="text-brand-600">PE</span></h1>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Auditoria Cívica</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-1 bg-slate-100/50 p-1 rounded-full border border-slate-200">
            <button 
              onClick={() => setView(ViewState.LIST)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ${view === ViewState.LIST ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Monitoramento
            </button>
            <button 
              onClick={() => setView(ViewState.METHODOLOGY)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ${view === ViewState.METHODOLOGY ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Metodologia
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full pt-20">
        
        {view === ViewState.LIST && (
          <div className="animate-fade-in-up">
            {/* Hero Section */}
            <div className="bg-gradient-to-b from-slate-50 to-white pt-10 pb-16 px-4 border-b border-slate-200">
              <div className="max-w-4xl mx-auto text-center space-y-6">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-bold uppercase tracking-wide border border-brand-100 mb-2">
                  Dados atualizados: 2024
                </span>
                <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
                  Siga o dinheiro <br className="hidden md:block" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400">
                     antes de dar o seu voto.
                  </span>
                </h2>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                  Monitoramos gastos, emendas e eficiência parlamentar em Pernambuco. 
                  Transformamos dados complexos em informação clara para sua decisão.
                </p>
                
                {/* Enhanced Search Bar */}
                <div className="relative max-w-2xl mx-auto mt-8 group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-11 pr-4 py-4 border-0 rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-brand-500 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 text-lg transition-all"
                    placeholder="Pesquise por nome, partido ou cargo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                {/* Visual Filters */}
                <div className="flex flex-col md:flex-row justify-center items-center gap-4 pt-4">
                  <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    {(['All', 'Federal', 'Estadual', 'Municipal'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSphereFilter(s as Sphere | 'All')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          sphereFilter === s 
                            ? 'bg-slate-800 text-white shadow-md' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                      >
                        {s === 'All' ? 'Todas' : s}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select 
                      className="bg-transparent text-sm font-medium text-slate-600 focus:outline-none cursor-pointer hover:text-brand-600"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as CandidacyStatus | 'All')}
                    >
                      <option value="All">Todos os Status</option>
                      <option value={CandidacyStatus.CONFIRMADA}>Candidaturas Confirmadas</option>
                      <option value={CandidacyStatus.PRE_CANDIDATO}>Pré-Candidatos</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-2">
                   <div className="p-2 bg-brand-100 rounded-lg">
                      <BarChart2 className="w-5 h-5 text-brand-600" />
                   </div>
                   <h3 className="text-xl font-bold text-slate-800">Ranking & Análise</h3>
                 </div>
                 <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                   {filteredPoliticians.length} políticos encontrados
                 </span>
              </div>
              
              {filteredPoliticians.length > 0 ? (
                <div className="space-y-8">
                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                     {filteredPoliticians.map(c => (
                        <div 
                          key={c.id}
                          onClick={() => handleSelectPolitician(c.id)}
                          className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-brand-200 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                        >
                          {/* Card Header */}
                          <div className="relative h-24 bg-gradient-to-r from-slate-100 to-slate-200">
                             <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ring-2 ring-white ${
                               c.candidacyStatus === CandidacyStatus.CONFIRMADA ? 'bg-green-500' :
                               c.candidacyStatus === CandidacyStatus.PRE_CANDIDATO ? 'bg-yellow-400' :
                               'bg-slate-400'
                             }`}></div>
                          </div>
                          
                          {/* Avatar & Info */}
                          <div className="px-5 pb-5 -mt-10 flex-1 flex flex-col relative">
                            <div className="flex justify-between items-end mb-3">
                              <img 
                                src={PARTY_LOGOS[c.party] || PARTY_LOGOS['DEFAULT']} 
                                className="w-16 h-16 rounded-xl object-contain bg-white shadow-md border border-slate-100 p-1 group-hover:scale-105 transition-transform" 
                                alt={`Logo ${c.party}`} 
                              />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.party}</span>
                            </div>
                            
                            <h4 className="text-lg font-bold text-slate-900 leading-tight mb-1 group-hover:text-brand-600 transition-colors">{c.name}</h4>
                            <p className="text-sm text-slate-500 font-medium mb-4">{c.currentRole}</p>
                            
                            {/* Metrics Mini-Grid */}
                            <div className="grid grid-cols-2 gap-2 mb-4 mt-auto">
                               <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Eficiência</p>
                                  <p className="text-xs font-bold text-slate-700">{c.efficiencyRating}</p>
                               </div>
                               <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Alertas</p>
                                  <p className={`text-xs font-bold ${c.redFlags.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {c.redFlags.length > 0 ? `${c.redFlags.length} Pontos` : 'Nenhum'}
                                  </p>
                               </div>
                            </div>

                            <div className="flex items-center text-brand-600 font-semibold text-sm group-hover:underline decoration-2 underline-offset-2">
                              Ver análise completa <ChevronRight className="w-4 h-4 ml-1" />
                            </div>
                          </div>
                        </div>
                     ))}
                  </div>

                  {/* Comparison Table Section */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                       <h4 className="font-bold text-slate-700">Visão Tabular Comparativa</h4>
                       <button className="text-xs font-medium text-brand-600 hover:text-brand-800">Exportar Dados</button>
                    </div>
                    <ComparisonTable politicians={filteredPoliticians} />
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                  <div className="p-4 bg-slate-50 rounded-full mb-4">
                    <Search className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Nenhum resultado encontrado</h3>
                  <p className="text-slate-500">Tente ajustar seus filtros ou buscar por outro termo.</p>
                  <button 
                    onClick={() => {setSearchTerm(''); setSphereFilter('All'); setStatusFilter('All');}}
                    className="mt-4 text-brand-600 font-medium hover:underline"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {view === ViewState.DETAIL && selectedPolitician && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
             <DetailView candidate={selectedPolitician} onBack={handleBack} />
          </div>
        )}

        {view === ViewState.METHODOLOGY && (
          <div className="max-w-3xl mx-auto px-4 py-12 animate-fade-in-up">
            <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
               <button onClick={() => setView(ViewState.LIST)} className="mb-8 flex items-center text-sm font-semibold text-slate-500 hover:text-brand-600 transition-colors">
                 <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Voltar para lista
               </button>
               
               <div className="prose prose-slate prose-lg max-w-none">
                 <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Metodologia e Transparência</h1>
                 <p className="lead text-xl text-slate-600 mb-8">
                   Como calculamos eficiência e identificamos irregularidades de forma imparcial.
                 </p>

                 <div className="grid md:grid-cols-2 gap-6 my-8 not-prose">
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                       <TrendingUp className="w-8 h-8 text-brand-600 mb-4" />
                       <h3 className="text-lg font-bold text-slate-900 mb-2">Eficiência Financeira</h3>
                       <p className="text-slate-600 text-sm">Cruzamos o custo do gabinete com a produção legislativa e a taxa de execução de emendas que viraram obras reais.</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                       <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
                       <h3 className="text-lg font-bold text-slate-900 mb-2">Bandeiras Vermelhas</h3>
                       <p className="text-slate-600 text-sm">Monitoramos processos judiciais, irregularidades no CEAP (combustível, refeições) e alertas de Tribunais de Contas.</p>
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

                 <div className="mt-10 p-6 bg-amber-50 rounded-xl border border-amber-100 flex gap-4 items-start not-prose">
                   <Shield className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                   <div>
                     <h4 className="font-bold text-amber-900 text-base">Compromisso de Neutralidade</h4>
                     <p className="text-sm text-amber-800 mt-1">
                       Este é um projeto de tecnologia cívica Open Source. Não possuímos afiliação partidária. 
                       Os dados apresentados são automatizados e podem conter simulações para fins demonstrativos desta interface ("Mock Data"). 
                       Sempre consulte as fontes oficiais linkadas antes de votar.
                     </p>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        )}

      </main>

      <footer className="bg-slate-900 text-slate-400 py-12 mt-auto border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4 text-white">
              <Shield className="w-6 h-6" />
              <span className="font-bold text-lg">TransparênciaPE</span>
            </div>
            <p className="text-sm leading-relaxed">
              Empoderando o cidadão pernambucano com dados claros e acessíveis para uma democracia mais forte.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Fontes</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-brand-400">Portal da Transparência</a></li>
              <li><a href="#" className="hover:text-brand-400">Dados Abertos Câmara</a></li>
              <li><a href="#" className="hover:text-brand-400">TSE DivulgaCand</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-brand-400">Termos de Uso</a></li>
              <li><a href="#" className="hover:text-brand-400">Política de Privacidade</a></li>
              <li><span className="text-slate-600">v1.2.0 (Beta)</span></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;