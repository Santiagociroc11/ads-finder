import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { toast } from 'react-hot-toast'
import { 
  Bookmark, 
  Filter, 
  Search, 
  Heart, 
  Trash2, 
  ExternalLink, 
  Calendar,
  MapPin,
  Activity,
  Eye,
  Tag,
  Star,
  MoreVertical,
  Download,
  Grid,
  List
} from 'lucide-react'
import { savedAdsApi } from '@/services/api'
import type { SavedAd, AdData } from '@/types/shared'

export function SavedAdsPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({
    collection: 'all',
    tags: '',
    isFavorite: false,
    sortBy: 'savedAt'
  })
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')

  // Get saved ads
  const { data, isLoading, error } = useQuery({
    queryKey: ['savedAds', filters],
    queryFn: () => savedAdsApi.getSavedAds(filters),
    onError: () => toast.error('Error al cargar anuncios guardados')
  })

  // Delete ad mutation
  const deleteMutation = useMutation(
    (id: string) => savedAdsApi.deleteSavedAd(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('savedAds')
        toast.success('Anuncio eliminado exitosamente')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Error al eliminar anuncio')
      }
    }
  )

  // Update favorite mutation
  const updateFavoriteMutation = useMutation(
    ({ id, isFavorite }: { id: string; isFavorite: boolean }) => 
      savedAdsApi.updateSavedAd(id, { isFavorite }),
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries('savedAds')
        toast.success(variables.isFavorite ? 'Agregado a favoritos' : 'Removido de favoritos')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Error al actualizar favorito')
      }
    }
  )

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleDelete = (id: string, pageName: string) => {
    if (confirm(`¿Eliminar "${pageName}" de tus anuncios guardados?`)) {
      deleteMutation.mutate(id)
    }
  }

  const handleToggleFavorite = (id: string, isFavorite: boolean) => {
    updateFavoriteMutation.mutate({ id, isFavorite: !isFavorite })
  }

  const generateAdLibraryUrl = (adId: string, country: string) => {
    const baseUrl = 'https://www.facebook.com/ads/library/';
    const urlParams = new URLSearchParams();
    
    urlParams.set('active_status', 'active');
    urlParams.set('country', country);
    urlParams.set('is_targeted_country', 'false');
    urlParams.set('media_type', 'all');
    urlParams.set('search_type', 'keyword_unordered');
    
    return `${baseUrl}?${urlParams.toString()}`;
  }


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getCountryName = (code: string) => {
    const countries: Record<string, string> = {
      'CO': 'Colombia',
      'US': 'Estados Unidos',
      'MX': 'México',
      'AR': 'Argentina',
      'ES': 'España',
      'BR': 'Brasil'
    }
    return countries[code] || code
  }

  // Filter ads by search term
  const filteredAds = data?.ads?.filter((savedAd: SavedAd) => {
    if (!searchTerm) return true
    const ad = savedAd.adData
    return ad.page_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           ad.ad_creative_bodies?.[0]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           ad.ad_snapshot_url?.toLowerCase().includes(searchTerm.toLowerCase())
  }) || []

  if (error) {
    return (
      <div className="space-y-8">
        <div className="holographic-panel p-8 text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error al cargar anuncios</h2>
          <p className="text-gray-300">No se pudieron cargar los anuncios guardados. Por favor, intenta de nuevo.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="holographic-panel p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/20 border border-purple-500/50 rounded-full flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Anuncios Guardados</h1>
              <p className="text-gray-400">Tu colección curada de anuncios ganadores</p>
            </div>
          </div>
          
          {data?.stats && (
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-400">{data.stats.total}</div>
              <div className="text-sm text-gray-400">Anuncios guardados</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="holographic-panel p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Bookmark className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{data.stats.total}</div>
                <div className="text-sm text-gray-400">Total</div>
              </div>
            </div>
          </div>
          <div className="holographic-panel p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <Heart className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{data.stats.favorites}</div>
                <div className="text-sm text-gray-400">Favoritos</div>
              </div>
            </div>
          </div>
          <div className="holographic-panel p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <Tag className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{data.stats.collections?.length || 0}</div>
                <div className="text-sm text-gray-400">Colecciones</div>
              </div>
            </div>
          </div>
          <div className="holographic-panel p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{Math.round(data.stats.avgHotness || 0)}</div>
                <div className="text-sm text-gray-400">Hotness Promedio</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="holographic-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-400" />
            Filtros
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400'}`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Buscar</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar anuncios..."
                className="form-input pl-10 w-full"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Colección</label>
            <select
              value={filters.collection}
              onChange={(e) => handleFilterChange('collection', e.target.value)}
              className="form-select w-full"
            >
              <option value="all">Todas las colecciones</option>
              {data?.stats?.collections?.map((collection: string) => (
                <option key={collection} value={collection}>{collection}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Ordenar por</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="form-select w-full"
            >
              <option value="savedAt">Fecha guardado</option>
              <option value="hotness">Hotness Score</option>
              <option value="daysRunning">Días corriendo</option>
              <option value="pageName">Nombre página</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.isFavorite}
                onChange={(e) => handleFilterChange('isFavorite', e.target.checked)}
                className="form-checkbox"
              />
              <span className="text-sm text-gray-300">Solo favoritos</span>
            </label>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando anuncios guardados...</p>
        </div>
      ) : filteredAds.length === 0 ? (
        <div className="text-center py-20">
          <Bookmark className="w-24 h-24 text-gray-600 mx-auto mb-4" />
          <h3 className="text-2xl font-semibold text-gray-400 mb-2">No hay anuncios guardados</h3>
          <p className="text-gray-500">Guarda algunos anuncios desde la página de búsqueda para verlos aquí.</p>
        </div>
      ) : (
        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {filteredAds.map((savedAd: SavedAd) => {
            const ad = savedAd.adData
            return (
              <div key={savedAd._id} className="holographic-panel p-6 hover:bg-gray-800/50 transition-colors">
                {viewMode === 'grid' ? (
                  // Grid View
                  <div className="space-y-4">
                    {/* Ad Image */}
                    {ad.apify_data?.images && ad.apify_data?.images.length > 0 && (
                      <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
                        <img 
                          src={ad.apify_data?.images[0]} 
                          alt={ad.page_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Ad Info */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-white line-clamp-2">{ad.page_name}</h3>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => handleToggleFavorite(savedAd._id, savedAd.isFavorite)}
                            className={`p-1 rounded ${savedAd.isFavorite ? 'text-red-400' : 'text-gray-400 hover:text-red-400'}`}
                          >
                            <Heart className={`w-4 h-4 ${savedAd.isFavorite ? 'fill-current' : ''}`} />
                          </button>
                          <div className="relative">
                            <button className="p-1 text-gray-400 hover:text-white">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {ad.ad_creative_bodies && ad.ad_creative_bodies[0] && (
                        <p className="text-sm text-gray-300 line-clamp-3">{ad.ad_creative_bodies[0]}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(savedAd.savedAt)}
                        </div>
                        {ad.apify_data?.page_categories?.[0] && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {ad.apify_data?.page_categories?.[0]}
                          </div>
                        )}
                        {ad.hotness_score && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {ad.hotness_score}
                          </div>
                        )}
                      </div>
                      
                      {/* Tags */}
                      {savedAd.tags && savedAd.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {savedAd.tags.map((tag, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-gray-700/50">
                      <button
                        onClick={() => {
                          if (ad.ad_snapshot_url) {
                            window.open(ad.ad_snapshot_url, '_blank')
                          }
                        }}
                        className="btn-secondary text-xs px-3 py-2 flex-1 flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver Anuncio
                      </button>
                      <button
                        onClick={() => handleDelete(savedAd._id, ad.page_name || 'Anuncio')}
                        className="btn-icon text-red-400 hover:text-red-300"
                        disabled={deleteMutation.isLoading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  // List View
                  <div className="flex gap-4">
                    {/* Ad Image */}
                    {ad.apify_data?.images && ad.apify_data?.images.length > 0 && (
                      <div className="w-24 h-24 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                        <img 
                          src={ad.apify_data?.images[0]} 
                          alt={ad.page_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Ad Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-white truncate">{ad.page_name}</h3>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => handleToggleFavorite(savedAd._id, savedAd.isFavorite)}
                            className={`p-1 rounded ${savedAd.isFavorite ? 'text-red-400' : 'text-gray-400 hover:text-red-400'}`}
                          >
                            <Heart className={`w-4 h-4 ${savedAd.isFavorite ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={() => handleDelete(savedAd._id, ad.page_name || 'Anuncio')}
                            className="p-1 text-red-400 hover:text-red-300"
                            disabled={deleteMutation.isLoading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {ad.ad_creative_bodies && ad.ad_creative_bodies[0] && (
                        <p className="text-sm text-gray-300 line-clamp-2 mb-2">{ad.ad_creative_bodies[0]}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(savedAd.savedAt)}
                        </div>
                        {ad.apify_data?.page_categories?.[0] && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {ad.apify_data?.page_categories?.[0]}
                          </div>
                        )}
                        {ad.hotness_score && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {ad.hotness_score}
                          </div>
                        )}
                      </div>
                      
                      {/* Tags and Collection */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                          {savedAd.collection}
                        </span>
                        {savedAd.tags && savedAd.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                        {savedAd.tags && savedAd.tags.length > 3 && (
                          <span className="text-xs text-gray-500">+{savedAd.tags.length - 3} más</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          if (ad.ad_snapshot_url) {
                            window.open(ad.ad_snapshot_url, '_blank')
                          }
                        }}
                        className="btn-secondary text-xs px-3 py-2 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
