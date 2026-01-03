import { useState, useEffect, useCallback } from 'react';
import db, { 
  PoliticianRecord, 
  SpendingRecordDB, 
  AmendmentRecordDB, 
  RedFlagRecordDB 
} from '../services/database';

interface UseDatabase {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Políticos
  politicians: PoliticianRecord[];
  loadPoliticians: (filters?: { sphere?: string; party?: string; location?: string }) => Promise<void>;
  searchPoliticians: (term: string) => Promise<void>;
  getPolitician: (id: string) => Promise<PoliticianRecord | null>;
  savePolitician: (politician: PoliticianRecord) => Promise<PoliticianRecord>;
  
  // Gastos
  getSpending: (politicianId: string, type?: 'salary' | 'ceap') => Promise<SpendingRecordDB[]>;
  addSpending: (record: SpendingRecordDB) => Promise<SpendingRecordDB>;
  
  // Emendas
  getAmendments: (politicianId: string) => Promise<AmendmentRecordDB[]>;
  addAmendment: (amendment: AmendmentRecordDB) => Promise<AmendmentRecordDB>;
  
  // Red Flags
  getRedFlags: (politicianId: string) => Promise<RedFlagRecordDB[]>;
  addRedFlag: (redFlag: RedFlagRecordDB) => Promise<RedFlagRecordDB>;
  
  // Estatísticas
  getStats: () => Promise<{ totalSpending: number; avgSpending: number; maxSpending: number; minSpending: number }>;
  getPartyStats: () => Promise<Array<{ party: string; count: number; avg_spending: number }>>;
  
  // Utilitários
  initDb: () => Promise<void>;
  testConnection: () => Promise<boolean>;
}

export function useDatabase(): UseDatabase {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [politicians, setPoliticians] = useState<PoliticianRecord[]>([]);

  // Testar conexão ao montar
  useEffect(() => {
    db.testConnection()
      .then(connected => setIsConnected(connected))
      .catch(() => setIsConnected(false));
  }, []);

  const handleError = (err: unknown) => {
    const message = err instanceof Error ? err.message : 'An error occurred';
    setError(message);
    console.error('Database error:', err);
  };

  const testConnection = useCallback(async () => {
    try {
      const result = await db.testConnection();
      setIsConnected(result);
      return result;
    } catch (err) {
      handleError(err);
      return false;
    }
  }, []);

  const initDb = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await db.initializeDatabase();
      setIsConnected(true);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPoliticians = useCallback(async (filters?: { sphere?: string; party?: string; location?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await db.getAllPoliticians(filters);
      setPoliticians(result);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchPoliticians = useCallback(async (term: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await db.searchPoliticians(term);
      setPoliticians(result);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPolitician = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await db.getPoliticianById(id);
    } catch (err) {
      handleError(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const savePolitician = useCallback(async (politician: PoliticianRecord) => {
    setIsLoading(true);
    setError(null);
    try {
      return await db.createPolitician(politician);
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getSpending = useCallback(async (politicianId: string, type?: 'salary' | 'ceap') => {
    try {
      return await db.getSpendingByPolitician(politicianId, type);
    } catch (err) {
      handleError(err);
      return [];
    }
  }, []);

  const addSpending = useCallback(async (record: SpendingRecordDB) => {
    try {
      return await db.addSpendingRecord(record);
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, []);

  const getAmendments = useCallback(async (politicianId: string) => {
    try {
      return await db.getAmendmentsByPolitician(politicianId);
    } catch (err) {
      handleError(err);
      return [];
    }
  }, []);

  const addAmendment = useCallback(async (amendment: AmendmentRecordDB) => {
    try {
      return await db.addAmendment(amendment);
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, []);

  const getRedFlags = useCallback(async (politicianId: string) => {
    try {
      return await db.getRedFlagsByPolitician(politicianId);
    } catch (err) {
      handleError(err);
      return [];
    }
  }, []);

  const addRedFlag = useCallback(async (redFlag: RedFlagRecordDB) => {
    try {
      return await db.addRedFlag(redFlag);
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, []);

  const getStats = useCallback(async () => {
    try {
      return await db.getSpendingStats();
    } catch (err) {
      handleError(err);
      return { totalSpending: 0, avgSpending: 0, maxSpending: 0, minSpending: 0 };
    }
  }, []);

  const getPartyStats = useCallback(async () => {
    try {
      return await db.getPartyStats();
    } catch (err) {
      handleError(err);
      return [];
    }
  }, []);

  return {
    isConnected,
    isLoading,
    error,
    politicians,
    loadPoliticians,
    searchPoliticians,
    getPolitician,
    savePolitician,
    getSpending,
    addSpending,
    getAmendments,
    addAmendment,
    getRedFlags,
    addRedFlag,
    getStats,
    getPartyStats,
    initDb,
    testConnection,
  };
}

export default useDatabase;
