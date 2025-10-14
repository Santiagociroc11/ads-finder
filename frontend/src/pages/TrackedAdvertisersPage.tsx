import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Eye, 
  EyeOff, 
  Package, 
  Smartphone, 
  Wrench, 
  HelpCircle, 
  Filter,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { trackedAdvertisersApi } from '../services/api';
import type { TrackedAdvertiser, TrackedAdvertiserStats } from '../types/shared';
import { toast } from 'react-hot-toast';
import MiniChart from '../components/MiniChart';

const TrackedAdvertisersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductType, setSelectedProductType] = useState<string>('all');

  // Fetch tracked advertisers
  const { data: advertisersData, isLoading: isLoadingAdvertisers } = useQuery(
    ['tracked-advertisers', page, filter],
    () => trackedAdvertisersApi.getTrackedAdvertisers(page, 20, filter === 'active' ? 'true' : filter === 'inactive' ? 'false' : undefined),
    {
      keepPreviousData: true
    }
  );


  // Delete tracking mutation
  const deleteMutation = useMutation(
    (id: string) => trackedAdvertisersApi.deleteTracking(id),
    {
      onSuccess: () => {
        toast.success('Anunciante eliminado del seguimiento');
        queryClient.invalidateQueries('tracked-advertisers');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Error al eliminar seguimiento');
      }
    }
  );


  // Update daily stats mutation
  const updateStatsMutation = useMutation(
    ({ id, stats }: { id: string; stats: any }) => trackedAdvertisersApi.updateDailyStats(id, stats),
    {
      onSuccess: (response) => {
        // Show detailed success message with stats
        if (response.stats) {
          const { previousActiveAds, currentActiveAds, change, changePercentage } = response.stats;
          toast.success(
            `Estadísticas actualizadas: ${previousActiveAds} → ${currentActiveAds} anuncios (${change > 0 ? '+' : ''}${change}, ${changePercentage}%)`
          );
        } else {
          toast.success('Estadísticas actualizadas');
        }
        queryClient.invalidateQueries('tracked-advertisers');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Error al actualizar estadísticas');
      }
    }
  );

  // Refresh data when component mounts
  useEffect(() => {
    queryClient.invalidateQueries('tracked-advertisers');
    queryClient.invalidateQueries('tracked-advertisers-stats');
  }, [queryClient]);

  const getProductTypeIcon = (type: string) => {
    switch (type) {
      case 'physical': return <Package className="w-4 h-4 text-blue-500" />;
      case 'digital': return <Smartphone className="w-4 h-4 text-green-500" />;
      case 'service': return <Wrench className="w-4 h-4 text-purple-500" />;
      default: return <HelpCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getProductTypeColor = (type: string) => {
    switch (type) {
      case 'physical': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'digital': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'service': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Función para combinar datos iniciales con estadísticas diarias
  const getCombinedChartData = (advertiser: TrackedAdvertiser) => {
    const chartData = [];
    
    // Agregar día inicial si existe
    if (advertiser.initialActiveAdsCount > 0) {
      chartData.push({
        date: advertiser.trackingStartDate,
        activeAds: advertiser.initialActiveAdsCount,
        isInitial: true
      });
    }
    
    // Agregar estadísticas diarias
    if (advertiser.dailyStats && advertiser.dailyStats.length > 0) {
      advertiser.dailyStats.forEach(stat => {
        chartData.push({
          date: stat.date,
          activeAds: stat.activeAds,
          isInitial: false
        });
      });
    }
    
    // Ordenar por fecha
    return chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Filter advertisers based on search term and product type
  const filteredAdvertisers = advertisersData?.data?.filter(advertiser => {
    const matchesSearch = advertiser.pageName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProductType = selectedProductType === 'all' || advertiser.productType === selectedProductType;
    return matchesSearch && matchesProductType;
  }) || [];


  if (isLoadingAdvertisers) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando anunciantes en seguimiento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Anunciantes en Seguimiento</h1>
              <p className="text-gray-400">Monitorea el rendimiento diario de tus anunciantes</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  queryClient.invalidateQueries('tracked-advertisers');
                  toast.success('Datos actualizados');
                }}
                disabled={isLoadingAdvertisers}
                className="px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingAdvertisers ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>
          </div>

        </div>

        {/* Filters */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6 border border-gray-700">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar anunciante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>

            {/* Product Type Filter */}
            <select
              value={selectedProductType}
              onChange={(e) => setSelectedProductType(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los tipos</option>
              <option value="physical">Productos Físicos</option>
              <option value="digital">Productos Digitales</option>
              <option value="service">Servicios</option>
              <option value="other">Otros</option>
            </select>
          </div>
        </div>

        {/* Advertisers List */}
        <div className="space-y-4">
          {filteredAdvertisers.length === 0 ? (
            <div className="text-center py-12">
              <Eye className="w-16 h-16 mx-auto text-gray-600 mb-4" />
              <h3 className="text-xl font-medium text-gray-400 mb-2">No hay anunciantes en seguimiento</h3>
              <p className="text-gray-500">Comienza agregando anunciantes desde la página de búsqueda</p>
            </div>
          ) : (
            filteredAdvertisers.map((advertiser) => (
              <div
                key={advertiser._id}
                className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    {/* Profile Picture */}
                    {advertiser.pageProfilePictureUrl ? (
                      <img
                        src={advertiser.pageProfilePictureUrl}
                        alt={advertiser.pageName}
                        className="w-12 h-12 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    
                    {/* Fallback Avatar */}
                    <div className={`w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center text-white font-bold ${advertiser.pageProfilePictureUrl ? 'hidden' : ''}`}>
                      {advertiser.pageName.charAt(0).toUpperCase()}
                    </div>

                    {/* Advertiser Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-white truncate">
                          {advertiser.pageName}
                        </h3>
                        {advertiser.pageVerification && (
                          <span className="text-green-400 text-sm">✓ Verificado</span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs border ${getProductTypeColor(advertiser.productType)}`}>
                          {getProductTypeIcon(advertiser.productType)}
                          <span className="ml-1 capitalize">{advertiser.productType}</span>
                        </span>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-400 mb-3">
                        {advertiser.pageLikeCount && (
                          <span>👥 {formatNumber(advertiser.pageLikeCount)} seguidores</span>
                        )}
                        <span>📊 {advertiser.totalAdsTracked} ads trackeados</span>
                        <span>📅 Desde {formatDate(advertiser.trackingStartDate)}</span>
                      </div>

                      {advertiser.notes && (
                        <p className="text-sm text-gray-300 mb-3">{advertiser.notes}</p>
                      )}

                      {/* Daily Stats with Mini Chart */}
                      {(advertiser.dailyStats && advertiser.dailyStats.length > 0) || advertiser.initialActiveAdsCount > 0 ? (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-300 mb-3">Evolución de Anuncios Activos</h4>
                          
                          {/* Mini Chart */}
                          <div className="bg-gray-700/30 rounded-lg p-4 mb-4">
                            <MiniChart 
                              data={getCombinedChartData(advertiser).map(dataPoint => ({
                                date: dataPoint.date,
                                activeAds: dataPoint.activeAds
                              }))}
                              height={80}
                              showTrend={true}
                            />
                          </div>

                          {/* Recent Stats Grid - incluir día inicial si existe */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {getCombinedChartData(advertiser).slice(-4).map((dataPoint, index) => (
                              <div key={index} className={`rounded-lg p-3 ${dataPoint.isInitial ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-gray-700/50'}`}>
                                <p className="text-xs text-gray-400">
                                  {dataPoint.isInitial ? 'Inicio del tracking' : formatDate(dataPoint.date)}
                                </p>
                                <p className="text-sm font-semibold text-white">{dataPoint.activeAds} activos</p>
                                {!dataPoint.isInitial && (
                                  <p className="text-xs text-gray-400">
                                    {advertiser.dailyStats?.find(stat => stat.date === dataPoint.date)?.newAds || 0} nuevos
                                  </p>
                                )}
                                {dataPoint.isInitial && (
                                  <p className="text-xs text-blue-300">Día inicial</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Initial Active Ads Count - Solo mostrar si no hay estadísticas diarias */}
                      {advertiser.initialActiveAdsCount > 0 && (!advertiser.dailyStats || advertiser.dailyStats.length === 0) && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">
                            Anuncios Activos Iniciales
                          </h4>
                          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                              <span className="text-sm font-semibold text-blue-300">
                                {advertiser.initialActiveAdsCount} anuncios activos al momento de agregar
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              Se hace seguimiento diario de este conteo y nuevos anuncios
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateStatsMutation.mutate({ 
                        id: advertiser._id, 
                        stats: {} // El backend ahora obtiene los datos reales automáticamente
                      })}
                      disabled={updateStatsMutation.isLoading}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      title="Obtener estadísticas actuales del anunciante"
                    >
                      <RefreshCw className={`w-4 h-4 ${updateStatsMutation.isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    
                    <button
                      onClick={() => deleteMutation.mutate(advertiser._id)}
                      disabled={deleteMutation.isLoading}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Eliminar del seguimiento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {advertisersData?.pagination && advertisersData.pagination.totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
              >
                Anterior
              </button>
              
              <span className="px-4 py-2 text-gray-400">
                Página {page} de {advertisersData.pagination.totalPages}
              </span>
              
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === advertisersData.pagination.totalPages}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackedAdvertisersPage;
