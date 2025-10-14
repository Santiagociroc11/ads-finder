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
  SearchHistoryResponse,
  SearchHistoryStats,
  SearchStats,
  ApiResponse,
  AuthRequest,
  RegisterRequest,
  AuthResponse,
  User,
  TrackedAdvertiser,
  TrackedAdvertiserResponse,
  TrackedAdvertiserStats
} from '../types/shared'

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
    // First try to get the error from response data
    if (error.response?.data?.error) {
      return error.response.data.error
    }
    if (error.response?.data?.message) {
      return error.response.data.message
    }
    // Fallback to the axios error message
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
    userId?: string
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

  // Cancel pending jobs for current user
  cancelPendingJobs: async (): Promise<{
    success: boolean
    message: string
    cancelledCount: number
    remainingJobs: number
    userId: string
  }> => {
    const response = await api.post('/ads/cancel-pending', {}, {
      timeout: 500 // 500ms timeout - very fast
    })
    return response.data
  },

}

// === SEARCH HISTORY API ===
export const searchHistoryApi = {
  // Get user's search history
  getHistory: async (params?: {
    page?: number
    limit?: number
    search?: string
    country?: string
    dateFrom?: string
    dateTo?: string
  }): Promise<any> => {
    const response = await api.get('/search-history', { 
      params,
      timeout: 15000 // 15 second timeout
    })
    return response.data
  },

  // Get search statistics
  getStats: async (period?: string): Promise<any> => {
    const response = await api.get('/search-history/stats', { 
      params: period ? { period } : {},
      timeout: 20000 // 20 second timeout
    })
    return response.data
  },

  // Note: Delete functions removed for audit and limit control purposes
}

// ===== TRACKED ADVERTISERS API =====
export const trackedAdvertisersApi = {
  // Get tracked advertisers with pagination
  getTrackedAdvertisers: async (page = 1, limit = 20, active = 'true'): Promise<TrackedAdvertiserResponse> => {
    const response = await api.get('/tracked-advertisers', {
      params: { page, limit, active }
    })
    return response.data
  },

  // Get tracking statistics
  getStats: async (): Promise<{ success: boolean; data: TrackedAdvertiserStats }> => {
    const response = await api.get('/tracked-advertisers/stats')
    return response.data
  },

  // Add advertiser to tracking
  addAdvertiser: async (advertiserData: {
    pageId: string;
    pageName: string;
    pageProfileUri?: string;
    pageProfilePictureUrl?: string;
    pageLikeCount?: number;
    pageCategories?: string[];
    pageVerification?: boolean;
    productType: 'physical' | 'digital';
    notes?: string;
    initialActiveAdsCount?: number;
  }): Promise<{ success: boolean; data: TrackedAdvertiser; message: string }> => {
    const response = await api.post('/tracked-advertisers', advertiserData)
    return response.data
  },

  // Update tracked advertiser
  updateAdvertiser: async (id: string, updateData: Partial<TrackedAdvertiser>): Promise<{ success: boolean; data: TrackedAdvertiser; message: string }> => {
    const response = await api.put(`/tracked-advertisers/${id}`, updateData)
    return response.data
  },

  // Delete tracking
  deleteTracking: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/tracked-advertisers/${id}`)
    return response.data
  },

  // Update daily stats
  updateDailyStats: async (id: string, stats: {
    activeAds: number;
    newAds: number;
    totalAds: number;
    reachEstimate?: number;
    avgSpend?: number;
  }): Promise<{ 
    success: boolean; 
    data: TrackedAdvertiser; 
    message: string;
    stats?: {
      previousActiveAds: number;
      currentActiveAds: number;
      change: number;
      changePercentage: number;
    };
  }> => {
    const response = await api.post(`/tracked-advertisers/${id}/check`, stats)
    return response.data
  },

}

export default api
