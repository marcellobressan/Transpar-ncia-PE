import { useState, useCallback } from 'react';
import {
  listDatasets,
  getDatasetById,
  listOrganizations,
  searchTransparencyDatasets,
  fetchResourceData,
  Dataset,
  DatasetListResponse,
  Organization,
  OrganizationListResponse,
} from '../services/dadosGovBr';

/**
 * Hook para buscar e gerenciar dados do Portal Dados.gov.br
 */
export function useDadosGovBr() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pagination, setPagination] = useState<DatasetListResponse['paginacao'] | null>(null);

  /**
   * Busca conjuntos de dados com filtros
   */
  const searchDatasets = useCallback(async (params?: {
    pagina?: number;
    tamanho?: number;
    organizacao?: string;
    tema?: string;
    tag?: string;
    q?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await listDatasets(params);
      
      if (result) {
        setDatasets(result.dados);
        setPagination(result.paginacao);
      } else {
        setError('Não foi possível carregar os dados. Tente novamente.');
      }
    } catch (e) {
      setError('Erro de conexão com a API dados.gov.br');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Busca um dataset específico pelo ID
   */
  const fetchDataset = useCallback(async (id: string): Promise<Dataset | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getDatasetById(id);
      
      if (!result) {
        setError('Conjunto de dados não encontrado.');
      }
      
      return result;
    } catch (e) {
      setError('Erro ao buscar conjunto de dados.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Busca organizações
   */
  const searchOrganizations = useCallback(async (params?: {
    pagina?: number;
    tamanho?: number;
    q?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await listOrganizations(params);
      
      if (result) {
        setOrganizations(result.dados);
      } else {
        setError('Não foi possível carregar as organizações.');
      }
    } catch (e) {
      setError('Erro de conexão com a API.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Busca datasets relacionados à transparência
   */
  const fetchTransparencyData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await searchTransparencyDatasets();
      setDatasets(result);
    } catch (e) {
      setError('Erro ao buscar dados de transparência.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Baixa os dados de um recurso específico
   */
  const downloadResource = useCallback(async (resourceUrl: string): Promise<any> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await fetchResourceData(resourceUrl);
      
      if (!data) {
        setError('Não foi possível baixar o recurso.');
      }
      
      return data;
    } catch (e) {
      setError('Erro ao baixar recurso.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Limpa o estado de erro
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reseta todo o estado
   */
  const reset = useCallback(() => {
    setDatasets([]);
    setOrganizations([]);
    setPagination(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    // Estado
    isLoading,
    error,
    datasets,
    organizations,
    pagination,
    
    // Ações
    searchDatasets,
    fetchDataset,
    searchOrganizations,
    fetchTransparencyData,
    downloadResource,
    clearError,
    reset,
  };
}

export default useDadosGovBr;
