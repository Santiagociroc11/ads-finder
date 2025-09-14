import { useQuery, useMutation, useQueryClient } from 'react-query'
import { toast } from 'react-hot-toast'
import { Database, Play, Trash2, Calendar } from 'lucide-react'

import { completeSearchesApi } from '@/services/api'

export function SavedSearchesPage() {
  const queryClient = useQueryClient()

  // Get saved searches
  const { data, isLoading } = useQuery(
    'complete-searches',
    () => completeSearchesApi.getCompleteSearches(),
    {
      onError: () => toast.error('Error al cargar búsquedas guardadas')
    }
  )

  // Delete search mutation
  const deleteMutation = useMutation(
    (id: string) => completeSearchesApi.deleteCompleteSearch(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('complete-searches')
        toast.success('Búsqueda eliminada exitosamente')
      },
      onError: () => {
        toast.error('Error al eliminar búsqueda')
      }
    }
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="loading-spinner w-8 h-8" />
      </div>
    )
  }

  const searches = data?.searches || []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold holographic-title">
            💰 Búsquedas Guardadas
          </h1>
          <p className="text-gray-400 mt-2">
            Reutiliza búsquedas costosas de Apify sin costo adicional
          </p>
        </div>
        
        {data?.stats && (
          <div className="holographic-panel p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                ${(data.stats.apifySearches * 0.05).toFixed(2)}
              </div>
              <div className="text-sm text-gray-400">Ahorros Estimados</div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-box">
            <div className="text-2xl font-bold text-primary-400">
              {data.stats.totalSearches}
            </div>
            <div className="text-sm text-gray-400">Total de Búsquedas</div>
          </div>
          <div className="stat-box">
            <div className="text-2xl font-bold text-green-400">
              {data.stats.totalAds.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Anuncios Guardados</div>
          </div>
          <div className="stat-box">
            <div className="text-2xl font-bold text-yellow-400">
              {data.stats.apifySearches}
            </div>
            <div className="text-sm text-gray-400">Búsquedas Apify</div>
          </div>
          <div className="stat-box">
            <div className="text-2xl font-bold text-purple-400">
              {Math.round(data.stats.avgAdsPerSearch || 0)}
            </div>
            <div className="text-sm text-gray-400">Promedio por Búsqueda</div>
          </div>
        </div>
      )}

      {/* Searches List */}
      {searches.length === 0 ? (
        <div className="text-center py-20">
          <Database className="w-24 h-24 mx-auto text-gray-600 mb-4" />
          <h3 className="text-2xl font-medium text-gray-400">Sin Búsquedas Guardadas</h3>
          <p className="text-gray-500 mt-2">
            Ejecuta búsquedas con Apify para comenzar a ahorrar costos
          </p>
        </div>
      ) : (
        <div className="ad-grid">
          {searches.map((search) => (
            <div key={search._id} className="holographic-panel p-6 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white text-lg">
                    {search.searchName}
                  </h3>
                  <div className="text-sm text-gray-400">
                    {search.metadata.searchTerm} • {search.metadata.country}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {search.source === 'apify_scraping' ? (
                    <span className="text-yellow-400">💎</span>
                  ) : (
                    <span className="text-blue-400">🚀</span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Resultados:</span>
                  <span className="text-green-400 font-semibold">
                    {search.totalResults}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Accedido:</span>
                  <span className="text-purple-400">
                    {search.accessCount}x
                  </span>
                </div>
              </div>

              {/* Date */}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Calendar className="w-3 h-3" />
                {new Date(search.executedAt).toLocaleDateString('es-ES')}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-primary-500/20">
                <button 
                  className="btn-primary text-sm px-4 py-2 flex-1"
                  onClick={() => {
                    // Navigate to search details
                    toast.success('Cargando búsqueda...')
                  }}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Cargar Búsqueda
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar "${search.searchName}"?`)) {
                      deleteMutation.mutate(search._id)
                    }
                  }}
                  className="btn-icon text-red-400 hover:text-red-300"
                  disabled={deleteMutation.isLoading}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Cost Savings Badge */}
              {search.source === 'apify_scraping' && (
                <div className="text-center">
                  <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full">
                    💰 Ahorra Costos de Apify
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
