import React from 'react'
import { useQuery } from 'react-query'
import { BarChart3, TrendingUp, DollarSign, Globe } from 'lucide-react'
import { completeSearchesApi } from '@/services/api'

export function StatsPage() {
  const { data: stats, isLoading } = useQuery(
    'search-stats',
    () => completeSearchesApi.getStats()
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="loading-spinner w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold holographic-title">
          <BarChart3 className="inline w-8 h-8 mr-3" />
          Análisis y Ahorros
        </h1>
        <p className="text-gray-400 mt-2">
          Rastrea tus ahorros de costos y patrones de búsqueda
        </p>
      </div>

      {/* Cost Savings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-box">
          <div className="text-3xl font-bold text-green-400 mb-2">
            {stats?.costSavings?.estimatedSavings || '$0.00'}
          </div>
          <div className="text-sm text-gray-400">Ahorros Estimados</div>
          <div className="text-xs text-green-600 mt-1">
            {stats?.costSavings?.apifySearchesSaved || 0} búsquedas Apify ahorradas
          </div>
        </div>

        <div className="stat-box">
          <div className="text-3xl font-bold text-primary-400 mb-2">
            {stats?.overview?.totalSearches || 0}
          </div>
          <div className="text-sm text-gray-400">Total de Búsquedas</div>
          <div className="text-xs text-primary-600 mt-1">
            {stats?.overview?.totalAds || 0} anuncios encontrados
          </div>
        </div>

        <div className="stat-box">
          <div className="text-3xl font-bold text-purple-400 mb-2">
            {Math.round(stats?.overview?.avgAdsPerSearch || 0)}
          </div>
          <div className="text-sm text-gray-400">Promedio por Búsqueda</div>
          <div className="text-xs text-purple-600 mt-1">
            {stats?.overview?.totalAccesses || 0} accesos totales
          </div>
        </div>
      </div>

      {/* Top Countries */}
      {stats?.topCountries && stats.topCountries.length > 0 && (
        <div className="holographic-panel p-6">
          <h3 className="text-lg font-semibold text-primary-400 mb-4 flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            Países Principales
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {stats.topCountries.slice(0, 6).map((country, index) => (
              <div key={country._id} className="text-center p-3 bg-dark-800/50 rounded-lg">
                <div className="font-semibold text-white">{country._id}</div>
                <div className="text-sm text-primary-400">{country.count} búsquedas</div>
                <div className="text-xs text-gray-400">{country.totalAds} anuncios</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Terms */}
      {stats?.topTerms && stats.topTerms.length > 0 && (
        <div className="holographic-panel p-6">
          <h3 className="text-lg font-semibold text-primary-400 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Términos Más Buscados
          </h3>
          <div className="space-y-3">
            {stats.topTerms.slice(0, 5).map((term, index) => (
              <div key={term._id} className="flex justify-between items-center p-3 bg-dark-800/50 rounded-lg">
                <span className="text-white font-medium">{term._id}</span>
                <div className="text-right">
                  <div className="text-primary-400">{term.count} búsquedas</div>
                  <div className="text-xs text-gray-400">{term.totalAds} anuncios</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Most Accessed */}
      {stats?.mostAccessed && stats.mostAccessed.length > 0 && (
        <div className="holographic-panel p-6">
          <h3 className="text-lg font-semibold text-primary-400 mb-4 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Búsquedas Más Reutilizadas
          </h3>
          <div className="space-y-3">
            {stats.mostAccessed.map((search) => (
              <div key={search._id} className="flex justify-between items-center p-3 bg-dark-800/50 rounded-lg">
                <div>
                  <div className="text-white font-medium">{search.searchName}</div>
                  <div className="text-xs text-gray-400">
                    {search.totalResults} anuncios • {search.source}
                  </div>
                </div>
                <div className="text-purple-400 font-bold text-lg">
                  {search.accessCount}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
