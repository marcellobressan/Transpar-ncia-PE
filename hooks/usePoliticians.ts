/**
 * Hook React para gerenciar dados de políticos com atualizações automáticas
 * 
 * Este hook fornece:
 * - Carregamento automático dos dados das APIs oficiais
 * - Cache local com IndexedDB para funcionamento offline
 * - Atualizações periódicas automáticas
 * - Estado de carregamento e erros
 * - Funções para refresh manual
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Politician } from '../types';
import * as dataAggregator from '../services/dataAggregator';

// Intervalo de polling para verificar novas atualizações (6 horas)
const POLLING_INTERVAL = 6 * 60 * 60 * 1000;

// Intervalo para verificar dados de 2026 (12 horas)
const ELEICAO_2026_CHECK_INTERVAL = 12 * 60 * 60 * 1000;

export interface UsePoliticiansResult {
  politicians: Politician[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  apiStatus: dataAggregator.ApiStatus | null;
  eleicao2026Disponivel: boolean;
  refresh: () => Promise<void>;
  refreshPolitician: (id: string) => Promise<Politician | null>;
  isRefreshing: boolean;
}

export function usePoliticians(): UsePoliticiansResult {
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [apiStatus, setApiStatus] = useState<dataAggregator.ApiStatus | null>(null);
  const [eleicao2026Disponivel, setEleicao2026Disponivel] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Refs para intervalos
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const eleicaoCheckRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  
  /**
   * Carrega dados iniciais
   */
  const loadInitialData = useCallback(async () => {
    if (!mountedRef.current) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('📊 Carregando dados dos políticos de PE...');
      
      // Verifica status das APIs
      const status = await dataAggregator.checkApisStatus();
      if (mountedRef.current) {
        setApiStatus(status);
      }
      
      // Tenta carregar do cache primeiro para UX mais rápida
      const cached = await dataAggregator.getAllFromCache();
      if (cached.length > 0 && mountedRef.current) {
        console.log(`📦 ${cached.length} políticos carregados do cache`);
        setPoliticians(cached);
        setLoading(false);
      }
      
      // Busca dados atualizados das APIs
      const freshData = await dataAggregator.fetchAllPoliticiansPE();
      
      if (mountedRef.current) {
        if (freshData.length > 0) {
          setPoliticians(freshData);
          setLastUpdated(new Date());
          console.log(`✅ ${freshData.length} políticos carregados das APIs`);
        } else if (cached.length === 0) {
          // Se não tem cache nem dados novos, mostra erro
          setError('Não foi possível carregar dados dos políticos. Verifique sua conexão.');
        }
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Erro ao carregar dados:', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido ao carregar dados');
        setLoading(false);
      }
    }
  }, []);
  
  /**
   * Função de refresh manual
   */
  const refresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    setError(null);
    
    try {
      console.log('🔄 Atualizando dados...');
      
      // Atualiza status das APIs
      const status = await dataAggregator.checkApisStatus();
      if (mountedRef.current) {
        setApiStatus(status);
      }
      
      // Busca novos dados
      const freshData = await dataAggregator.fetchAllPoliticiansPE();
      
      if (mountedRef.current && freshData.length > 0) {
        setPoliticians(freshData);
        setLastUpdated(new Date());
        console.log(`✅ Dados atualizados: ${freshData.length} políticos`);
      }
    } catch (err) {
      console.error('❌ Erro ao atualizar:', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar dados');
      }
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing]);
  
  /**
   * Atualiza um político específico
   */
  const refreshPolitician = useCallback(async (id: string): Promise<Politician | null> => {
    try {
      console.log(`🔄 Atualizando político ${id}...`);
      const updated = await dataAggregator.refreshPolitician(id);
      
      if (updated && mountedRef.current) {
        setPoliticians(prev => 
          prev.map(p => p.id === id ? updated : p)
        );
        console.log(`✅ Político ${id} atualizado`);
      }
      
      return updated;
    } catch (err) {
      console.error(`❌ Erro ao atualizar ${id}:`, err);
      return null;
    }
  }, []);
  
  /**
   * Verifica se dados de 2026 estão disponíveis
   */
  const checkEleicao2026 = useCallback(async () => {
    try {
      // Importa o serviço do TSE dinamicamente
      const tse = await import('../services/tse');
      const result = await tse.checkEleicao2026Disponivel();
      
      if (mountedRef.current) {
        setEleicao2026Disponivel(result.disponivel);
        
        if (result.disponivel) {
          console.log('🗳️ Dados das eleições 2026 disponíveis!');
          // Força refresh se dados de 2026 ficaram disponíveis
          refresh();
        } else {
          console.log('🗳️', result.mensagem);
        }
      }
    } catch (err) {
      console.warn('Não foi possível verificar eleições 2026:', err);
    }
  }, [refresh]);
  
  // Efeito de montagem - carrega dados iniciais
  useEffect(() => {
    mountedRef.current = true;
    loadInitialData();
    
    return () => {
      mountedRef.current = false;
    };
  }, [loadInitialData]);
  
  // Efeito de polling - atualiza periodicamente
  useEffect(() => {
    // Configura polling para atualizações
    pollingRef.current = setInterval(() => {
      if (mountedRef.current && !isRefreshing) {
        console.log('⏰ Executando atualização automática periódica...');
        refresh();
      }
    }, POLLING_INTERVAL);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [refresh, isRefreshing]);
  
  // Efeito para verificar eleições 2026
  useEffect(() => {
    // Verifica imediatamente
    checkEleicao2026();
    
    // Configura verificação periódica
    eleicaoCheckRef.current = setInterval(checkEleicao2026, ELEICAO_2026_CHECK_INTERVAL);
    
    return () => {
      if (eleicaoCheckRef.current) {
        clearInterval(eleicaoCheckRef.current);
      }
    };
  }, [checkEleicao2026]);
  
  return {
    politicians,
    loading,
    error,
    lastUpdated,
    apiStatus,
    eleicao2026Disponivel,
    refresh,
    refreshPolitician,
    isRefreshing,
  };
}

/**
 * Hook para buscar um político específico por ID
 */
export function usePoliticianById(id: string | null): {
  politician: Politician | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [politician, setPolitician] = useState<Politician | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadPolitician = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await dataAggregator.refreshPolitician(id);
      setPolitician(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar político');
    } finally {
      setLoading(false);
    }
  }, [id]);
  
  useEffect(() => {
    loadPolitician();
  }, [loadPolitician]);
  
  return {
    politician,
    loading,
    error,
    refresh: loadPolitician,
  };
}

/**
 * Hook para estatísticas gerais
 */
export function usePoliticiansStats(politicians: Politician[]): {
  totalPoliticians: number;
  totalCeap: number;
  avgCeap: number;
  totalRedFlags: number;
  byParty: Record<string, number>;
  bySphere: Record<string, number>;
} {
  return {
    totalPoliticians: politicians.length,
    totalCeap: politicians.reduce((sum, p) => sum + (p.ceapTotal || 0), 0),
    avgCeap: politicians.length > 0 
      ? politicians.reduce((sum, p) => sum + (p.ceapTotal || 0), 0) / politicians.length 
      : 0,
    totalRedFlags: politicians.reduce((sum, p) => sum + (p.redFlags?.length || 0), 0),
    byParty: politicians.reduce((acc, p) => {
      acc[p.party] = (acc[p.party] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    bySphere: politicians.reduce((acc, p) => {
      acc[p.sphere] = (acc[p.sphere] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}

export default usePoliticians;
