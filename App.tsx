import React, { useState, useMemo } from 'react';
import { MOCK_POLITICIANS, PARTY_LOGOS } from './constants';
import { Sphere, CandidacyStatus } from './types';
import ComparisonTable from './components/ComparisonTable';
import DetailView from './components/DetailView';
import { Search, BarChart2, Shield, AlertCircle, FileText } from 'lucide-react';

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
  };

  const handleBack = () => {
    setSelectedPoliticianId(null);
    setView(ViewState.LIST);
  };

  const selectedPolitician = MOCK_POLITICIANS.find(c => c.id === selectedPoliticianId);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-brand-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView(ViewState.LIST)}>
            <Shield className="w-8 h-8 text-brand-400" />
            <div>
              <h1 className="text-xl font-bold leading-none">Transparência PE</h1>
              <p className="text-xs text-brand-300">Auditoria Cívica de Políticos</p>
            </div>
          </div>
          <nav className="flex gap-4 text-sm font-medium">
            <button 
              onClick={() => setView(ViewState.LIST)}
              className={`hover:text-brand-200 transition ${view === ViewState.LIST ? 'text-white underline decoration-2 underline-offset-4' : 'text-brand-100'}`}
            >
              Políticos
            </button>
            <button 
              onClick={() => setView(ViewState.METHODOLOGY)}
              className={`hover:text-brand-200 transition ${view === ViewState.METHODOLOGY ? 'text-white underline decoration-2 underline-offset-4' : 'text-brand-100'}`}
            >
              Metodologia
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {view === ViewState.LIST && (
          <div className="space-y-8 animate-fade-in">
            {/* Hero / Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
              <div className="max-w-3xl">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Análise de Parlamentares e Gestores Públicos</h2>
                <p className="text-gray-600 mb-6">
                  Analisamos o histórico de gastos, emendas e eficiência de políticos em exercício em Pernambuco, independente de serem candidatos ou não. 
                  Acompanhe quem está cuidando do seu dinheiro.
                </p>
                
                {/* Search Bar & Filters */}
                <div className="flex flex-col gap-4">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 sm:text-sm shadow-sm"
                      placeholder="Busque por nome, partido ou cidade..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                      {/* Sphere Filter */}
                      <div className="flex flex-wrap gap-2">
                        {(['All', 'Federal', 'Estadual', 'Municipal'] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setSphereFilter(s as Sphere | 'All')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                              sphereFilter === s 
                                ? 'bg-brand-600 text-white shadow-md' 
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {s === 'All' ? 'Todas Esferas' : s}
                          </button>
                        ))}
                      </div>

                      {/* Status Filter */}
                      <div className="relative">
                         <label className="text-xs font-semibold text-gray-500 mr-2 uppercase tracking-wide">Situação Eleitoral:</label>
                         <select 
                            className="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as CandidacyStatus | 'All')}
                         >
                            <option value="All">Mostrar Todos</option>
                            <option value={CandidacyStatus.CONFIRMADA}>Candidatos Confirmados</option>
                            <option value={CandidacyStatus.PRE_CANDIDATO}>Pré-Candidatos</option>
                            <option value={CandidacyStatus.NAO_CANDIDATO}>Não Concorrem</option>
                         </select>
                      </div>
                  </div>
                </div>
              </div>
            </div>

            {/* List View */}
            <div>
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                   <BarChart2 className="w-5 h-5 text-gray-500" />
                   Comparativo Geral
                 </h3>
                 <span className="text-sm text-gray-500">{filteredPoliticians.length} registros encontrados</span>
              </div>
              
              {filteredPoliticians.length > 0 ? (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                     <ComparisonTable politicians={filteredPoliticians} />
                  </table>
                  <div className="p-4 bg-gray-50 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                     {filteredPoliticians.map(c => (
                        <button 
                          key={c.id}
                          onClick={() => handleSelectPolitician(c.id)}
                          className="flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition text-left group relative overflow-hidden"
                        >
                          <div className={`absolute top-0 right-0 w-2 h-full ${
                             c.candidacyStatus === CandidacyStatus.CONFIRMADA ? 'bg-green-500' :
                             c.candidacyStatus === CandidacyStatus.PRE_CANDIDATO ? 'bg-yellow-400' :
                             'bg-gray-300'
                          }`}></div>
                          <img 
                            src={PARTY_LOGOS[c.party] || PARTY_LOGOS['DEFAULT']} 
                            className="w-12 h-12 rounded-full object-contain p-1 bg-white border border-gray-100 group-hover:opacity-80" 
                            alt={`Logo ${c.party}`} 
                          />
                          <div>
                            <p className="font-bold text-gray-900 group-hover:text-brand-600">{c.name}</p>
                            <p className="text-xs text-gray-500">{c.party} • {c.currentRole}</p>
                            <p className="text-xs text-brand-600 font-medium mt-1">Ver ficha completa →</p>
                          </div>
                        </button>
                     ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200 border-dashed">
                  <p className="text-gray-500">Nenhum político encontrado com os filtros atuais.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === ViewState.DETAIL && selectedPolitician && (
          <DetailView candidate={selectedPolitician} onBack={handleBack} />
        )}

        {view === ViewState.METHODOLOGY && (
          <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
             <button onClick={() => setView(ViewState.LIST)} className="mb-6 text-brand-600 font-medium">← Voltar</button>
             <h2 className="text-3xl font-bold text-gray-900 mb-6">Metodologia e Transparência</h2>
             
             <div className="prose prose-blue text-gray-700">
               <p className="mb-4">
                 A metodologia "Ficha de Eficiência" cruza dados de 12 fontes oficiais para criar um índice comparável entre políticos de diferentes esferas, sejam eles candidatos ou não.
               </p>

               <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">Fontes de Dados (Consultadas via API/Scraping)</h3>
               <ul className="list-disc pl-5 space-y-2 mb-6">
                 <li><strong>Câmara dos Deputados:</strong> Dados de CEAP (Cota Parlamentar) e presença.</li>
                 <li><strong>Portal da Transparência (Federal e PE):</strong> Salários, auxílios e verbas indenizatórias.</li>
                 <li><strong>TSE (DivulgaCand):</strong> Patrimônio declarado e histórico eleitoral.</li>
                 <li><strong>Serenata de Amor / Jarbas:</strong> Detecção de anomalias em reembolsos.</li>
               </ul>

               <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">Cálculo de Eficiência</h3>
               <p className="mb-4">
                 O índice de eficiência não mede apenas quem gasta menos, mas quem gasta <strong>melhor</strong>. Consideramos:
               </p>
               <ol className="list-decimal pl-5 space-y-2 mb-6">
                 <li>Custo do gabinete per capita (em relação aos eleitores representados).</li>
                 <li>Taxa de execução de emendas (dinheiro que efetivamente virou obra/serviço).</li>
                 <li>Assiduidade e produção legislativa.</li>
               </ol>

               <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 flex gap-3 mt-8">
                 <AlertCircle className="w-6 h-6 text-yellow-700 flex-shrink-0" />
                 <div>
                   <h4 className="font-bold text-yellow-800">Aviso Legal</h4>
                   <p className="text-sm text-yellow-800">
                     Este é um projeto demonstrativo de tecnologia cívica. Os dados aqui apresentados ("Túlio Gadêlha", etc) podem conter simulações para fins de demonstração da interface. Sempre verifique informações oficiais no site do TSE antes de votar.
                   </p>
                 </div>
               </div>
             </div>
          </div>
        )}

      </main>

      <footer className="bg-gray-800 text-gray-400 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="mb-2">© 2024 Transparência Eleitoral PE - Iniciativa Cívica Independente.</p>
          <p className="text-xs">
            Desenvolvido com tecnologia React e Open Data. Não filiado a nenhum partido político.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;