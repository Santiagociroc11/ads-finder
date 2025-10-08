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
  List,
  Image
} from 'lucide-react'
import { savedAdsApi } from '@/services/api'
import type { SavedAd, AdData } from '@/types/shared'
import AdMediaDisplay from '../components/AdMediaDisplay'

// Smart Image Component with fallback
const SmartImage = ({ 
  src, 
  fallbackSrc, 
  alt, 
  className = "", 
  containerClassName = "",
  onError,
  preserveAspectRatio = true,
  maxHeight = "max-h-96"
}: {
  src?: string
  fallbackSrc?: string
  alt: string
  className?: string
  containerClassName?: string
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  preserveAspectRatio?: boolean
  maxHeight?: string
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc)

  const handleLoad = () => {
    setImageLoaded(true)
  }

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (currentSrc === src && fallbackSrc && fallbackSrc !== src) {
      setCurrentSrc(fallbackSrc)
      setImageLoaded(false)
    } else {
      onError?.(e)
    }
  }

  if (!currentSrc) return null

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
  const [expandedTexts, setExpandedTexts] = useState<Set<string>>(new Set())
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({})

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


  // Carousel functions (copied from SearchPage)
  const getCarouselIndex = (adId: string) => {
    return carouselIndices[adId] || 0
  }
  
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

  // Helper function to detect data format and get appropriate data (copied from SearchPage)
  const getAdData = (ad: AdData) => {
    const adData = ad as any
    
    // Check if it's Apify format (has apify_data) - PRIORITY CHECK
    if (adData.apify_data && typeof adData.apify_data === 'object' && adData.apify_data !== null) {
      const apifyData = adData.apify_data;
      const originalItem = apifyData.original_item || {};
      const originalSnapshot = originalItem.snapshot || {};
      
      // Handle different image formats
      let processedImages = []
      if (apifyData.images && Array.isArray(apifyData.images) && apifyData.images.length > 0) {
        if (typeof apifyData.images[0] === 'string') {
          // String format - convert to objects
          processedImages = apifyData.images.map((url: string) => ({
            original_image_url: url,
            resized_image_url: url
          }))
        } else {
          // Apify format - already objects
          processedImages = apifyData.images
        }
      } else if (originalSnapshot.images && Array.isArray(originalSnapshot.images) && originalSnapshot.images.length > 0) {
        // Fallback to original snapshot images
        processedImages = originalSnapshot.images
      } else if (originalSnapshot.cards && Array.isArray(originalSnapshot.cards)) {
        // Extract images from cards (CAROUSEL format)
        processedImages = originalSnapshot.cards
          .filter((card: any) => card.original_image_url || card.resized_image_url)
          .map((card: any) => ({
            original_image_url: card.original_image_url,
            resized_image_url: card.resized_image_url,
            watermarked_resized_image_url: card.watermarked_resized_image_url
          }))
      }

      // Handle videos - check both apify_data.videos and cards
      let processedVideos = []
      if (apifyData.videos && Array.isArray(apifyData.videos) && apifyData.videos.length > 0) {
        processedVideos = apifyData.videos
      } else if (originalSnapshot.videos && Array.isArray(originalSnapshot.videos) && originalSnapshot.videos.length > 0) {
        processedVideos = originalSnapshot.videos
      } else if (originalSnapshot.cards && Array.isArray(originalSnapshot.cards)) {
        // Extract videos from cards (DCO format)
        processedVideos = originalSnapshot.cards
          .filter((card: any) => card.video_hd_url || card.video_sd_url)
          .map((card: any) => ({
            video_hd_url: card.video_hd_url,
            video_sd_url: card.video_sd_url,
            video_preview_image_url: card.video_preview_image_url,
            watermarked_video_hd_url: card.watermarked_video_hd_url,
            watermarked_video_sd_url: card.watermarked_video_sd_url
          }))
      }
      
      const result = {
        format: 'apify',
        data: adData,
        hasRichData: true,
        images: processedImages,
        videos: processedVideos,
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAds.map((savedAd: SavedAd) => {
            const ad = savedAd.adData
            const adInfo = getAdData(ad)
            
            return (
              <div key={savedAd._id} className="holographic-panel p-6 hover:bg-gray-800/50 transition-colors">
                {/* Advertiser Header - Exact copy from SearchPage */}
                <div className="flex items-start gap-3 mb-4">
                  {/* Profile Picture */}
                  {adInfo.pageInfo.profilePicture ? (
                    <img 
                      src={adInfo.pageInfo.profilePicture} 
                      alt={ad.page_name}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
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
                    
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      {adInfo.pageInfo.categories && adInfo.pageInfo.categories.length > 0 && (
                        <span className="text-xs bg-gray-700/50 px-2 py-1 rounded">
                          {adInfo.pageInfo.categories[0]}
                        </span>
                      )}
                      {adInfo.pageInfo.likeCount && (
                        <div className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {adInfo.pageInfo.likeCount.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-bold text-primary-400 flex items-center gap-1 mt-1">
                      <Calendar className="w-4 h-4" />
                      {ad.days_running} días ejecutándose
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
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

                {/* Ad Content - Exact copy from SearchPage */}
                <div className="ad-content space-y-3">
                  {/* Ad Layout */}
                  {ad.source === 'scrapecreators_api' ? (
                    <div className="facebook-api-layout space-y-3">
                      {/* Body Text - MUST come BEFORE multimedia */}
                      {ad.ad_creative_bodies && ad.ad_creative_bodies.length > 0 && (
                        <div className="facebook-body">
                          {(() => {
                            const bodyText = ad.ad_creative_bodies[0]
                            const isLongText = bodyText.length > 200
                            const isExpanded = expandedTexts.has(`${ad.id}_facebook_body`)
                            const shouldTruncate = isLongText && !isExpanded
                            
                            return (
                              <>
                                <p className={`ad-body text-sm text-gray-300 leading-relaxed ${shouldTruncate ? 'line-clamp-3' : ''}`}>
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
                          {adInfo.images.length === 1 ? (
                            // Single image
                            <div className="w-full h-64 bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
                              <img 
                                src={adInfo.images[0].resized_image_url || adInfo.images[0].original_image_url} 
                                alt="Ad creative"
                                className="max-w-full max-h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            </div>
                          ) : (
                            // Carousel for multiple images
                            <div className="ad-media-container">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-xs text-primary-400">
                                  <Image className="w-3 h-3" />
                                  <span>{adInfo.images.length} imagen(es)</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                  <span>{getCarouselIndex(ad.id) + 1} de {adInfo.images.length}</span>
                                </div>
                              </div>
                              
                              <div className="relative">
                                {/* Current Image */}
                                <div className="relative w-full h-64 bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
                                  <SmartImage
                                    src={adInfo.images[getCarouselIndex(ad.id)]?.original_image_url || adInfo.images[getCarouselIndex(ad.id)]?.resized_image_url}
                                    alt={`Contenido del anuncio ${getCarouselIndex(ad.id) + 1}`}
                                    fallbackSrc={adInfo.images[getCarouselIndex(ad.id)]?.resized_image_url || adInfo.images[getCarouselIndex(ad.id)]?.original_image_url}
                                    preserveAspectRatio={true}
                                    maxHeight="max-h-64"
                                    containerClassName="w-full h-64"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                    }}
                                  />
                                  
                                  {/* Navigation Arrows */}
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
                                </div>
                                
                                {/* Carousel Indicators */}
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
                              </div>
                            </div>
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
                        </div>
                      )}
                    </div>
                  ) : adInfo.hasRichData ? (
                    // Apify format layout
                    <div className="apify-layout space-y-3">
                      {/* Body Text - MUST come BEFORE multimedia for Apify too */}
                      {adInfo.body && (
                        <div className="apify-body">
                          <p className="text-sm text-gray-300 leading-relaxed">{adInfo.body}</p>
                        </div>
                      )}
                      
                      {/* Fallback to ad_creative_bodies if no body in apify data */}
                      {!adInfo.body && ad.ad_creative_bodies && ad.ad_creative_bodies.length > 0 && (
                        <div className="apify-body">
                          <p className="text-sm text-gray-300 leading-relaxed">{ad.ad_creative_bodies[0]}</p>
                        </div>
                      )}
                      
                      {/* Images - Smart Aspect Ratio Detection */}
                      <AdMediaDisplay
                        images={adInfo.images}
                        videos={adInfo.videos}
                        maxHeight="max-h-64"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement | HTMLVideoElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    // Simple API format
                    <div className="simple-api-layout space-y-3">
                      {ad.ad_creative_bodies && ad.ad_creative_bodies.length > 0 && (
                        <div className="api-body">
                          <p className="text-sm text-gray-300">{ad.ad_creative_bodies[0]}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Saved Info */}
                  <div className="flex items-center gap-4 text-xs text-gray-400 pt-3 border-t border-gray-700/50">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Guardado: {formatDate(savedAd.savedAt)}
                    </div>
                    {ad.hotness_score && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Hotness: {ad.hotness_score}
                      </div>
                    )}
                    {ad.collation_count && (
                      <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {ad.collation_count} ads
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
                <div className="flex gap-2 pt-4 border-t border-gray-700/50">
                  <button
                    onClick={() => {
                      if (ad.ad_snapshot_url) {
                        window.open(ad.ad_snapshot_url, '_blank');
                      }
                    }}
                    className="btn-secondary text-xs px-3 py-2 flex-1 flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver Anuncio
                  </button>
                </div>
              </div>
            )
          })}
      </div>
      )}
    </div>
  )
}
