import React, { useState } from 'react'
import { useMutation } from 'react-query'
import { toast } from 'react-hot-toast'
import { 
  Search, 
  Sparkles, 
  Filter,
  Download,
  Eye,
  Bookmark,
  ExternalLink,
  Calendar,
  Users,
  MapPin
} from 'lucide-react'

import { searchApi, suggestionsApi } from '@/services/api'
import type { SearchParams, AdData, SearchResponse } from '@shared/types'

export function SearchPage() {
  const [searchParams, setSearchParams] = useState<SearchParams>({
    searchType: 'keyword',
    value: '',
    country: 'CO',
    minDays: 1,
    adType: 'ALL',
    mediaType: 'ALL',
    searchPhraseType: 'unordered',
    useApify: false,
    apifyCount: 100
  })

  const [searchResults, setSearchResults] = useState<AdData[]>([])
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  // Search mutation
  const searchMutation = useMutation(
    (params: SearchParams) => searchApi.search(params),
    {
      onSuccess: (data: SearchResponse) => {
        setSearchResults(data.data)
        toast.success(`¡Se encontraron ${data.data.length} anuncios!`)
        
        if (data.autoSaved?.saved) {
          toast.success(data.autoSaved.message, { duration: 6000 })
        }
      },
      onError: (error: any) => {
        console.error('Search error:', error)
        toast.error(error.response?.data?.error || 'Error en la búsqueda')
      }
    }
  )

  // AI suggestions mutation
  const suggestionsMutation = useMutation(
    (idea: string) => suggestionsApi.generateSuggestions(idea),
    {
      onSuccess: (data) => {
        toast.success(`¡Se generaron ${data.suggestions.length} sugerencias de palabras clave!`)
      },
      onError: (error: any) => {
        console.error('Suggestions error:', error)
        toast.error('Error al generar sugerencias')
      }
    }
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchParams.value.trim()) {
      toast.error('Por favor ingresa un término de búsqueda')
      return
    }

    searchMutation.mutate(searchParams)
  }

  const handleSuggestions = () => {
    if (!searchParams.value.trim()) {
      toast.error('Ingresa una idea primero')
      return
    }
    
    suggestionsMutation.mutate(searchParams.value)
  }

  const getFlameEmoji = (score: number) => {
    const flames = ['🔥', '🔥🔥', '🔥🔥🔥', '🔥🔥🔥🔥', '🔥🔥🔥🔥🔥']
    return flames[Math.max(0, Math.min(score - 1, 4))] || ''
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('es-ES')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold holographic-title mb-2">
          Descubrimiento Profesional de Anuncios
        </h1>
        <p className="text-gray-400 text-lg">
          Encuentra anuncios ganadores de Facebook con insights impulsados por IA
        </p>
      </div>

      {/* Search Form */}
      <div className="holographic-panel p-6">
        <form onSubmit={handleSearch} className="space-y-6">
          {/* Main search input */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchParams.value}
                onChange={(e) => setSearchParams(prev => ({ ...prev, value: e.target.value }))}
                placeholder="Ingresa palabra clave o término de búsqueda..."
                className="form-input w-full pr-12"
              />
              <button
                type="button"
                onClick={handleSuggestions}
                disabled={suggestionsMutation.isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon"
                title="Generar sugerencias de IA"
              >
                <Sparkles className={`w-5 h-5 ${suggestionsMutation.isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="btn-secondary px-4"
            >
              <Filter className="w-5 h-5" />
            </button>
            
            <button
              type="submit"
              disabled={searchMutation.isLoading}
              className="btn-primary px-8"
            >
              {searchMutation.isLoading ? (
                <div className="loading-spinner w-5 h-5" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* AI Suggestions */}
          {suggestionsMutation.data?.suggestions && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-primary-400">
                🤖 Sugerencias de IA:
              </label>
              <div className="flex flex-wrap gap-2">
                {suggestionsMutation.data.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSearchParams(prev => ({ ...prev, value: suggestion }))}
                    className="tag hover:bg-primary-500/30 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Filters */}
          {isAdvancedOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-dark-800/50 rounded-lg">
              {/* Country */}
              <div>
                <label className="block text-sm font-medium text-primary-400 mb-2">
                  País
                </label>
                <select
                  value={searchParams.country}
                  onChange={(e) => setSearchParams(prev => ({ ...prev, country: e.target.value }))}
                  className="form-select w-full"
                >
                  <option value="CO">Colombia</option>
                  <option value="US">United States</option>
                  <option value="MX">Mexico</option>
                  <option value="BR">Brazil</option>
                  <option value="AR">Argentina</option>
                  <option value="ES">Spain</option>
                </select>
              </div>

              {/* Minimum Days */}
              <div>
                <label className="block text-sm font-medium text-primary-400 mb-2">
                  Días Mínimos Ejecutándose
                </label>
                <input
                  type="number"
                  min="0"
                  value={searchParams.minDays}
                  onChange={(e) => setSearchParams(prev => ({ ...prev, minDays: parseInt(e.target.value) || 0 }))}
                  className="form-input w-full"
                />
              </div>

              {/* Ad Type */}
              <div>
                <label className="block text-sm font-medium text-primary-400 mb-2">
                  Tipo de Anuncio
                </label>
                <select
                  value={searchParams.adType}
                  onChange={(e) => setSearchParams(prev => ({ ...prev, adType: e.target.value }))}
                  className="form-select w-full"
                >
                  <option value="ALL">Todos los Anuncios</option>
                  <option value="POLITICAL_AND_ISSUE_ADS">Políticos (con métricas)</option>
                  <option value="FINANCIAL_PRODUCTS_AND_SERVICES_ADS">Financieros</option>
                  <option value="EMPLOYMENT_ADS">Empleo</option>
                  <option value="HOUSING_ADS">Vivienda</option>
                </select>
              </div>

              {/* Search Method */}
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-primary-400 mb-3">
                  Método de Búsqueda
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label className="search-method-label">
                    <input
                      type="radio"
                      name="searchMethod"
                      value="api"
                      checked={!searchParams.useApify && !searchParams.useWebScraping}
                      onChange={() => setSearchParams(prev => ({ 
                        ...prev, 
                        useApify: false, 
                        useWebScraping: false 
                      }))}
                      className="search-method-radio"
                    />
                    <div className="text-center">
                      <div className="text-sm font-medium">🚀 API</div>
                      <div className="text-xs text-gray-400">Rápido y Oficial</div>
                    </div>
                  </label>
                  
                  <label className="search-method-label">
                    <input
                      type="radio"
                      name="searchMethod"
                      value="scraping"
                      checked={searchParams.useWebScraping === true}
                      onChange={() => setSearchParams(prev => ({ 
                        ...prev, 
                        useApify: false, 
                        useWebScraping: true 
                      }))}
                      className="search-method-radio"
                    />
                    <div className="text-center">
                      <div className="text-sm font-medium">🕷️ Inteligente</div>
                      <div className="text-xs text-gray-400">Múltiples Variaciones</div>
                    </div>
                  </label>
                  
                  <label className="search-method-label">
                    <input
                      type="radio"
                      name="searchMethod"
                      value="apify"
                      checked={searchParams.useApify === true}
                      onChange={() => setSearchParams(prev => ({ 
                        ...prev, 
                        useApify: true, 
                        useWebScraping: false 
                      }))}
                      className="search-method-radio"
                    />
                    <div className="text-center">
                      <div className="text-sm font-medium">💎 Apify Pro</div>
                      <div className="text-xs text-gray-400">Profesional</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Apify Count */}
              {searchParams.useApify && (
                <div>
                  <label className="block text-sm font-medium text-primary-400 mb-2">
                    Máx Anuncios (Apify)
                  </label>
                  <select
                    value={searchParams.apifyCount}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, apifyCount: parseInt(e.target.value) }))}
                    className="form-select w-full"
                  >
                    <option value={50}>50 anuncios</option>
                    <option value={100}>100 anuncios</option>
                    <option value={200}>200 anuncios</option>
                    <option value={500}>500 anuncios (costoso)</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-primary-300">
              Se encontraron {searchResults.length} Anuncios
            </h2>
            <div className="flex gap-2">
              <button className="btn-secondary">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </button>
              <button className="btn-secondary">
                <Bookmark className="w-4 h-4 mr-2" />
                Guardar Todo
              </button>
            </div>
          </div>

          {/* Results Grid */}
          <div className="ad-grid">
            {searchResults.map((ad) => (
              <div key={ad.id} className="ad-card">
                {/* Ad Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center text-white font-bold">
                      {ad.page_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white truncate">
                        {ad.page_name}
                      </h3>
                      <div className="text-lg font-bold text-primary-400 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {ad.days_running} días ejecutándose
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {ad.hotness_score > 0 && (
                      <span className="flame-emoji" title={`Hotness: ${ad.hotness_score}/5`}>
                        {getFlameEmoji(ad.hotness_score)}
                      </span>
                    )}
                    <button className="btn-icon">
                      <Bookmark className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Ad Content */}
                <div className="space-y-3">
                  {/* Creative Bodies */}
                  {ad.ad_creative_bodies.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-300 line-clamp-3">
                        {ad.ad_creative_bodies[0]}
                      </p>
                    </div>
                  )}

                  {/* Ad Titles */}
                  {ad.ad_creative_link_titles.length > 0 && (
                    <div>
                      <h4 className="font-medium text-primary-300 text-sm">
                        {ad.ad_creative_link_titles[0]}
                      </h4>
                    </div>
                  )}

                  {/* Ad Info */}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(ad.ad_delivery_start_time)}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {searchParams.country}
                    </div>
                    {ad.collation_count > 1 && (
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {ad.collation_count} variantes
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-primary-500/20">
                    <button className="btn-secondary text-xs px-3 py-1 flex-1">
                      <Eye className="w-3 h-3 mr-1" />
                      Ver
                    </button>
                    <button 
                      onClick={() => window.open(ad.ad_snapshot_url, '_blank')}
                      className="btn-secondary text-xs px-3 py-1 flex-1"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Original
                    </button>
                  </div>
                </div>

                {/* Source Badge */}
                <div className="absolute top-2 right-2">
                  <span className={`
                    text-xs px-2 py-1 rounded-full font-medium
                    ${ad.source === 'apify_scraping' 
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' 
                      : ad.source === 'web_scraping'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-green-500/20 text-green-300 border border-green-500/30'
                    }
                  `}>
                    {ad.source === 'apify_scraping' ? '💎' : ad.source === 'web_scraping' ? '🕷️' : '🚀'}
                  </span>
                </div>

                {/* Hot Ad Animation */}
                {ad.hotness_score >= 4 && (
                  <div className="absolute inset-0 rounded-lg hot-ad pointer-events-none" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!searchMutation.isLoading && searchResults.length === 0 && (
        <div className="text-center py-20">
          <Search className="w-24 h-24 mx-auto text-gray-600 mb-4" />
          <h3 className="text-2xl font-medium text-gray-400 holographic-title">
            Listo para Descubrir
          </h3>
          <p className="text-gray-500 mt-2">
            Ingresa una palabra clave para encontrar anuncios ganadores de Facebook
          </p>
        </div>
      )}
    </div>
  )
}
