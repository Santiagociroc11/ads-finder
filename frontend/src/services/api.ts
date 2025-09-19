import axios, { AxiosResponse } from 'axios'
import type {
  SearchParams,
  SearchResponse,
  SavedAd,
  CompleteSearch,
  CompleteSearchListItem,
  CompleteSearchWithPagination,
  TrackedPage,
  AIsuggestion,
  SearchStats,
  ApiResponse,
  AuthRequest,
  RegisterRequest,
  AuthResponse,
  User
} from '@shared/types'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 900000, // 15 minutes timeout for very long-running Apify searches
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('❌ Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for logging and error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`)
    return response
  },
  (error) => {
    const method = error.config?.method?.toUpperCase() || 'UNKNOWN'
    const url = error.config?.url || 'unknown'
    const status = error.response?.status || 'Network Error'
    
    console.error(`❌ Response Error: ${method} ${url} - ${status}`)
    
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      console.warn('🔐 Unauthorized request - token may be invalid')
    }
    
    // Handle network errors (server restart, etc.)
    if (!error.response && (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED')) {
      console.warn('🔄 Network error detected - server may be restarting')
    }
    
    console.error('❌ Response Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// === SEARCH API ===
export const searchApi = {
  // Main search endpoint
  search: async (params: SearchParams): Promise<SearchResponse> => {
    const response = await api.post('/search', params)
    return response.data
  },

  // Fetch multiple pages
  fetchMultiplePages: async (initialUrl: string, maxPages: number = 5): Promise<SearchResponse> => {
    const response = await api.get('/search/multiple-pages', {
      params: { initialUrl, maxPages }
    })
    return response.data
  },
}

// === SAVED ADS API ===
export const savedAdsApi = {
  // Get saved ads with filters
  getSavedAds: async (params?: {
    collection?: string
    tags?: string
    isFavorite?: boolean
    sortBy?: string
    limit?: number
  }) => {
    const response = await api.get('/saved-ads', { params })
    return response.data
  },

  // Save a single ad
  saveAd: async (data: {
    adData: any
    tags?: string[]
    notes?: string
    collection?: string
  }): Promise<SavedAd> => {
    const response = await api.post('/saved-ads', data)
    return response.data
  },

  // Update saved ad
  updateSavedAd: async (id: string, data: {
    tags?: string[]
    notes?: string
    collection?: string
    isFavorite?: boolean
  }): Promise<ApiResponse> => {
    const response = await api.put(`/saved-ads/${id}`, data)
    return response.data
  },

  // Delete saved ad
  deleteSavedAd: async (id: string): Promise<ApiResponse> => {
    const response = await api.delete(`/saved-ads/${id}`)
    return response.data
  },

  // Get available collections
  getCollections: async () => {
    const response = await api.get('/saved-ads/collections')
    return response.data
  },

  // Get available tags
  getTags: async () => {
    const response = await api.get('/saved-ads/tags')
    return response.data
  },

  // Bulk save ads
  bulkSaveAds: async (data: {
    ads: any[]
    defaultTags?: string[]
    defaultCollection?: string
    defaultNotes?: string
  }) => {
    const response = await api.post('/saved-ads/bulk', data)
    return response.data
  },
}

// === COMPLETE SEARCHES API ===
export const completeSearchesApi = {
  // Get all complete searches
  getCompleteSearches: async (params?: {
    sortBy?: string
    limit?: number
  }): Promise<{
    searches: CompleteSearchListItem[]
    stats: any
  }> => {
    const response = await api.get('/complete-searches', { params })
    return response.data
  },

  // Get specific complete search with pagination
  getCompleteSearch: async (
    id: string,
    params?: { page?: number; limit?: number }
  ): Promise<CompleteSearchWithPagination> => {
    const response = await api.get(`/complete-searches/${id}`, { params })
    return response.data
  },

  // Save complete search
  saveCompleteSearch: async (data: {
    searchName: string
    searchParams: any
    results: any[]
    source: string
    metadata?: any
  }): Promise<CompleteSearch> => {
    const response = await api.post('/complete-searches', data)
    return response.data
  },

  // Delete complete search
  deleteCompleteSearch: async (id: string): Promise<ApiResponse> => {
    const response = await api.delete(`/complete-searches/${id}`)
    return response.data
  },

  // Search in saved searches
  searchCompleteSearches: async (params: {
    q?: string
    source?: string
    country?: string
    minResults?: number
  }) => {
    const response = await api.get('/complete-searches/search', { params })
    return response.data
  },

  // Get detailed statistics
  getStats: async (): Promise<SearchStats> => {
    const response = await api.get('/complete-searches/stats')
    return response.data
  },
}

// === TRACKED PAGES API ===
export const trackedPagesApi = {
  // Get all tracked pages
  getTrackedPages: async (): Promise<TrackedPage[]> => {
    const response = await api.get('/pages')
    return response.data
  },

  // Add tracked page
  addTrackedPage: async (pageIdentifier: string): Promise<TrackedPage> => {
    const response = await api.post('/pages', { pageIdentifier })
    return response.data
  },

  // Remove tracked page
  removeTrackedPage: async (id: string): Promise<ApiResponse> => {
    const response = await api.delete(`/pages/${id}`)
    return response.data
  },
}

// === AI SUGGESTIONS API ===
export const suggestionsApi = {
  // Generate keyword suggestions
  generateSuggestions: async (idea: string): Promise<AIsuggestion> => {
    const response = await api.post('/suggestions', { idea })
    return response.data
  },

  // Check AI service health
  checkHealth: async () => {
    const response = await api.get('/suggestions/health')
    return response.data
  },
}

// === AUTHENTICATION API ===
export const authApi = {
  // Register new user
  register: async (userData: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', userData)
    return response.data
  },

  // Login user
  login: async (credentials: AuthRequest): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', credentials)
    return response.data
  },

  // Get current user
  me: async (): Promise<{ success: boolean; user: User }> => {
    const response = await api.get('/auth/me')
    return response.data
  },

  // Verify token
  verifyToken: async (token: string): Promise<{ success: boolean; user: User }> => {
    const response = await api.post('/auth/verify', { token })
    return response.data
  },

  // Logout
  logout: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/auth/logout')
    return response.data
  }
}

// === UTILITY FUNCTIONS ===
export const apiUtils = {
  // Health check
  healthCheck: async () => {
    const response = await api.get('/health')
    return response.data
  },

  // Get proxy image
  getProxyImageUrl: (imageUrl: string): string => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
    return `${baseUrl}/proxy-image?url=${encodeURIComponent(imageUrl)}`
  },


  // Set authorization token
  setAuthToken: (token: string | null) => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete api.defaults.headers.common['Authorization']
    }
  },

  // Generic error handler
  handleApiError: (error: any): string => {
    if (error.response?.data?.message) {
      return error.response.data.message
    }
    if (error.message) {
      return error.message
    }
    return 'An unexpected error occurred'
  }
}

// === SCRAPER API ===
export const scraperApi = {
  // Scrape all ads from a specific advertiser
  scrapeAdvertiser: async (params: {
    advertiserName: string
    maxAds?: number
    country?: string
    useStealth?: boolean
  }): Promise<SearchResponse> => {
    const response = await api.post('/ads/scrape-advertiser', params)
    return response.data
  },

  // Get total active ads count for a page by pageId
  getAdvertiserStats: async (params: {
    pageId: string
    country?: string
  }): Promise<{
    success: boolean
    pageId: string
    advertiserName?: string
    totalActiveAds: number
    lastUpdated?: string
    executionTime: number
    message: string
    debug?: any
  }> => {
    const response = await api.post('/ads/advertiser-stats', params)
    return response.data
  },

}

export default api
