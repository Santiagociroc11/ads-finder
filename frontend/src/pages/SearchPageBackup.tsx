import React, { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { toast } from 'react-hot-toast'
import { 
  Search, 
  Sparkles, 
  Filter,
  Download,
  Bookmark,
  ExternalLink,
  Calendar,
  Users,
  MapPin,
  Database,
  Clock,
  DollarSign,
  Image,
  Video,
  MessageCircle,
  Heart,
  Globe,
  Info
} from 'lucide-react'

import { searchApi, suggestionsApi, savedAdsApi, completeSearchesApi, scraperApi } from '@/services/api'
import type { SearchParams, AdData, SearchResponse } from '@shared/types'

// Smart Image Component with original proportions
const SmartImage = ({ 
  src, 
  alt, 
  fallbackSrc, 
  className = "", 
  containerClassName = "",
  onError,
  preserveAspectRatio = true,
  maxHeight = "max-h-96"
}: {
  src: string
  alt: string
  fallbackSrc?: string
  className?: string
  containerClassName?: string
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  preserveAspectRatio?: boolean
  maxHeight?: string
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setCurrentSrc(src)
    setImageLoaded(false)
    setHasError(false)
  }, [src])

  const handleLoad = () => {
    setImageLoaded(true)
  }

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (fallbackSrc && currentSrc !== fallbackSrc && !hasError) {
      setCurrentSrc(fallbackSrc)
      setHasError(true)
    } else {
      onError?.(e)
      setImageLoaded(true) // Stop loading spinner even on error
    }
  }

  if (preserveAspectRatio) {
    return (
      <div className={`relative overflow-hidden rounded-lg border border-gray-700 ${containerClassName}`}>
        <div className={`relative w-full ${maxHeight} flex justify-center bg-gray-800/50`}>
          <img
            src={currentSrc}
            alt={alt}
            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            } ${className}`}
            style={{
              maxHeight: '24rem', // max-h-96 equivalent
              width: 'auto',
              height: 'auto'
            }}
            onLoad={handleLoad}
            onError={handleError}
          />
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Fallback to original behavior if preserveAspectRatio is false
  return (
    <div className={`relative overflow-hidden rounded-lg border border-gray-700 ${containerClassName}`}>
      <div className="relative h-80">
        <img
          src={currentSrc}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          onLoad={handleLoad}
          onError={handleError}
        />
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}

// Smart Video Component with original proportions
const SmartVideo = ({ 
  videoHdUrl, 
  videoSdUrl, 
  previewImageUrl, 
  className = "", 
  containerClassName = "",
  onError,
  preserveAspectRatio = true,
  maxHeight = "max-h-96"
}: {
  videoHdUrl?: string
  videoSdUrl?: string
  previewImageUrl?: string
  className?: string
  containerClassName?: string
  onError?: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void
  preserveAspectRatio?: boolean
  maxHeight?: string
}) => {
  const [videoLoaded, setVideoLoaded] = useState(false)

  const handleLoadedMetadata = () => {
    setVideoLoaded(true)
  }

  if (videoHdUrl || videoSdUrl) {
    if (preserveAspectRatio) {
      return (
        <div className={`relative overflow-hidden rounded-lg border border-gray-700 ${containerClassName}`}>
          <div className={`relative w-full ${maxHeight} flex justify-center bg-gray-800/50`}>
            <video 
              className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
                videoLoaded ? 'opacity-100' : 'opacity-0'
              } ${className}`}
              style={{
                maxHeight: '24rem', // max-h-96 equivalent
                width: 'auto',
                height: 'auto'
              }}
              controls
              poster={previewImageUrl}
              preload="metadata"
              onLoadedMetadata={handleLoadedMetadata}
              onError={(e) => {
                onError?.(e)
                setVideoLoaded(true) // Stop loading spinner even on error
              }}
            >
              {videoHdUrl && <source src={videoHdUrl} type="video/mp4" />}
              {videoSdUrl && <source src={videoSdUrl} type="video/mp4" />}
              Tu navegador no soporta videos HTML5.
            </video>
            {!videoLoaded && (
              <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )
    }

    // Fallback to original behavior if preserveAspectRatio is false
    return (
      <div className={`relative overflow-hidden rounded-lg border border-gray-700 ${containerClassName}`}>
        <div className="relative h-80">
          <video 
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              videoLoaded ? 'opacity-100' : 'opacity-0'
            } ${className}`}
            controls
            poster={previewImageUrl}
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onError={(e) => {
              onError?.(e)
              setVideoLoaded(true) // Stop loading spinner even on error
            }}
          >
            {videoHdUrl && <source src={videoHdUrl} type="video/mp4" />}
            {videoSdUrl && <source src={videoSdUrl} type="video/mp4" />}
            Tu navegador no soporta videos HTML5.
          </video>
          {!videoLoaded && (
            <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Fallback to preview image if no video URL
  if (previewImageUrl) {
    return (
      <SmartImage
        src={previewImageUrl}
        alt="Video preview"
        containerClassName={containerClassName}
        className={className}
        preserveAspectRatio={preserveAspectRatio}
        maxHeight={maxHeight}
        onError={() => {}}
      />
    )
  }

  return null
}

export function SearchPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useState<SearchParams>({
    searchType: 'keyword',
    value: '',
    country: 'CO',
    minDays: 1,
    adType: 'ALL',
    mediaType: 'ALL',
    searchPhraseType: 'unordered',
    useApify: false,
    apifyCount: 100,
    languages: ['es'] // Default to Spanish
  })

  const [searchResults, setSearchResults] = useState<AdData[]>([])
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [showSavedSearches, setShowSavedSearches] = useState(false)
  const [expandedTexts, setExpandedTexts] = useState<Set<string>>(new Set())
  const [advertiserStats, setAdvertiserStats] = useState<Map<string, { totalActiveAds: number; loading: boolean }>>(new Map())
  const [debugMode, setDebugMode] = useState(false)
  const [debugData, setDebugData] = useState<any>(null)
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({})
  const [sortConfig, setSortConfig] = useState<{
    primary: { field: string; direction: 'asc' | 'desc' } | null
    secondary: { field: string; direction: 'asc' | 'desc' } | null
    tertiary: { field: string; direction: 'asc' | 'desc' } | null
  }>({
    primary: null,
    secondary: null,
    tertiary: null
  })
  const [searchStartTime, setSearchStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState<string>('')

  // Queue for processing advertiser stats sequentially
  const [statsQueue, setStatsQueue] = useState<string[]>([])
  const [isProcessingStats, setIsProcessingStats] = useState(false)

  // Process stats queue one by one
  useEffect(() => {
    if (statsQueue.length > 0 && !isProcessingStats) {
      setIsProcessingStats(true)
      
      const processNext = async () => {
        const pageId = statsQueue[0]
        if (pageId && !advertiserStats.has(pageId)) {
          await getAdvertiserStats(pageId)
        }
        
        // Remove processed item and continue
        setStatsQueue(prev => prev.slice(1))
        
        // Small delay to prevent overwhelming
          setTimeout(() => {
          setIsProcessingStats(false)
        }, 100) // 100ms delay between requests
      }
      
      processNext()
    }
  }, [statsQueue, isProcessingStats, advertiserStats])

  // Load advertiser stats when search results change
  useEffect(() => {
    if (searchResults.length > 0) {
      const uniquePageIds = [...new Set(searchResults.map(ad => ad.page_id).filter(id => id && id !== 'N/A'))]
      console.log(`📊 Queueing ${uniquePageIds.length} advertisers for stats loading...`)
      
      // Clear previous queue and add new page IDs
      setStatsQueue(uniquePageIds)
    }
  }, [searchResults])


  // Search mutation with unique keys to allow concurrent searches
  const searchMutation = useMutation(
    (params: SearchParams) => searchApi.search(params),
    {
      mutationKey: ['search', Date.now(), Math.random()], // Unique key for each search
      onSuccess: (data: SearchResponse) => {
        setSearchResults(data.data)
        setSearchStartTime(null)
        setElapsedTime('')
        toast.success(`¡Se encontraron ${data.data.length} anuncios!`)
        
        if (data.autoSaved?.saved) {
          toast.success(data.autoSaved.message, { duration: 6000 })
          // Refresh saved searches when a new Apify search is auto-saved
          queryClient.invalidateQueries('complete-searches')
        }
      },
      onError: (error: any) => {
        console.error('Search error:', error)
        setSearchStartTime(null)
        setElapsedTime('')
        
        // Handle timeout errors specifically
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          toast.error('La búsqueda tardó más de 15 minutos. Apify puede estar sobrecargado. Intenta con menos anuncios o usa un método diferente.', { duration: 10000 })
        } else if (error.response?.status === 500) {
          toast.error('Error del servidor. Verifica que Apify esté funcionando correctamente.', { duration: 8000 })
        } else {
          toast.error(error.response?.data?.error || 'Error en la búsqueda')
        }
      }
    }
  )

  // Update elapsed time during search
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (searchMutation.isLoading && searchStartTime) {
      interval = setInterval(() => {
        const now = Date.now()
        const elapsed = now - searchStartTime
        const minutes = Math.floor(elapsed / 60000)
        const seconds = Math.floor((elapsed % 60000) / 1000)
        setElapsedTime(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      }, 1000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [searchMutation.isLoading, searchStartTime])

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

  // Get saved searches
  const { data: savedSearchesData, isLoading: isLoadingSavedSearches } = useQuery(
    'complete-searches',
    () => completeSearchesApi.getCompleteSearches({ limit: 20 }),
    {
      onError: () => toast.error('Error al cargar búsquedas guardadas')
    }
  )

  // Load saved search mutation
  const loadSavedSearchMutation = useMutation(
    (searchId: string) => completeSearchesApi.getCompleteSearch(searchId, { page: 1, limit: 1000 }),
    {
      onSuccess: (data) => {
        // Clear previous results before loading saved search
        setSearchResults([])
        setExpandedTexts(new Set())
        setCarouselIndices({})
        setDebugData(null)
        setSortConfig({ primary: null, secondary: null, tertiary: null })
        
        // Clear stats queue and reset processing state
        setStatsQueue([])
        setIsProcessingStats(false)
        setAdvertiserStats(new Map())
        
        setSearchResults(data.results)
        setSearchParams(data.searchParams)
        setShowSavedSearches(false)
        
        // Hide advanced filters after loading saved search
        setIsAdvancedOpen(false)
        
        toast.success(`¡${data.results.length} anuncios cargados desde memoria!`)
      },
      onError: (error: any) => {
        console.error('Load saved search error:', error)
        toast.error('Error al cargar búsqueda guardada')
      }
    }
  )

  // Save complete search mutation
  const saveCompleteSearchMutation = useMutation(
    (data: { searchName: string; searchParams: SearchParams; results: AdData[]; source: string }) => 
      completeSearchesApi.saveCompleteSearch(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('complete-searches')
        toast.success('Búsqueda completa guardada en memoria')
      },
      onError: (error: any) => {
        console.error('Save complete search error:', error)
        toast.error('Error al guardar búsqueda completa')
      }
    }
  )

  // Scraper mutation with unique keys to allow concurrent scraping
  const scraperMutation = useMutation(
    (params: { advertiserName: string; maxAds?: number; country?: string }) => 
      scraperApi.scrapeAdvertiser(params),
    {
      mutationKey: ['scraper', Date.now(), Math.random()], // Unique key for each scraping
      onSuccess: (data: SearchResponse) => {
        setSearchResults(data.data)
        if (debugMode) {
          setDebugData(data)
          console.log('🔍 DEBUG - Scraper raw data:', data)
        }
        toast.success(`¡Se encontraron ${data.data.length} anuncios mediante scraping!`)
      },
      onError: (error: any) => {
        console.error('Scraper error:', error)
        if (debugMode) {
          setDebugData({ error: error.response?.data || error.message })
          console.log('🔍 DEBUG - Scraper error:', error)
        }
        toast.error(error.response?.data?.error || 'Error en el scraping')
      }
    }
  )

  // Bulk save mutation
  const bulkSaveMutation = useMutation(
    (ads: AdData[]) => savedAdsApi.bulkSaveAds({
      ads,
      defaultCollection: 'Búsqueda',
      defaultTags: ['búsqueda', searchParams.value.toLowerCase()],
      defaultNotes: `Búsqueda: "${searchParams.value}" - ${new Date().toLocaleDateString('es-ES')}`
    }),
    {
      onSuccess: (data) => {
        const { saved, skipped } = data
        if (saved > 0) {
          toast.success(`¡${saved} anuncios guardados exitosamente!`)
        }
        if (skipped > 0) {
          toast.success(`${skipped} anuncios ya estaban guardados`, { duration: 4000 })
        }
        if (saved === 0 && skipped === 0) {
          toast.error('No se pudieron guardar los anuncios')
        }
      },
      onError: (error: any) => {
        console.error('Bulk save error:', error)
        toast.error('Error al guardar los anuncios')
      }
    }
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchParams.value.trim()) {
      toast.error('Por favor ingresa un término de búsqueda')
      return
    }

    // FORCE CANCEL any previous search/scraper mutations immediately
    if (searchMutation.isLoading) {
      console.log('🚫 Cancelling previous search mutation...')
      queryClient.cancelQueries(['search'])
      searchMutation.reset()
    }
    if (scraperMutation.isLoading) {
      console.log('🚫 Cancelling previous scraper mutation...')
      queryClient.cancelQueries(['scraper'])
      scraperMutation.reset()
    }

    // Cancel any pending jobs in background WITHOUT blocking anything
    setTimeout(() => {
      scraperApi.cancelPendingJobs()
        .then((cancelResult) => {
          if (cancelResult.cancelledCount > 0) {
            console.log(`🚫 Cancelled ${cancelResult.cancelledCount} pending jobs`)
            toast.success(`Se cancelaron ${cancelResult.cancelledCount} procesos pendientes`)
          }
        })
        .catch((error) => {
          console.warn('Failed to cancel pending jobs:', error)
        })
    }, 0) // Execute after current call stack

    // Immediately clear previous results and start new search
    setSearchResults([])
    setExpandedTexts(new Set())
    setCarouselIndices({})
    setDebugData(null)
    setSortConfig({ primary: null, secondary: null, tertiary: null })
    setSearchStartTime(Date.now())
    setElapsedTime('')
    
    // Clear stats queue and reset processing state
    setStatsQueue([])
    setIsProcessingStats(false)
    setAdvertiserStats(new Map())
    
    // Hide advanced filters after search
    setIsAdvancedOpen(false)

    // Reset advertiser stats loading state
    setAdvertiserStats(new Map())

    searchMutation.mutate(searchParams)
  }

  const handleSuggestions = () => {
    if (!searchParams.value.trim()) {
      toast.error('Ingresa una idea primero')
      return
    }
    
    suggestionsMutation.mutate(searchParams.value)
  }

  const handleSaveAll = () => {
    if (searchResults.length === 0) {
      toast.error('No hay resultados para guardar')
      return
    }
    
    // Save individual ads
    bulkSaveMutation.mutate(searchResults)
    
    // Also save as complete search if there are valid results
    const validResults = searchResults.filter(ad => ad.page_name && ad.page_name !== 'Unknown Page')
    if (validResults.length > 0) {
      // Create unique search name including configuration
      const method = searchParams.useApify ? 'Apify' : searchParams.useWebScraping ? 'Web' : 'API'
      const config = `${method}-${searchParams.minDays}d-${searchParams.adType}`
      const timestamp = new Date().toLocaleString('es-ES')
      const searchName = `${searchParams.value} - ${searchParams.country} - ${config} - ${timestamp}`
      const source = searchParams.useApify ? 'apify_scraping' : searchParams.useWebScraping ? 'web_scraping' : 'api'
      
      saveCompleteSearchMutation.mutate({
        searchName,
        searchParams,
        results: validResults,
        source
      })
    }
  }

  const handleLoadSavedSearch = (searchId: string) => {
    loadSavedSearchMutation.mutate(searchId)
  }

  const handleScrapeAdvertiser = (advertiserName: string) => {
    if (!advertiserName.trim()) {
      toast.error('Por favor ingresa el nombre del anunciante')
      return
    }
    
    // FORCE CANCEL any previous search/scraper mutations immediately
    if (searchMutation.isLoading) {
      console.log('🚫 Cancelling previous search mutation...')
      queryClient.cancelQueries(['search'])
      searchMutation.reset()
    }
    if (scraperMutation.isLoading) {
      console.log('🚫 Cancelling previous scraper mutation...')
      queryClient.cancelQueries(['scraper'])
      scraperMutation.reset()
    }
    
    // Clear previous results before starting new scraping
    setSearchResults([])
    setExpandedTexts(new Set())
    setCarouselIndices({})
    setDebugData(null)
    setSortConfig({ primary: null, secondary: null, tertiary: null })
    
    // Clear stats queue and reset processing state
    setStatsQueue([])
    setIsProcessingStats(false)
    setAdvertiserStats(new Map())
    
    // Hide advanced filters after search
    setIsAdvancedOpen(false)
    
    scraperMutation.mutate({
      advertiserName: advertiserName.trim(),
      maxAds: 50,
      country: searchParams.country
    })
  }

  const getAdvertiserStats = async (pageId: string) => {
    if (!pageId || advertiserStats.has(pageId)) {
      return
    }

    // Set loading state
    setAdvertiserStats(prev => new Map(prev.set(pageId, { totalActiveAds: 0, loading: true })))

    try {
      const result = await scraperApi.getAdvertiserStats({
        pageId,
        country: searchParams.country
      })

      if (debugMode) {
        console.log(`🔍 DEBUG - Stats for pageId ${pageId}:`, result)
        setDebugData((prev: any) => ({
          ...prev,
          [`stats_${pageId}`]: result
        }))
      }

      if (result.success) {
        setAdvertiserStats(prev => new Map(prev.set(pageId, { 
          totalActiveAds: result.totalActiveAds, 
          loading: false 
        })))
      } else {
        setAdvertiserStats(prev => new Map(prev.set(pageId, { 
          totalActiveAds: 0, 
          loading: false 
        })))
      }
    } catch (error) {
      console.error('Error getting advertiser stats:', error)
      if (debugMode) {
        console.log(`🔍 DEBUG - Stats error for pageId ${pageId}:`, error)
      }
      setAdvertiserStats(prev => new Map(prev.set(pageId, { 
        totalActiveAds: 0, 
        loading: false 
      })))
    }
  }

  const getFlameEmoji = (score: number) => {
    const flames = ['🔥', '🔥🔥', '🔥🔥🔥', '🔥🔥🔥🔥', '🔥🔥🔥🔥🔥']
    return flames[Math.max(0, Math.min(score - 1, 4))] || ''
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('es-ES')
  }



  const getPublisherPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'FACEBOOK': return '📘'
      case 'INSTAGRAM': return '📷'
      case 'MESSENGER': return '💬'
      case 'AUDIENCE_NETWORK': return '🎯'
      default: return '📱'
    }
  }

  const formatNumber = (num: number | null) => {
    if (!num) return 'N/A'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getCountryName = (countryCode: string | undefined) => {
    const countryNames: Record<string, string> = {
      // América Latina
      'CO': 'Colombia',
      'MX': 'México',
      'AR': 'Argentina',
      'BR': 'Brasil',
      'CL': 'Chile',
      'PE': 'Perú',
      'VE': 'Venezuela',
      'EC': 'Ecuador',
      'UY': 'Uruguay',
      'PY': 'Paraguay',
      'BO': 'Bolivia',
      'CR': 'Costa Rica',
      'PA': 'Panamá',
      'GT': 'Guatemala',
      'DO': 'República Dominicana',
      
      // América del Norte
      'US': 'Estados Unidos',
      'CA': 'Canadá',
      
      // Europa
      'ES': 'España',
      'GB': 'Reino Unido',
      'FR': 'Francia',
      'DE': 'Alemania',
      'IT': 'Italia',
      'PT': 'Portugal',
      'NL': 'Países Bajos',
      'BE': 'Bélgica',
      'CH': 'Suiza',
      'AT': 'Austria',
      'SE': 'Suecia',
      'NO': 'Noruega',
      'DK': 'Dinamarca',
      'FI': 'Finlandia',
      
      // Asia-Pacífico
      'AU': 'Australia',
      'NZ': 'Nueva Zelanda',
      'JP': 'Japón',
      'KR': 'Corea del Sur',
      'SG': 'Singapur',
      'HK': 'Hong Kong',
      'MY': 'Malasia',
      'TH': 'Tailandia',
      'PH': 'Filipinas',
      'IN': 'India',
      
      // Otros
      'ZA': 'Sudáfrica',
      'EG': 'Egipto',
      'NG': 'Nigeria',
      'IL': 'Israel',
      'TR': 'Turquía',
      'AE': 'Emiratos Árabes Unidos'
    }
    return countryNames[countryCode || 'CO'] || countryCode || 'Colombia'
  }

  const getLanguageName = (languageCode: string) => {
    const languageNames: Record<string, string> = {
      // Principales
      'es': 'Español',
      'en': 'Inglés',
      'pt': 'Portugués',
      'fr': 'Francés',
      'de': 'Alemán',
      'it': 'Italiano',
      
      // Asiáticos
      'zh': 'Chino',
      'cmn': 'Chino Mandarín',
      'yue': 'Cantonés',
      'ja': 'Japonés',
      'ko': 'Coreano',
      'hi': 'Hindi',
      'th': 'Tailandés',
      'vi': 'Vietnamita',
      
      // Otros
      'ar': 'Árabe',
      'ru': 'Ruso',
      'nl': 'Holandés',
      'sv': 'Sueco',
      'no': 'Noruego',
      'da': 'Danés',
      'fi': 'Finlandés',
      'pl': 'Polaco',
      'tr': 'Turco',
      'he': 'Hebreo'
    }
    return languageNames[languageCode] || languageCode
  }

  const getLanguagesDisplay = (languages: string[] | undefined) => {
    if (!languages || languages.length === 0) return 'Todos los idiomas'
    if (languages.length === 1) return getLanguageName(languages[0])
    if (languages.length <= 3) return languages.map(getLanguageName).join(', ')
    return `${languages.slice(0, 2).map(getLanguageName).join(', ')} +${languages.length - 2} más`
  }

  // Sorting functions
  const getSortValue = (ad: AdData, field: string): number => {
    switch (field) {
      case 'days_running':
        return ad.days_running || 0
      case 'advertiser_active_ads':
        const stats = advertiserStats.get(ad.page_id)
        return stats?.totalActiveAds || 0
      case 'collation_count':
        return ad.collation_count || 0
      case 'hotness_score':
        return ad.hotness_score || 0
      default:
        return 0
    }
  }

  const sortResults = (results: AdData[]): AdData[] => {
    if (!sortConfig.primary) return results

    return [...results].sort((a, b) => {
      // Primary sort
      const primaryA = getSortValue(a, sortConfig.primary!.field)
      const primaryB = getSortValue(b, sortConfig.primary!.field)
      let primaryComparison = 0

      if (primaryA < primaryB) primaryComparison = -1
      else if (primaryA > primaryB) primaryComparison = 1

      if (primaryComparison !== 0) {
        return sortConfig.primary!.direction === 'asc' ? primaryComparison : -primaryComparison
      }

      // Secondary sort (if primary values are equal)
      if (sortConfig.secondary) {
        const secondaryA = getSortValue(a, sortConfig.secondary.field)
        const secondaryB = getSortValue(b, sortConfig.secondary.field)
        let secondaryComparison = 0

        if (secondaryA < secondaryB) secondaryComparison = -1
        else if (secondaryA > secondaryB) secondaryComparison = 1

        if (secondaryComparison !== 0) {
          return sortConfig.secondary.direction === 'asc' ? secondaryComparison : -secondaryComparison
        }
      }

      // Tertiary sort (if primary and secondary values are equal)
      if (sortConfig.tertiary) {
        const tertiaryA = getSortValue(a, sortConfig.tertiary.field)
        const tertiaryB = getSortValue(b, sortConfig.tertiary.field)
        let tertiaryComparison = 0

        if (tertiaryA < tertiaryB) tertiaryComparison = -1
        else if (tertiaryA > tertiaryB) tertiaryComparison = 1

        return sortConfig.tertiary.direction === 'asc' ? tertiaryComparison : -tertiaryComparison
      }

      return 0
    })
  }

  const handleSortChange = (level: 'primary' | 'secondary' | 'tertiary', field: string) => {
    setSortConfig(prev => {
      const newConfig = { ...prev }
      
      // If clicking the same field, cycle through: asc -> desc -> null
      if (newConfig[level]?.field === field) {
        if (newConfig[level]?.direction === 'asc') {
          newConfig[level] = { field, direction: 'desc' }
        } else if (newConfig[level]?.direction === 'desc') {
          newConfig[level] = null
        }
      } else {
        // New field, start with asc
        newConfig[level] = { field, direction: 'asc' }
      }

      // If setting primary, clear secondary and tertiary
      if (level === 'primary') {
        newConfig.secondary = null
        newConfig.tertiary = null
      }
      // If setting secondary, clear tertiary
      else if (level === 'secondary') {
        newConfig.tertiary = null
      }

      return newConfig
    })
  }

  const getSortIcon = (level: 'primary' | 'secondary' | 'tertiary', field: string) => {
    const config = sortConfig[level]
    if (!config || config.field !== field) return '↕️'
    return config.direction === 'asc' ? '↑' : '↓'
  }

  const getSortLabel = (field: string) => {
    const labels: Record<string, string> = {
      'days_running': 'Días corriendo',
      'advertiser_active_ads': 'Anuncios activos del anunciante',
      'collation_count': 'Duplicados',
      'hotness_score': 'Puntuación de popularidad'
    }
    return labels[field] || field
  }

  // Carousel functions
  const getCarouselIndex = (adId: string) => carouselIndices[adId] || 0
  
  const setCarouselIndex = (adId: string, index: number) => {
    setCarouselIndices(prev => ({ ...prev, [adId]: index }))
  }
  
  const nextCarouselItem = (adId: string, totalItems: number) => {
    const currentIndex = getCarouselIndex(adId)
    const nextIndex = (currentIndex + 1) % totalItems
    setCarouselIndex(adId, nextIndex)
  }
  
  const prevCarouselItem = (adId: string, totalItems: number) => {
    const currentIndex = getCarouselIndex(adId)
    const prevIndex = currentIndex === 0 ? totalItems - 1 : currentIndex - 1
    setCarouselIndex(adId, prevIndex)
  }


  // Calculate advertiser ad count
  const getAdvertiserAdCount = (pageName: string) => {
    return searchResults.filter(ad => ad.page_name === pageName).length
  }

  // Helper function to detect data format and get appropriate data
  const getAdData = (ad: AdData) => {
    const adData = ad as any
    
    // Temporary debug to see the structure
    if (adData.page_name === 'Health Insider') {
      console.log('=== DEBUG HEALTH INSIDER ===')
      console.log('Full ad object:', adData)
      console.log('Has apify_data?', !!adData.apify_data)
      console.log('Has snapshot?', !!adData.snapshot)
      if (adData.apify_data) {
        console.log('apify_data:', adData.apify_data)
        console.log('original_item:', adData.apify_data.original_item)
        if (adData.apify_data.original_item?.snapshot) {
          console.log('original_item.snapshot.cards:', adData.apify_data.original_item.snapshot.cards?.length || 0)
        }
      }
      console.log('===========================')
    }
    
    // Check if it's Apify format (has apify_data) - PRIORITY CHECK
    if (adData.apify_data && typeof adData.apify_data === 'object' && adData.apify_data !== null) {
      const apifyData = adData.apify_data;
      const originalItem = apifyData.original_item || {};
      const originalSnapshot = originalItem.snapshot || {};
      
      const result = {
        format: 'apify',
        data: adData,
        hasRichData: true,
        images: apifyData.images || originalSnapshot.images || [],
        videos: apifyData.videos || originalSnapshot.videos || [],
        cards: originalSnapshot.cards || [],
        body: (ad.ad_creative_bodies && ad.ad_creative_bodies[0]) || originalSnapshot.body?.text || null,
        pageInfo: {
          profilePicture: apifyData.page_profile_picture_url || originalSnapshot.page_profile_picture_url,
          categories: apifyData.page_categories || originalSnapshot.page_categories || [],
          likeCount: apifyData.page_like_count || originalSnapshot.page_like_count,
          profileUri: apifyData.page_profile_uri || originalSnapshot.page_profile_uri
        },
        apifyInfo: {
          displayFormat: apifyData.display_format || originalSnapshot.display_format,
          ctaText: apifyData.cta_text || originalSnapshot.cta_text,
          ctaType: apifyData.cta_type || originalSnapshot.cta_type,
          linkUrl: apifyData.link_url || originalSnapshot.link_url
        }
      }
      return result
    }
    
    // Check if it's Apify format (legacy - has snapshot directly) - BACKUP CHECK
    if (adData.snapshot && typeof adData.snapshot === 'object' && adData.snapshot !== null) {
      const result = {
        format: 'apify',
        data: adData,
        hasRichData: true,
        images: adData.snapshot?.images || [],
        videos: adData.snapshot?.videos || [],
        cards: adData.snapshot?.cards || [],
        body: adData.snapshot?.body?.text || (ad.ad_creative_bodies && ad.ad_creative_bodies[0]) || null,
        pageInfo: {
          profilePicture: adData.snapshot?.page_profile_picture_url,
          categories: adData.snapshot?.page_categories,
          likeCount: adData.snapshot?.page_like_count,
          profileUri: adData.snapshot?.page_profile_uri
        },
        apifyInfo: {
          displayFormat: adData.snapshot?.display_format,
          ctaText: adData.snapshot?.cta_text,
          ctaType: adData.snapshot?.cta_type,
          linkUrl: adData.snapshot?.link_url
        }
      }
      return result
    }
    
    // Check if it's API format (has ad_creative_bodies but no snapshot)
    if (ad.ad_creative_bodies && ad.ad_creative_bodies.length > 0) {
      const result = {
        format: 'api',
        data: adData,
        hasRichData: false,
        images: [],
        videos: [],
        cards: [],
        body: ad.ad_creative_bodies[0] || null,
        pageInfo: {
          profilePicture: null,
          categories: [],
          likeCount: null,
          profileUri: null
        },
        apifyInfo: {
          displayFormat: null,
          ctaText: null,
          ctaType: null,
          linkUrl: null
        }
      }
      return result
    }
    
    // Default fallback
    const result = {
      format: 'unknown',
      data: adData,
      hasRichData: false,
      images: [],
      videos: [],
      cards: [],
      body: null,
      pageInfo: {
        profilePicture: null,
        categories: [],
        likeCount: null,
        profileUri: null
      },
      apifyInfo: {
        displayFormat: null,
        ctaText: null,
        ctaType: null,
        linkUrl: null
      }
    }
    return result
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
                className="form-input w-full pr-20"
              />
            <button
              type="button"
              onClick={handleSuggestions}
              disabled={suggestionsMutation.isLoading}
              className="absolute right-12 top-1/2 -translate-y-1/2 btn-icon"
              title="Generar sugerencias de IA"
            >
              <Sparkles className={`w-5 h-5 ${suggestionsMutation.isLoading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              type="button"
              onClick={() => handleScrapeAdvertiser(searchParams.value)}
              disabled={scraperMutation.isLoading || !searchParams.value.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon"
              title="Scrapear todos los anuncios de este anunciante"
            >
              <Globe className={`w-5 h-5 ${scraperMutation.isLoading ? 'animate-spin' : ''}`} />
            </button>
            </div>
            
            <button
              type="button"
              onClick={() => setShowSavedSearches(!showSavedSearches)}
              className="btn-secondary px-4"
              title="Cargar búsquedas guardadas"
            >
              <Database className="w-5 h-5" />
            </button>
            
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="btn-secondary px-4"
            >
              <Filter className="w-5 h-5" />
            </button>
            
            <button
              type="button"
              onClick={() => setDebugMode(!debugMode)}
              className={`px-4 ${debugMode ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300' : 'btn-secondary'}`}
              title="Modo Debug - Muestra datos raw del scraper"
            >
              <Info className="w-5 h-5" />
            </button>
            
            <button
              type="submit"
              disabled={searchMutation.isLoading}
              className="btn-primary px-8"
            >
              {searchMutation.isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="loading-spinner w-5 h-5" />
                  {searchParams.useApify ? (
                    <span className="text-sm">💎 Apify Pro...</span>
                  ) : (
                    <span className="text-sm">Buscando...</span>
                  )}
                </div>
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

          {/* Saved Searches */}
          {showSavedSearches && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-primary-400">
                  💾 Búsquedas Guardadas en Memoria:
                </label>
                <span className="text-xs text-gray-400">
                  Carga sin costo de Apify
                </span>
              </div>
              
              {isLoadingSavedSearches ? (
                <div className="flex items-center justify-center py-8">
                  <div className="loading-spinner w-6 h-6" />
                  <span className="ml-2 text-gray-400">Cargando búsquedas...</span>
                </div>
              ) : savedSearchesData?.searches && savedSearchesData.searches.length > 0 ? (
                <div className="grid gap-3 max-h-64 overflow-y-auto">
                  {savedSearchesData.searches.map((search) => (
                    <div
                      key={search._id}
                      className="flex items-center justify-between p-3 rounded-lg bg-dark-800/50 border border-primary-500/20 hover:border-primary-400/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-white truncate">
                            {search.searchName}
                          </h4>
                          {search.isRecent && (
                            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded-full">
                              Reciente
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <Database className="w-3 h-3" />
                            {search.totalResults} anuncios
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {search.metadata.country}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(search.executedAt).toLocaleDateString('es-ES')}
                          </div>
                          {search.costSavings && (
                            <div className="flex items-center gap-1 text-yellow-400">
                              <DollarSign className="w-3 h-3" />
                              Sin costo
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleLoadSavedSearch(search._id)}
                        disabled={loadSavedSearchMutation.isLoading}
                        className="btn-secondary text-xs px-3 py-2 ml-3 flex-shrink-0"
                      >
                        {loadSavedSearchMutation.isLoading ? (
                          <div className="loading-spinner w-3 h-3" />
                        ) : (
                          'Cargar'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay búsquedas guardadas</p>
                  <p className="text-xs mt-1">Las búsquedas con Apify se guardan automáticamente</p>
                </div>
              )}
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
                  <optgroup label="🌎 América Latina">
                    <option value="CO">🇨🇴 Colombia</option>
                    <option value="MX">🇲🇽 México</option>
                    <option value="AR">🇦🇷 Argentina</option>
                    <option value="BR">🇧🇷 Brasil</option>
                    <option value="CL">🇨🇱 Chile</option>
                    <option value="PE">🇵🇪 Perú</option>
                    <option value="VE">🇻🇪 Venezuela</option>
                    <option value="EC">🇪🇨 Ecuador</option>
                    <option value="UY">🇺🇾 Uruguay</option>
                    <option value="PY">🇵🇾 Paraguay</option>
                    <option value="BO">🇧🇴 Bolivia</option>
                    <option value="CR">🇨🇷 Costa Rica</option>
                    <option value="PA">🇵🇦 Panamá</option>
                    <option value="GT">🇬🇹 Guatemala</option>
                    <option value="DO">🇩🇴 República Dominicana</option>
                  </optgroup>
                  
                  <optgroup label="🌍 América del Norte">
                    <option value="US">🇺🇸 Estados Unidos</option>
                    <option value="CA">🇨🇦 Canadá</option>
                  </optgroup>
                  
                  <optgroup label="🌍 Europa">
                    <option value="ES">🇪🇸 España</option>
                    <option value="GB">🇬🇧 Reino Unido</option>
                    <option value="FR">🇫🇷 Francia</option>
                    <option value="DE">🇩🇪 Alemania</option>
                    <option value="IT">🇮🇹 Italia</option>
                    <option value="PT">🇵🇹 Portugal</option>
                    <option value="NL">🇳🇱 Países Bajos</option>
                    <option value="BE">🇧🇪 Bélgica</option>
                    <option value="CH">🇨🇭 Suiza</option>
                    <option value="AT">🇦🇹 Austria</option>
                    <option value="SE">🇸🇪 Suecia</option>
                    <option value="NO">🇳🇴 Noruega</option>
                    <option value="DK">🇩🇰 Dinamarca</option>
                    <option value="FI">🇫🇮 Finlandia</option>
                  </optgroup>
                  
                  <optgroup label="🌏 Asia-Pacífico">
                    <option value="AU">🇦🇺 Australia</option>
                    <option value="NZ">🇳🇿 Nueva Zelanda</option>
                    <option value="JP">🇯🇵 Japón</option>
                    <option value="KR">🇰🇷 Corea del Sur</option>
                    <option value="SG">🇸🇬 Singapur</option>
                    <option value="HK">🇭🇰 Hong Kong</option>
                    <option value="MY">🇲🇾 Malasia</option>
                    <option value="TH">🇹🇭 Tailandia</option>
                    <option value="PH">🇵🇭 Filipinas</option>
                    <option value="IN">🇮🇳 India</option>
                  </optgroup>
                  
                  <optgroup label="🌍 Otros">
                    <option value="ZA">🇿🇦 Sudáfrica</option>
                    <option value="EG">🇪🇬 Egipto</option>
                    <option value="NG">🇳🇬 Nigeria</option>
                    <option value="IL">🇮🇱 Israel</option>
                    <option value="TR">🇹🇷 Turquía</option>
                    <option value="AE">🇦🇪 Emiratos Árabes Unidos</option>
                  </optgroup>
                </select>
              </div>

              {/* Languages */}
              <div>
                <label className="block text-sm font-medium text-primary-400 mb-2">
                  Idiomas
                </label>
                <select
                  multiple
                  value={searchParams.languages || []}
                  onChange={(e) => {
                    const selectedLanguages = Array.from(e.target.selectedOptions, option => option.value);
                    setSearchParams(prev => ({ ...prev, languages: selectedLanguages }));
                  }}
                  className="form-select w-full h-32"
                  size={6}
                >
                  <optgroup label="🌎 Idiomas Principales">
                    <option value="es">🇪🇸 Español</option>
                    <option value="en">🇺🇸 Inglés</option>
                    <option value="pt">🇧🇷 Portugués</option>
                    <option value="fr">🇫🇷 Francés</option>
                    <option value="de">🇩🇪 Alemán</option>
                    <option value="it">🇮🇹 Italiano</option>
                  </optgroup>
                  
                  <optgroup label="🌏 Idiomas Asiáticos">
                    <option value="zh">🇨🇳 Chino (Mandarín)</option>
                    <option value="cmn">🇨🇳 Chino Mandarín (CMN)</option>
                    <option value="yue">🇭🇰 Cantonés (YUE)</option>
                    <option value="ja">🇯🇵 Japonés</option>
                    <option value="ko">🇰🇷 Coreano</option>
                    <option value="hi">🇮🇳 Hindi</option>
                    <option value="th">🇹🇭 Tailandés</option>
                    <option value="vi">🇻🇳 Vietnamita</option>
                  </optgroup>
                  
                  <optgroup label="🌍 Otros Idiomas">
                    <option value="ar">🇸🇦 Árabe</option>
                    <option value="ru">🇷🇺 Ruso</option>
                    <option value="nl">🇳🇱 Holandés</option>
                    <option value="sv">🇸🇪 Sueco</option>
                    <option value="no">🇳🇴 Noruego</option>
                    <option value="da">🇩🇰 Danés</option>
                    <option value="fi">🇫🇮 Finlandés</option>
                    <option value="pl">🇵🇱 Polaco</option>
                    <option value="tr">🇹🇷 Turco</option>
                    <option value="he">🇮🇱 Hebreo</option>
                  </optgroup>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Mantén presionado Ctrl (Cmd en Mac) para seleccionar múltiples idiomas
                </p>
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
                  <div>
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
                      id="searchMethod-api"
                    />
                    <label htmlFor="searchMethod-api" className="search-method-label">
                      <div className="text-center">
                        <div className="text-sm font-medium">🚀 API</div>
                        <div className="text-xs text-gray-400">Rápido y Oficial</div>
                      </div>
                    </label>
                  </div>
                  
                  <div>
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
                      id="searchMethod-scraping"
                    />
                    <label htmlFor="searchMethod-scraping" className="search-method-label">
                      <div className="text-center">
                        <div className="text-sm font-medium">🕷️ Inteligente</div>
                        <div className="text-xs text-gray-400">Múltiples Variaciones</div>
                      </div>
                    </label>
                  </div>
                  
                  <div>
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
                      id="searchMethod-apify"
                    />
                    <label htmlFor="searchMethod-apify" className="search-method-label">
                      <div className="text-center">
                        <div className="text-sm font-medium">💎 Apify Pro</div>
                        <div className="text-xs text-gray-400">Profesional</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Apify Count */}
              {searchParams.useApify && (
                <div>
                  <label className="block text-sm font-medium text-primary-400 mb-2">
                    Máx Anuncios (Apify)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={searchParams.apifyCount}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, apifyCount: parseInt(e.target.value) || 100 }))}
                    placeholder="Ej: 100"
                    className="form-input w-full"
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    💡 Mínimo 10 anuncios (Apify requiere 10+) - Recomendado: 50-200
                  </div>
                  <div className="text-xs text-yellow-400 mt-1">
                    ⏰ Tiempo estimado: 10-15 minutos para 100+ anuncios
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Apify Search Progress - Show during search regardless of results */}
      {searchMutation.isLoading && searchParams.useApify && (
        <div className="holographic-panel p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-yellow-500/20 border border-yellow-500/50 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-yellow-300">
                  💎 Ejecutando Búsqueda Apify Pro
                </h3>
                <p className="text-sm text-gray-400">
                  Procesando hasta {searchParams.apifyCount || 100} anuncios... Esto puede tomar 10-15 minutos.
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-yellow-300 font-medium">
                Tiempo transcurrido: {elapsedTime || '0:00'}
              </div>
              <div className="text-xs text-gray-400">
                No cierres esta ventana
              </div>
            </div>
          </div>
          
          <div className="mt-4 bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>Procesando con Apify Professional</span>
              <span>Timeout: 15 minutos</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-yellow-500 to-yellow-400 h-2 rounded-full transition-all duration-1000" 
                style={{ 
                  width: searchStartTime ? `${Math.min((Date.now() - searchStartTime) / (15 * 60 * 1000) * 100, 95)}%` : '10%' 
                }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-6">
          {/* Results Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-primary-300">
                Se encontraron {searchResults.length} Anuncios
              </h2>
              <div className="flex gap-2">
                <button className="btn-secondary">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </button>
                <button 
                  onClick={handleSaveAll}
                  disabled={bulkSaveMutation.isLoading || searchResults.length === 0}
                  className="btn-secondary"
                >
                  {bulkSaveMutation.isLoading ? (
                    <div className="loading-spinner w-4 h-4 mr-2" />
                  ) : (
                    <Bookmark className="w-4 h-4 mr-2" />
                  )}
                  Guardar Todo
                </button>
              </div>
            </div>

          </div>

          {/* Debug Panel */}
          {debugMode && debugData && (
            <div className="holographic-panel p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-yellow-300 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Debug Mode - Raw Scraper Data
                </h3>
                <button
                  onClick={() => setDebugData(null)}
                  className="btn-icon text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              
              <div className="bg-gray-900/50 rounded-lg p-4 max-h-96 overflow-auto">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(debugData, null, 2)}
                </pre>
              </div>
              
              <div className="mt-3 text-xs text-gray-400">
                💡 Estos son los datos raw que devuelve el scraper. Úsalos para entender la estructura y mejorar el mapeo.
              </div>
            </div>
          )}

          {/* Sorting Controls */}
          {searchResults.length > 0 && (
            <div className="holographic-panel p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-primary-300 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  Ordenación de Resultados
                </h3>
                <div className="text-sm text-gray-400">
                  {searchResults.length} anuncios
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Primary Sort */}
                <div>
                  <label className="block text-sm font-medium text-primary-400 mb-2">
                    Ordenación Principal
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['days_running', 'advertiser_active_ads', 'collation_count', 'hotness_score'].map((field) => (
                      <button
                        key={field}
                        onClick={() => handleSortChange('primary', field)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          sortConfig.primary?.field === field
                            ? 'bg-primary-500/20 border border-primary-500/50 text-primary-300'
                            : 'bg-gray-700/50 border border-gray-600/50 text-gray-300 hover:bg-gray-600/50'
                        }`}
                      >
                        <span>{getSortLabel(field)}</span>
                        <span className="text-lg">{getSortIcon('primary', field)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Secondary Sort */}
                <div>
                  <label className="block text-sm font-medium text-primary-400 mb-2">
                    Ordenación Secundaria
                    {sortConfig.primary && (
                      <span className="text-xs text-gray-400 ml-2">(cuando los valores principales son iguales)</span>
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['days_running', 'advertiser_active_ads', 'collation_count', 'hotness_score'].map((field) => (
                      <button
                        key={field}
                        onClick={() => handleSortChange('secondary', field)}
                        disabled={!sortConfig.primary}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          !sortConfig.primary
                            ? 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
                            : sortConfig.secondary?.field === field
                            ? 'bg-secondary-500/20 border border-secondary-500/50 text-secondary-300'
                            : 'bg-gray-700/50 border border-gray-600/50 text-gray-300 hover:bg-gray-600/50'
                        }`}
                      >
                        <span>{getSortLabel(field)}</span>
                        <span className="text-lg">{getSortIcon('secondary', field)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tertiary Sort */}
                <div>
                  <label className="block text-sm font-medium text-primary-400 mb-2">
                    Ordenación Terciaria
                    {sortConfig.secondary && (
                      <span className="text-xs text-gray-400 ml-2">(cuando los valores secundarios son iguales)</span>
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['days_running', 'advertiser_active_ads', 'collation_count', 'hotness_score'].map((field) => (
                      <button
                        key={field}
                        onClick={() => handleSortChange('tertiary', field)}
                        disabled={!sortConfig.secondary}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          !sortConfig.secondary
                            ? 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
                            : sortConfig.tertiary?.field === field
                            ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-300'
                            : 'bg-gray-700/50 border border-gray-600/50 text-gray-300 hover:bg-gray-600/50'
                        }`}
                      >
                        <span>{getSortLabel(field)}</span>
                        <span className="text-lg">{getSortIcon('tertiary', field)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sort Summary */}
              {(sortConfig.primary || sortConfig.secondary || sortConfig.tertiary) && (
                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                  <div className="text-sm text-gray-300">
                    <span className="font-medium">Ordenación activa:</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {sortConfig.primary && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                        <span className="text-primary-300">
                          {getSortLabel(sortConfig.primary.field)} {sortConfig.primary.direction === 'asc' ? '(ascendente)' : '(descendente)'}
                        </span>
                      </div>
                    )}
                    {sortConfig.secondary && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 bg-secondary-500 rounded-full"></span>
                        <span className="text-secondary-300">
                          {getSortLabel(sortConfig.secondary.field)} {sortConfig.secondary.direction === 'asc' ? '(ascendente)' : '(descendente)'}
                        </span>
                      </div>
                    )}
                    {sortConfig.tertiary && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                        <span className="text-yellow-300">
                          {getSortLabel(sortConfig.tertiary.field)} {sortConfig.tertiary.direction === 'asc' ? '(ascendente)' : '(descendente)'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Grid */}
          <div className="ad-grid">
            {sortResults(searchResults).map((ad) => {
              const adInfo = getAdData(ad)
              const adData = adInfo.data
              
              
              return (
                <div key={ad.id} className="ad-card">
                  {/* Ad Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      {/* Page Profile Picture or Avatar */}
                      {adInfo.pageInfo.profilePicture ? (
                        <img 
                          src={adInfo.pageInfo.profilePicture} 
                          alt={ad.page_name}
                          className="w-10 h-10 rounded-lg object-cover mt-0.5"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center text-white font-bold mt-0.5">
                          {ad.page_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate mb-2">
                          {ad.page_name}
                        </h3>
                        
                        {/* Advertiser Stats - Below advertiser name */}
                        <div className="mb-2 space-y-1">
                          {/* Total Active Ads */}
                          {(() => {
                            const stats = advertiserStats.get(ad.page_id)
                            if (!stats || ad.page_id === 'N/A') return null

                            const isHighActivity = stats.totalActiveAds > 5
                            
                            return (
                              <div>
                                <div className="text-xs text-gray-400 mb-1">Anuncios totales activos del anunciante</div>
                                <span className={`text-sm font-bold whitespace-nowrap ${
                                  isHighActivity 
                                    ? 'text-yellow-300 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/30' 
                                    : 'text-green-300'
                                }`}>
                                  {stats.loading ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 border border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                                      <span>Obteniendo anuncios del anunciante...</span>
                                    </div>
                                  ) : (
                                      `${stats.totalActiveAds} activo${stats.totalActiveAds > 1 ? 's' : ''} en ${getCountryName(searchParams.country)}`
                                  )}
                                </span>
                              </div>
                            )
                          })()}
                          
                          {/* Advertiser Ad Count in Search */}
                          {getAdvertiserAdCount(ad.page_name) > 1 && (
                            <div>
                              <div className="text-xs text-gray-400 mb-1">Anuncios del mismo anunciante en esta búsqueda</div>
                              <span className="text-sm font-bold text-blue-300">
                                {(() => {
                                  const totalCount = getAdvertiserAdCount(ad.page_name)
                                  const additionalCount = totalCount - 1
                                  
                                  if (totalCount === 2) {
                                    return `1 más`
                                  } else {
                                    return `${additionalCount} más`
                                  }
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          {adInfo.pageInfo.categories && adInfo.pageInfo.categories.length > 0 && (
                            <span className="text-xs bg-gray-700/50 px-2 py-1 rounded">
                              {adInfo.pageInfo.categories[0]}
                            </span>
                          )}
                          {adInfo.pageInfo.likeCount && (
                            <div className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              {formatNumber(adInfo.pageInfo.likeCount)}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-bold text-primary-400 flex items-center gap-1 mt-1">
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

                  {/* Advertiser Ad Count Badge */}



                  {/* Ad Content */}
                  <div className="ad-content space-y-3">
                    {/* Facebook API Traditional Layout */}
                    {ad.source === 'facebook_api' ? (
                      <div className="facebook-api-layout space-y-3">
                        {/* Body Text */}
                        {ad.ad_creative_bodies && ad.ad_creative_bodies.length > 0 && (
                          <div className="facebook-body">
                            {(() => {
                              const bodyText = ad.ad_creative_bodies[0]
                              const isLongText = bodyText.length > 200
                              const isExpanded = expandedTexts.has(`${ad.id}_facebook_body`)
                              const shouldTruncate = isLongText && !isExpanded
                              
                              return (
                                <>
                                  <p className={`ad-body ${shouldTruncate ? 'line-clamp-3' : ''}`}>
                                    {shouldTruncate ? `${bodyText.slice(0, 200)}...` : bodyText}
                                  </p>
                                  {isLongText && (
                                    <button
                                      onClick={() => {
                                        const newSet = new Set(expandedTexts)
                                        if (isExpanded) {
                                          newSet.delete(`${ad.id}_facebook_body`)
                                        } else {
                                          newSet.add(`${ad.id}_facebook_body`)
                                        }
                                        setExpandedTexts(newSet)
                                      }}
                                      className="text-xs text-primary-400 hover:text-primary-300 mt-1 transition-colors"
                                    >
                                      {isExpanded ? 'Ver menos' : 'Ver más'}
                                    </button>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                        )}

                        {/* Multimedia Content */}
                        {(adInfo.images && adInfo.images.length > 0) && (
                          <div className="facebook-multimedia">
                            {adInfo.images[0] && (
                              <img 
                                src={adInfo.images[0].resized_image_url || adInfo.images[0].original_image_url} 
                                alt="Ad creative"
                                className="w-full h-64 object-cover rounded-lg"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            )}
                          </div>
                        )}
                        
                        {(adInfo.videos && adInfo.videos.length > 0) && (
                          <div className="facebook-multimedia">
                            {adInfo.videos[0] && (
                              <video 
                                src={adInfo.videos[0].video_hd_url || adInfo.videos[0].video_sd_url}
                                className="w-full h-64 object-cover rounded-lg"
                                controls
                                poster={adInfo.videos[0].video_preview_image_url}
                              />
                            )}
                          </div>
                        )}

                        {/* Link Card Layout */}
                        {(ad.ad_creative_link_titles || ad.ad_creative_link_descriptions || ad.ad_creative_link_captions) && (
                          <div className="facebook-link-card bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                            {/* Title and CTA Button Row */}
                            <div className="flex items-start justify-between gap-3 mb-2">
                              {/* Title (Left side) */}
                              {ad.ad_creative_link_titles && ad.ad_creative_link_titles.length > 0 && (
                                <div className="flex-1">
                                  <h4 className="text-white font-medium text-sm leading-tight">
                                    {ad.ad_creative_link_titles[0]}
                                  </h4>
                                </div>
                              )}
                              
                              {/* CTA Button (Right side) */}
                              {ad.ad_creative_link_captions && ad.ad_creative_link_captions.length > 0 && (
                                <div className="flex-shrink-0">
                                  <a
                                    href={ad.ad_creative_link_captions[0].startsWith('http') 
                                      ? ad.ad_creative_link_captions[0] 
                                      : `https://${ad.ad_creative_link_captions[0]}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors inline-block"
                                  >
                                    CTA
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* Description (Below) */}
                            {ad.ad_creative_link_descriptions && ad.ad_creative_link_descriptions.length > 0 && (
                              <div className="facebook-description">
                                {(() => {
                                  const descriptionText = ad.ad_creative_link_descriptions[0]
                                  const isLongDescription = descriptionText.length > 50
                                  const isExpanded = expandedTexts.has(`${ad.id}_facebook_description`)
                                  const shouldTruncate = isLongDescription && !isExpanded
                                  
                                  return (
                                    <>
                                      <p className={`text-sm text-gray-300 leading-relaxed ${shouldTruncate ? 'line-clamp-2' : ''}`}>
                                        {shouldTruncate ? `${descriptionText.slice(0, 150)}...` : descriptionText}
                                      </p>
                                      {isLongDescription && (
                                        <button
                                          onClick={() => {
                                            const newSet = new Set(expandedTexts)
                                            if (isExpanded) {
                                              newSet.delete(`${ad.id}_facebook_description`)
                                            } else {
                                              newSet.add(`${ad.id}_facebook_description`)
                                            }
                                            setExpandedTexts(newSet)
                                          }}
                                          className="text-xs text-primary-400 hover:text-primary-300 mt-1 transition-colors"
                                        >
                                          {isExpanded ? 'Ver menos' : 'Ver más'}
                                        </button>
                                      )}
                                    </>
                                  )
                                })()}
                              </div>
                            )}

                            {/* Link Destination (Below description) */}
                            {ad.ad_creative_link_captions && ad.ad_creative_link_captions.length > 0 && (
                              <div className="facebook-link-destination mt-2">
                                <p className="text-blue-400 text-sm font-medium">
                                  {ad.ad_creative_link_captions[0]}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Apify Pro Layout - Keep existing structure */
                      <>
                    {/* Creative Bodies */}
                    {adInfo.body && (
                      <div>
                        {(() => {
                          const isLongText = adInfo.body.length > 200
                              const isExpanded = expandedTexts.has(`${ad.id}_body`)
                          const shouldTruncate = isLongText && !isExpanded
                          
                          return (
                            <>
                                  <p className={`ad-body ${shouldTruncate ? 'line-clamp-3' : ''}`}>
                                {shouldTruncate ? `${adInfo.body.slice(0, 200)}...` : adInfo.body}
                              </p>
                              {isLongText && (
                                <button
                                  onClick={() => {
                                        const newSet = new Set(expandedTexts)
                                    if (isExpanded) {
                                      newSet.delete(`${ad.id}_body`)
                                    } else {
                                      newSet.add(`${ad.id}_body`)
                                    }
                                        setExpandedTexts(newSet)
                                  }}
                                  className="text-xs text-primary-400 hover:text-primary-300 mt-1 transition-colors"
                                >
                                  {isExpanded ? 'Ver menos' : 'Ver más'}
                                </button>
                              )}
                            </>
                          )
                        })()}
                      </div>
                        )}
                      </>
                    )}

                    {/* Collation Count Badge - Near images to show duplicates */}
                    {ad.collation_count > 1 && (
                      <div className="flex justify-start mb-2">
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-full px-3 py-1.5">
                          <MessageCircle className="w-3 h-3 text-orange-400" />
                          <span className="text-xs font-medium text-orange-300">
                            {ad.collation_count} variante{ad.collation_count > 1 ? 's' : ''} de este mismo anuncio
                          </span>
                          {ad.collation_count > 5 && (
                            <span className="text-xs bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full border border-red-500/30">
                              🔄
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Main Ad Content - Images Carousel */}
                    {adInfo.images && adInfo.images.length > 0 && (
                      <div className="ad-media-container">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-xs text-primary-400">
                            <Image className="w-3 h-3" />
                            <span>{adInfo.images.length} imagen(es)</span>
                          </div>
                          {adInfo.images.length > 1 && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <span>{getCarouselIndex(ad.id) + 1} de {adInfo.images.length}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="relative">
                          {/* Current Image */}
                          <div className="relative">
                            <SmartImage
                              src={adInfo.images[getCarouselIndex(ad.id)]?.original_image_url || adInfo.images[getCarouselIndex(ad.id)]?.resized_image_url}
                              alt={`Contenido del anuncio ${getCarouselIndex(ad.id) + 1}`}
                              fallbackSrc={adInfo.images[getCarouselIndex(ad.id)]?.resized_image_url || adInfo.images[getCarouselIndex(ad.id)]?.original_image_url}
                              preserveAspectRatio={true}
                              maxHeight="max-h-96"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                            
                            {/* Navigation Arrows */}
                            {adInfo.images.length > 1 && (
                              <>
                                <button
                                  onClick={() => prevCarouselItem(ad.id, adInfo.images.length)}
                                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => nextCarouselItem(ad.id, adInfo.images.length)}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                          
                          {/* Carousel Indicators */}
                          {adInfo.images.length > 1 && (
                            <div className="flex justify-center gap-1 mt-2">
                              {adInfo.images.map((_: any, index: number) => (
                                <button
                                  key={index}
                                  onClick={() => setCarouselIndex(ad.id, index)}
                                  className={`w-2 h-2 rounded-full transition-colors ${
                                    index === getCarouselIndex(ad.id) 
                                      ? 'bg-primary-500' 
                                      : 'bg-gray-600 hover:bg-gray-500'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Main Ad Content - Videos */}
                    {adInfo.videos && adInfo.videos.length > 0 && (
                      <div className="ad-media-container space-y-2">
                        <div className="flex items-center gap-2 text-xs text-primary-400">
                          <Video className="w-3 h-3" />
                          <span>{adInfo.videos.length} video(s)</span>
                        </div>
                        <div className="space-y-2">
                          {adInfo.videos.map((video: any, index: number) => (
                            <SmartVideo
                              key={index}
                              videoHdUrl={video.video_hd_url}
                              videoSdUrl={video.video_sd_url}
                              previewImageUrl={video.video_preview_image_url}
                              preserveAspectRatio={true}
                              maxHeight="max-h-96"
                              onError={(e) => {
                                const target = e.target as HTMLVideoElement;
                                target.style.display = 'none';
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ad Cards (Carousel) - Facebook Ad Layout */}
                    {adInfo.cards && adInfo.cards.length > 0 && (
                      <div className="ad-media-container">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-xs text-primary-400">
                            <Image className="w-3 h-3" />
                            <span>Anuncios del carrusel ({adInfo.cards.length})</span>
                            {adInfo.apifyInfo?.displayFormat && (
                              <span className="bg-primary-500/20 px-2 py-1 rounded">
                                {adInfo.apifyInfo.displayFormat}
                              </span>
                            )}
                          </div>
                          {adInfo.cards.length > 1 && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <span>{getCarouselIndex(`${ad.id}_cards`) + 1} de {adInfo.cards.length}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="relative">
                          {/* Current Card */}
                          {(() => {
                            const currentIndex = getCarouselIndex(`${ad.id}_cards`)
                            const card = adInfo.cards[currentIndex]
                            return (
                              <div className="relative">
                                <div className="bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden">
                                  {/* Card Image */}
                                  {card.resized_image_url && (
                                    <div className="relative">
                                      <SmartImage
                                        src={card.resized_image_url}
                                        alt={card.title || `Anuncio ${currentIndex + 1}`}
                                        fallbackSrc={card.original_image_url || card.resized_image_url}
                                        containerClassName="rounded-none border-none"
                                        preserveAspectRatio={true}
                                        maxHeight="max-h-64"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                        }}
                                      />
                                      {/* Platform overlay */}
                                      <div className="absolute top-2 right-2 z-10">
                                        <div className="bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                          {getPublisherPlatformIcon('FACEBOOK')}
                                          <span>Facebook</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Card Content - Facebook Ad Style */}
                                  <div className="p-3 space-y-2">
                                    {/* Card Title */}
                                    {card.title && (
                                      <h4 className="font-semibold text-white text-sm leading-tight">
                                        {card.title}
                                      </h4>
                                    )}
                                    
                                    {/* Card Body/Description */}
                                    {card.body && card.body.trim() && (
                                      <p className="text-gray-300 text-xs leading-relaxed line-clamp-2">
                                        {card.body.length > 150 ? `${card.body.slice(0, 150)}...` : card.body}
                                      </p>
                                    )}
                                    
                                    {/* CTA Button with Destination */}
                                    {card.cta_text && (
                                      <div className="pt-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1">
                                            <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors">
                                              {card.cta_text}
                                            </button>
                                          </div>
                                          <div className="text-xs text-gray-400 ml-3">
                                            {card.link_url ? (
                                              <div className="flex items-center gap-1">
                                                <ExternalLink className="w-3 h-3" />
                                                <span>Enlace externo</span>
                                              </div>
                                            ) : card.cta_type === 'MESSAGE_PAGE' ? (
                                              <div className="flex items-center gap-1">
                                                <MessageCircle className="w-3 h-3" />
                                                <span>WhatsApp</span>
                                              </div>
                                            ) : card.cta_type === 'CONTACT_US' ? (
                                              <div className="flex items-center gap-1">
                                                <MessageCircle className="w-3 h-3" />
                                                <span>Mensaje</span>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-1">
                                                <Globe className="w-3 h-3" />
                                                <span>Página</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Link URL if available */}
                                    {card.link_url && (
                                      <div className="text-xs text-blue-400 truncate">
                                        <a href={card.link_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                          {card.link_url}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Navigation Arrows */}
                                {adInfo.cards.length > 1 && (
                                  <>
                                    <button
                                      onClick={() => prevCarouselItem(`${ad.id}_cards`, adInfo.cards.length)}
                                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-20"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => nextCarouselItem(`${ad.id}_cards`, adInfo.cards.length)}
                                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-20"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            )
                          })()}
                          
                          {/* Carousel Indicators */}
                          {adInfo.cards.length > 1 && (
                            <div className="flex justify-center gap-1 mt-2">
                              {adInfo.cards.map((_: any, index: number) => (
                                <button
                                  key={index}
                                  onClick={() => setCarouselIndex(`${ad.id}_cards`, index)}
                                  className={`w-2 h-2 rounded-full transition-colors ${
                                    index === getCarouselIndex(`${ad.id}_cards`) 
                                      ? 'bg-primary-500' 
                                      : 'bg-gray-600 hover:bg-gray-500'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ad Info */}
                    <div className="ad-details">
                      <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(ad.ad_delivery_start_time)}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {searchParams.country}
                      </div>
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {getLanguagesDisplay(searchParams.languages)}
                      </div>
                      {ad.collation_count > 1 && (
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {ad.collation_count} variantes
                        </div>
                      )}
                      {adInfo.apifyInfo?.ctaText && (
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {adInfo.apifyInfo.ctaText}
                        </div>
                      )}
                    </div>

                    {/* Publisher Platforms */}
                    {adData.publisher_platform && adData.publisher_platform.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <Globe className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-400">Plataformas:</span>
                        <div className="flex gap-1">
                          {adData.publisher_platform.map((platform: string, index: number) => (
                            <span key={index} title={platform} className="text-lg">
                              {getPublisherPlatformIcon(platform)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-center pt-2 border-t border-primary-500/20">
                        <button
                        onClick={() => window.open(ad.ad_snapshot_url || adData.ad_library_url, '_blank')}
                        className="btn-secondary text-xs px-4 py-2 flex items-center gap-2"
                      >
                                                <ExternalLink className="w-3 h-3" />
                        Ir al anuncio
                        </button>
                      </div>
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
              )
            })}
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
