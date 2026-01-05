import React, { useState, useCallback, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { Upload, FileText, AlertTriangle, CheckCircle, Download, Filter, Search, X, Database, BarChart2, PieChart as PieChartIcon, Table, RefreshCw, FileDown, Info, MapPin, FileArchive, Users } from 'lucide-react';
import { 
  processarCSVEmendas, 
  ResultadoProcessamentoCSV, 
  gerarDadosGraficoBarras, 
  gerarDadosGraficoPizza,
  formatarTamanhoArquivo,
  mapToSortedArray,
  ResumoAutor
} from '../services/csvParser';
import { DOWNLOAD_URLS, formatarValorEmenda } from '../services/portalTransparencia';
import { 
  processarArquivoZIPEmendas, 
  ResultadoProcessamentoEmendasZIP,
  BeneficiarioEmenda,
  gerarResumoBeneficiarios,
  EMENDAS_DOWNLOAD_URL
} from '../services/emendasParlamentares';
import { FORMATTER_BRL } from '../constants';

interface CSVEmendasViewerProps {
  nomeAutorPadrao?: string;
  onClose?: () => void;
}

const CORES_GRAFICO = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const CORES_PE = '#10b981'; // Verde para PE

const CSVEmendasViewer: React.FC<CSVEmendasViewerProps> = ({ nomeAutorPadrao = '', onClose }) => {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoProcessamentoCSV | null>(null);
  const [resultadoZIP, setResultadoZIP] = useState<ResultadoProcessamentoEmendasZIP | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroAutor, setFiltroAutor] = useState(nomeAutorPadrao);
  const [filtroAno, setFiltroAno] = useState<number | undefined>();
  const [filtroUF, setFiltroUF] = useState('PE');
  const [visualizacao, setVisualizacao] = useState<'resumo' | 'funcoes' | 'localidades' | 'tabela' | 'beneficiarios'>('resumo');
  const [tipoArquivo, setTipoArquivo] = useState<'csv' | 'zip' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleArquivoSelecionado = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isCSV = file.name.toLowerCase().endsWith('.csv');
    const isZIP = file.name.toLowerCase().endsWith('.zip');

    if (!isCSV && !isZIP) {
      setErro('Por favor, selecione um arquivo CSV ou ZIP do Portal da Transparência.');
      return;
    }

    setArquivo(file);
    setProcessando(true);
    setErro(null);
    setResultado(null);
    setResultadoZIP(null);
    setTipoArquivo(isZIP ? 'zip' : 'csv');

    try {
      if (isZIP) {
        // Processar arquivo ZIP
        const arrayBuffer = await file.arrayBuffer();
        const resultadoZip = await processarArquivoZIPEmendas(arrayBuffer, {
          nomeAutor: filtroAutor || undefined,
          ano: filtroAno,
          uf: filtroUF || undefined,
        });
        
        if (resultadoZip.erros.length > 0 && !resultadoZip.emendas && resultadoZip.beneficiarios.length === 0) {
          setErro(resultadoZip.erros.join('. '));
        } else {
          setResultadoZIP(resultadoZip);
          setResultado(resultadoZip.emendas);
        }
      } else {
        // Processar arquivo CSV (lógica existente)
        const conteudo = await file.text();
        
        const resultado = processarCSVEmendas(conteudo, {
          nomeAutor: filtroAutor || undefined,
          ano: filtroAno,
          uf: filtroUF || undefined,
        });

        if (resultado.erros.length > 0 && resultado.emendas.length === 0) {
          setErro(resultado.erros.join('. '));
        } else {
          setResultado(resultado);
        }
      }
    } catch (e) {
      setErro('Erro ao processar o arquivo. Verifique se é um CSV ou ZIP válido do Portal da Transparência.');
    } finally {
      setProcessando(false);
    }
  }, [filtroAutor, filtroAno, filtroUF]);

  const handleReprocessar = useCallback(async () => {
    if (!arquivo) return;
    
    setProcessando(true);
    setErro(null);

    try {
      if (tipoArquivo === 'zip') {
        const arrayBuffer = await arquivo.arrayBuffer();
        const resultadoZip = await processarArquivoZIPEmendas(arrayBuffer, {
          nomeAutor: filtroAutor || undefined,
          ano: filtroAno,
          uf: filtroUF || undefined,
        });
        setResultadoZIP(resultadoZip);
        setResultado(resultadoZip.emendas);
      } else {
        const conteudo = await arquivo.text();
        const resultado = processarCSVEmendas(conteudo, {
          nomeAutor: filtroAutor || undefined,
          ano: filtroAno,
          uf: filtroUF || undefined,
        });
        setResultado(resultado);
      }
    } catch (e) {
      setErro('Erro ao reprocessar o arquivo.');
    } finally {
      setProcessando(false);
    }
  }, [arquivo, filtroAutor, filtroAno, filtroUF, tipoArquivo]);

  const handleLimpar = () => {
    setArquivo(null);
    setResultado(null);
    setResultadoZIP(null);
    setTipoArquivo(null);
    setErro(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Dados para gráficos
  const dadosBarras = resultado ? gerarDadosGraficoBarras(resultado.resumoPorFuncao, 8) : [];
  const dadosPizza = resultado ? gerarDadosGraficoPizza(resultado.resumoPorLocalidade, 6) : [];
  const topAutores = resultado ? mapToSortedArray(resultado.resumoPorAutor, 10) as ResumoAutor[] : [];

  // Resumo de beneficiários (se tiver dados do ZIP)
  const resumoBeneficiarios = resultadoZIP?.beneficiarios?.length 
    ? gerarResumoBeneficiarios(resultadoZIP.beneficiarios) 
    : null;

  // Totais
  const totalEmpenhado = resultado?.emendas.reduce((sum, e) => sum + e.valorEmpenhado, 0) || 0;
  const totalPago = resultado?.emendas.reduce((sum, e) => sum + e.valorPago, 0) || 0;
  const percentualExecucao = totalEmpenhado > 0 ? Math.round((totalPago / totalEmpenhado) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Análise de CSV - Emendas Parlamentares</h3>
            <p className="text-blue-100 text-xs">Baixe o CSV do Portal e faça upload para análise detalhada</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
            <X className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      <div className="p-6">
        {/* Links de Download */}
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
            <FileDown className="w-4 h-4" />
            1. Baixe os dados do Portal da Transparência
          </h4>
          
          {/* Link Principal - Arquivo Único (ZIP) */}
          <div className="mb-3 p-3 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg border border-indigo-200">
            <a
              href={EMENDAS_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-bold text-white transition shadow-sm"
            >
              <FileArchive className="w-4 h-4" />
              📦 Arquivo ÚNICO - Emendas Parlamentares (ZIP)
            </a>
            <p className="text-xs text-indigo-700 mt-2">
              ✨ <strong>Recomendado!</strong> Contém 3 planilhas completas: Emendas, Beneficiários e Pagamentos
            </p>
          </div>

          {/* Links por ano (legado) */}
          <p className="text-xs text-slate-500 mb-2">Ou baixe por ano (apenas emendas, sem beneficiários):</p>
          <div className="flex flex-wrap gap-2">
            {[2025, 2024, 2023, 2022].map(ano => (
              <a
                key={ano}
                href={DOWNLOAD_URLS.emendas(ano)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-100 transition border border-blue-200"
              >
                <Download className="w-3 h-3" /> Emendas {ano}
              </a>
            ))}
          </div>
          <p className="text-[10px] text-blue-600 mt-2">
            ⚠️ O arquivo ZIP único (~50-300MB) contém dados completos. CSVs por ano têm 50-200MB cada.
          </p>
        </div>

        {/* Upload Area */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            2. Faça upload do arquivo baixado (CSV ou ZIP)
          </h4>
          
          <div className="flex gap-4">
            <label 
              className={`flex-1 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                arquivo 
                  ? 'border-emerald-300 bg-emerald-50' 
                  : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.zip"
                onChange={handleArquivoSelecionado}
                className="hidden"
                disabled={processando}
              />
              {processando ? (
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="text-sm text-blue-600 font-medium">Processando arquivo...</span>
                </div>
              ) : arquivo ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                  <span className="text-sm text-emerald-700 font-medium">{arquivo.name}</span>
                  <span className="text-xs text-emerald-600">
                    {formatarTamanhoArquivo(arquivo.size)} • {tipoArquivo === 'zip' ? '📦 ZIP' : '📄 CSV'}
                  </span>
                  {resultadoZIP && resultadoZIP.arquivosProcessados.length > 0 && (
                    <span className="text-xs text-emerald-500">
                      {resultadoZIP.arquivosProcessados.length} arquivos processados
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                    <FileText className="w-8 h-8 text-slate-400" />
                    <FileArchive className="w-8 h-8 text-slate-400" />
                  </div>
                  <span className="text-sm text-slate-600 font-medium">Clique para selecionar arquivo CSV ou ZIP</span>
                  <span className="text-xs text-slate-400">Formatos aceitos: CSV ou ZIP do Portal da Transparência</span>
                </div>
              )}
            </label>

            {arquivo && (
              <button
                onClick={handleLimpar}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition h-fit"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Filtros */}
        {arquivo && (
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros (opcional)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Nome do Autor</label>
                <input
                  type="text"
                  value={filtroAutor}
                  onChange={(e) => setFiltroAutor(e.target.value)}
                  placeholder="Ex: DANILO CABRAL"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Ano</label>
                <select
                  value={filtroAno || ''}
                  onChange={(e) => setFiltroAno(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos</option>
                  {[2025, 2024, 2023, 2022, 2021, 2020].map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">UF/Localidade</label>
                <input
                  type="text"
                  value={filtroUF}
                  onChange={(e) => setFiltroUF(e.target.value)}
                  placeholder="Ex: PE, RECIFE"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleReprocessar}
                  disabled={processando}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Aplicar Filtros
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-rose-800">{erro}</p>
              <p className="text-xs text-rose-600 mt-1">
                Certifique-se de que o arquivo é um CSV ou ZIP de emendas do Portal da Transparência.
              </p>
            </div>
          </div>
        )}

        {/* Info do ZIP processado */}
        {resultadoZIP && resultadoZIP.arquivosProcessados.length > 0 && (
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <p className="text-xs font-medium text-indigo-700 flex items-center gap-2">
              <FileArchive className="w-4 h-4" />
              Arquivos processados do ZIP:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {resultadoZIP.arquivosProcessados.map((arq, i) => (
                <span key={i} className="px-2 py-1 bg-white rounded text-xs text-indigo-600 border border-indigo-100">
                  {arq}
                </span>
              ))}
            </div>
            {resultadoZIP.beneficiarios.length > 0 && (
              <p className="text-xs text-indigo-600 mt-2">
                ✅ {resultadoZIP.beneficiarios.length.toLocaleString('pt-BR')} beneficiários carregados
              </p>
            )}
            {resultadoZIP.pagamentos.length > 0 && (
              <p className="text-xs text-indigo-600">
                ✅ {resultadoZIP.pagamentos.length.toLocaleString('pt-BR')} pagamentos carregados
              </p>
            )}
          </div>
        )}

        {/* Resultados */}
        {resultado && resultado.emendas.length > 0 && (
          <>
            {/* Resumo */}
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <p className="text-xs font-medium text-blue-600 mb-1">Registros Encontrados</p>
                <p className="text-2xl font-bold text-blue-800">{resultado.registrosFiltrados.toLocaleString('pt-BR')}</p>
                <p className="text-[10px] text-blue-500 mt-1">de {resultado.totalRegistros.toLocaleString('pt-BR')} total</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200">
                <p className="text-xs font-medium text-emerald-600 mb-1">Total Empenhado</p>
                <p className="text-2xl font-bold text-emerald-800">{formatarValorEmenda(totalEmpenhado)}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                <p className="text-xs font-medium text-amber-600 mb-1">Total Pago</p>
                <p className="text-2xl font-bold text-amber-800">{formatarValorEmenda(totalPago)}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                <p className="text-xs font-medium text-purple-600 mb-1">Execução</p>
                <p className={`text-2xl font-bold ${percentualExecucao > 70 ? 'text-emerald-700' : percentualExecucao > 40 ? 'text-amber-700' : 'text-rose-700'}`}>
                  {percentualExecucao}%
                </p>
              </div>
            </div>

            {/* Tabs de visualização */}
            <div className="mb-4 flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
              {[
                { id: 'resumo', label: 'Resumo', icon: BarChart2 },
                { id: 'funcoes', label: 'Por Função', icon: BarChart2 },
                { id: 'localidades', label: 'Por Localidade', icon: PieChartIcon },
                { id: 'tabela', label: 'Tabela', icon: Table },
                ...(resumoBeneficiarios ? [{ id: 'beneficiarios', label: 'Beneficiários', icon: Users }] : []),
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setVisualizacao(tab.id as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition whitespace-nowrap ${
                    visualizacao === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Conteúdo das visualizações */}
            {visualizacao === 'resumo' && (
              <div className="space-y-6">
                {/* Top Autores */}
                {topAutores.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-3">Top Autores por Valor Empenhado</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase">
                          <tr>
                            <th className="px-4 py-3 text-left">Autor</th>
                            <th className="px-4 py-3 text-right">Emendas</th>
                            <th className="px-4 py-3 text-right">Empenhado</th>
                            <th className="px-4 py-3 text-right">Pago</th>
                            <th className="px-4 py-3 text-center">Execução</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {topAutores.map((autor, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-700">{autor.nome}</td>
                              <td className="px-4 py-3 text-right text-slate-600">{autor.totalEmendas}</td>
                              <td className="px-4 py-3 text-right text-slate-600">{FORMATTER_BRL.format(autor.valorEmpenhado)}</td>
                              <td className="px-4 py-3 text-right text-slate-600">{FORMATTER_BRL.format(autor.valorPago)}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                  autor.percentualExecucao > 70 ? 'bg-emerald-100 text-emerald-700' :
                                  autor.percentualExecucao > 40 ? 'bg-amber-100 text-amber-700' :
                                  'bg-rose-100 text-rose-700'
                                }`}>
                                  {autor.percentualExecucao}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {visualizacao === 'funcoes' && dadosBarras.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3">Distribuição por Função (Área)</h4>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosBarras} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" tickFormatter={(v) => formatarValorEmenda(v)} />
                      <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 11 }} />
                      <Tooltip 
                        formatter={(value: number) => FORMATTER_BRL.format(value)}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend />
                      <Bar dataKey="empenhado" name="Empenhado" fill="#cbd5e1" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="pago" name="Pago" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {visualizacao === 'localidades' && dadosPizza.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Distribuição Geográfica
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dadosPizza}
                          dataKey="valor"
                          nameKey="nome"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(props: PieLabelRenderProps) => {
                            const name = props.name ?? '';
                            const percent = props.percent ?? 0;
                            return `${name} (${(percent * 100).toFixed(0)}%)`;
                          }}
                          labelLine={false}
                        >
                          {dadosPizza.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.isPE ? CORES_PE : CORES_GRAFICO[index % CORES_GRAFICO.length]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => FORMATTER_BRL.format(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <div className="space-y-2">
                      {dadosPizza.map((loc, i) => (
                        <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${
                          loc.isPE ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'
                        }`}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: loc.isPE ? CORES_PE : CORES_GRAFICO[i % CORES_GRAFICO.length] }}
                            />
                            <span className={`text-sm font-medium ${loc.isPE ? 'text-emerald-700' : 'text-slate-700'}`}>
                              {loc.nome} {loc.isPE && '🏠'}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-slate-600">{formatarValorEmenda(loc.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {visualizacao === 'tabela' && (
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3">Detalhes das Emendas (primeiros 100)</h4>
                <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Código</th>
                        <th className="px-3 py-2 text-left">Autor</th>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Função</th>
                        <th className="px-3 py-2 text-left">Localidade</th>
                        <th className="px-3 py-2 text-right">Empenhado</th>
                        <th className="px-3 py-2 text-right">Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {resultado.emendas.slice(0, 100).map((emenda, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-500 font-mono">{emenda.codigoEmenda || '-'}</td>
                          <td className="px-3 py-2 font-medium text-slate-700 max-w-[150px] truncate">{emenda.nomeAutor}</td>
                          <td className="px-3 py-2 text-slate-600">{emenda.tipoEmenda || '-'}</td>
                          <td className="px-3 py-2 text-slate-600 max-w-[120px] truncate">{emenda.nomeFuncao || '-'}</td>
                          <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate">
                            {emenda.localidadeGasto || '-'}
                            {(emenda.localidadeGasto?.toUpperCase().includes('PE') || emenda.localidadeGasto?.toUpperCase().includes('PERNAMBUCO')) && ' 🏠'}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-600">{FORMATTER_BRL.format(emenda.valorEmpenhado)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{FORMATTER_BRL.format(emenda.valorPago)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {resultado.emendas.length > 100 && (
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    Exibindo 100 de {resultado.emendas.length.toLocaleString('pt-BR')} registros. Use os filtros para refinar.
                  </p>
                )}
              </div>
            )}

            {/* Visualização de Beneficiários (somente para ZIP) */}
            {visualizacao === 'beneficiarios' && resumoBeneficiarios && (
              <div className="space-y-6">
                {/* Cards de resumo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border border-indigo-200">
                    <p className="text-xs font-medium text-indigo-600 mb-1">Total de Beneficiários</p>
                    <p className="text-2xl font-bold text-indigo-800">{resumoBeneficiarios.totalBeneficiarios.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl border border-teal-200">
                    <p className="text-xs font-medium text-teal-600 mb-1">Valor Total Recebido</p>
                    <p className="text-2xl font-bold text-teal-800">{formatarValorEmenda(resumoBeneficiarios.valorTotalRecebido)}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl border border-cyan-200">
                    <p className="text-xs font-medium text-cyan-600 mb-1">Tipos de Beneficiário</p>
                    <p className="text-2xl font-bold text-cyan-800">{resumoBeneficiarios.porTipo.size}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl border border-violet-200">
                    <p className="text-xs font-medium text-violet-600 mb-1">Estados (UF)</p>
                    <p className="text-2xl font-bold text-violet-800">{resumoBeneficiarios.porUF.size}</p>
                  </div>
                </div>

                {/* Por Tipo de Beneficiário */}
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-3">Por Tipo de Beneficiário</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Array.from(resumoBeneficiarios.porTipo.entries())
                      .sort((a, b) => b[1].valor - a[1].valor)
                      .slice(0, 6)
                      .map(([tipo, dados]) => (
                        <div key={tipo} className="p-3 bg-white border border-slate-200 rounded-lg">
                          <p className="text-xs font-medium text-slate-500">{tipo}</p>
                          <p className="text-lg font-bold text-slate-700">{formatarValorEmenda(dados.valor)}</p>
                          <p className="text-xs text-slate-400">{dados.quantidade.toLocaleString('pt-BR')} beneficiários</p>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Por UF */}
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Por Estado (UF)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {Array.from(resumoBeneficiarios.porUF.entries())
                      .sort((a, b) => b[1].valor - a[1].valor)
                      .slice(0, 12)
                      .map(([uf, dados]) => (
                        <div 
                          key={uf} 
                          className={`p-3 rounded-lg border ${
                            uf === 'PE' || uf === 'PERNAMBUCO' 
                              ? 'bg-emerald-50 border-emerald-300' 
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <p className={`text-sm font-bold ${
                            uf === 'PE' || uf === 'PERNAMBUCO' ? 'text-emerald-700' : 'text-slate-700'
                          }`}>
                            {uf} {(uf === 'PE' || uf === 'PERNAMBUCO') && '🏠'}
                          </p>
                          <p className="text-xs text-slate-600">{formatarValorEmenda(dados.valor)}</p>
                          <p className="text-[10px] text-slate-400">{dados.quantidade.toLocaleString('pt-BR')} beneficiários</p>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Top Beneficiários */}
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-3">Top 20 Beneficiários por Valor</h4>
                  <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-xl">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold uppercase sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Beneficiário</th>
                          <th className="px-3 py-2 text-left">Tipo</th>
                          <th className="px-3 py-2 text-left">Município</th>
                          <th className="px-3 py-2 text-left">UF</th>
                          <th className="px-3 py-2 text-right">Valor Recebido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {resumoBeneficiarios.topBeneficiarios.map((beneficiario, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-700 max-w-[200px] truncate">
                              {beneficiario.nomeBeneficiario || '-'}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{beneficiario.tipoBeneficiario || '-'}</td>
                            <td className="px-3 py-2 text-slate-600 max-w-[120px] truncate">
                              {beneficiario.municipio || '-'}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {beneficiario.uf || '-'}
                              {(beneficiario.uf === 'PE' || beneficiario.uf === 'PERNAMBUCO') && ' 🏠'}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-slate-700">
                              {FORMATTER_BRL.format(beneficiario.valorRecebido)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Nenhum resultado */}
        {resultado && resultado.emendas.length === 0 && (
          <div className="p-8 text-center">
            <Info className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">Nenhuma emenda encontrada com os filtros aplicados.</p>
            <p className="text-slate-400 text-sm mt-1">Tente ajustar os filtros ou limpar para ver todos os dados.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVEmendasViewer;
