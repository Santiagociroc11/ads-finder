import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { 
  History, 
  Search, 
  Calendar, 
  MapPin, 
  BarChart3, 
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  Zap,
  TrendingUp,
  Activity,
  RotateCcw
} from 'lucide-react';
import { searchHistoryApi } from '../services/api';
import { useSearch } from '../contexts/SearchContext';
import type { SearchHistoryEntry, SearchHistoryStats } from '../types/shared';

export function SearchHistoryPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setSearchParams } = useSearch();
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    country: '',
    dateFrom: '',
    dateTo: ''
  });
  const [showStats, setShowStats] = useState(false);

  // Fetch search history
  const { data: historyData, isLoading, error } = useQuery({
    queryKey: ['searchHistory', currentPage, filters],
    queryFn: () => searchHistoryApi.getHistory({
      page: currentPage,
      limit: 20,
      ...filters
    }),
    keepPreviousData: true,
    staleTime: 30000, // 30 seconds
    cacheTime: 60000, // 1 minute
    retry: 2,
    retryDelay: 1000
  });

  // Fetch statistics
  const { data: statsData } = useQuery({
    queryKey: ['searchHistoryStats'],
    queryFn: () => searchHistoryApi.getStats('30'),
    enabled: showStats,
    staleTime: 60000, // 1 minute
    cacheTime: 300000, // 5 minutes
    retry: 1,
    retryDelay: 2000
  });

  // Note: History deletion is disabled for audit and limit control purposes

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Function to repeat a search from history
  const handleRepeatSearch = (searchEntry: SearchHistoryEntry) => {
    // Set the search parameters from the history entry
    setSearchParams({
      searchType: searchEntry.searchParams.searchType as 'keyword' | 'page',
      value: searchEntry.searchParams.value,
      country: searchEntry.searchParams.country,
      minDays: searchEntry.searchParams.minDays,
      adType: searchEntry.searchParams.adType,
      mediaType: searchEntry.searchParams.mediaType,
      searchPhraseType: searchEntry.searchParams.searchPhraseType as 'exact' | 'unordered',
      languages: searchEntry.searchParams.languages,
      apifyCount: searchEntry.searchParams.apifyCount
    });
    
    // Refresh user usage when repeating a search
    queryClient.invalidateQueries('userUsage');
    
    // Navigate to search page
    navigate('/search');
  };

  // History deletion functions removed for audit and limit control

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCountryName = (code: string) => {
    const countries: Record<string, string> = {
      'CO': 'Colombia',
      'US': 'Estados Unidos',
      'MX': 'México',
      'AR': 'Argentina',
      'ES': 'España',
      'BR': 'Brasil',
      'ALL': 'Todos los países'
    };
    return countries[code] || code;
  };

  const getAdTypeName = (type: string) => {
    const types: Record<string, string> = {
      'ALL': 'Todos',
      'POLITICAL_AND_ISSUE_ADS': 'Políticos',
      'HOUSING_ADS': 'Vivienda',
      'EMPLOYMENT_ADS': 'Empleo',
      'FINANCIAL_PRODUCTS_AND_SERVICES_ADS': 'Financieros'
    };
    return types[type] || type;
  };

  if (error) {
    return (
      <div className="space-y-8">
        <div className="holographic-panel p-8 text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error al cargar el historial</h2>
          <p className="text-gray-300">No se pudo cargar el historial de búsquedas. Por favor, intenta de nuevo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
        {/* Header */}
        <div className="holographic-panel p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/50 rounded-full flex items-center justify-center">
                <History className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Historial de Búsquedas</h1>
                <p className="text-gray-300">Revisa todas tus búsquedas anteriores y estadísticas</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStats(!showStats)}
                className="btn-secondary flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                {showStats ? 'Ocultar' : 'Ver'} Estadísticas
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Panel */}
        {showStats && statsData && (
          <div className="holographic-panel p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-green-400" />
              Estadísticas de Búsquedas ({statsData.period})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Search className="w-8 h-8 text-blue-400" />
                  <div>
                    <p className="text-sm text-gray-400">Total Búsquedas</p>
                    <p className="text-2xl font-bold text-white">{statsData.summary.totalSearches}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Activity className="w-8 h-8 text-green-400" />
                  <div>
                    <p className="text-sm text-gray-400">Total Anuncios</p>
                    <p className="text-2xl font-bold text-white">{statsData.summary.totalAds.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-8 h-8 text-purple-400" />
                  <div>
                    <p className="text-sm text-gray-400">Promedio por Búsqueda</p>
                    <p className="text-2xl font-bold text-white">{statsData.summary.avgAdsPerSearch}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Zap className="w-8 h-8 text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-400">Cache Hit Rate</p>
                    <p className="text-2xl font-bold text-white">{statsData.summary.cacheHitRate}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Popular Terms and Countries */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Términos Más Buscados</h3>
                <div className="space-y-2">
                  {statsData.popularTerms.slice(0, 5).map((term, index) => (
                    <div key={term._id} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                      <span className="text-white font-medium">{term._id}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">{term.count} búsquedas</span>
                        <span className="text-sm text-blue-400">{term.totalAds} ads</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Países Más Buscados</h3>
                <div className="space-y-2">
                  {statsData.popularCountries.slice(0, 5).map((country, index) => (
                    <div key={country._id} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                      <span className="text-white font-medium">{getCountryName(country._id)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">{country.count} búsquedas</span>
                        <span className="text-sm text-blue-400">{country.totalAds} ads</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="holographic-panel p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-400" />
            Filtros
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Buscar término</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Ej: iPhone, Samsung..."
                className="form-input w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">País</label>
              <select
                value={filters.country}
                onChange={(e) => handleFilterChange('country', e.target.value)}
                className="form-select w-full"
              >
                <option value="">Todos los países</option>
                <option value="CO">Colombia</option>
                <option value="MX">México</option>
                <option value="AR">Argentina</option>
                <option value="ES">España</option>
                <option value="US">Estados Unidos</option>
                <option value="BR">Brasil</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Desde</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="form-input w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Hasta</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="form-input w-full"
              />
            </div>
          </div>
        </div>

        {/* Search History List */}
        <div className="holographic-panel p-6">
          <h2 className="text-xl font-semibold text-white mb-6">
            Historial de Búsquedas
            {historyData && (
              <span className="text-gray-400 text-sm font-normal ml-2">
                ({historyData.pagination.totalCount} búsquedas)
              </span>
            )}
          </h2>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Cargando historial...</p>
            </div>
          ) : !historyData?.history.length ? (
            <div className="text-center py-12">
              <History className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No hay búsquedas en el historial</h3>
              <p className="text-gray-500">Realiza tu primera búsqueda para ver el historial aquí.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {historyData.history.map((search) => (
                  <div key={search._id} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800/70 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{search.searchParams.value}</h3>
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                            {getAdTypeName(search.searchParams.adType)}
                          </span>
                          {search.results.cached && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              Cached
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-6 text-sm text-gray-400 mb-3">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {getCountryName(search.searchParams.country)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDate(search.searchDate)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Activity className="w-4 h-4" />
                            {search.results.totalAds} anuncios
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          <p>Mínimo días: {search.searchParams.minDays} | 
                             Tipo de frase: {search.searchParams.searchPhraseType} | 
                             Idiomas: {search.searchParams.languages.join(', ')}</p>
                        </div>
                      </div>
                      
                      <div className="ml-4 flex flex-col gap-2">
                        <button
                          onClick={() => handleRepeatSearch(search)}
                          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm hover:bg-blue-600 transition-colors"
                          title="Repetir esta búsqueda"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Repetir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {historyData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700/50">
                  <div className="text-sm text-gray-400">
                    Mostrando {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, historyData.pagination.totalCount)} de {historyData.pagination.totalCount} búsquedas
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={!historyData.pagination.hasPrevPage}
                      className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </button>
                    
                    <span className="text-sm text-gray-400 px-4">
                      Página {currentPage} de {historyData.pagination.totalPages}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={!historyData.pagination.hasNextPage}
                      className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
    </div>
  );
}
