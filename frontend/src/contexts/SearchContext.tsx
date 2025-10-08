import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AdData, SearchParams } from '../types/shared';

interface PaginationData {
  currentPage: number;
  hasNextPage: boolean;
  totalResults: number;
  isLoadingMore: boolean;
  displayedCount: number;
}

interface SortConfig {
  primary: { field: string; direction: 'asc' | 'desc' } | null;
  secondary: { field: string; direction: 'asc' | 'desc' } | null;
  tertiary: { field: string; direction: 'asc' | 'desc' } | null;
}

interface SearchContextType {
  // Search parameters
  searchParams: SearchParams;
  setSearchParams: React.Dispatch<React.SetStateAction<SearchParams>>;
  
  // Search results
  searchResults: AdData[];
  setSearchResults: React.Dispatch<React.SetStateAction<AdData[]>>;
  allCachedResults: AdData[];
  setAllCachedResults: React.Dispatch<React.SetStateAction<AdData[]>>;
  nextCursor: string | undefined;
  setNextCursor: React.Dispatch<React.SetStateAction<string | undefined>>;
  
  // Pagination
  paginationData: PaginationData;
  setPaginationData: React.Dispatch<React.SetStateAction<PaginationData>>;
  
  // Sorting
  sortConfig: SortConfig;
  setSortConfig: React.Dispatch<React.SetStateAction<SortConfig>>;
  
  // UI state
  isAdvancedOpen: boolean;
  setIsAdvancedOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showSavedSearches: boolean;
  setShowSavedSearches: React.Dispatch<React.SetStateAction<boolean>>;
  expandedTexts: Set<string>;
  setExpandedTexts: React.Dispatch<React.SetStateAction<Set<string>>>;
  carouselIndices: Record<string, number>;
  setCarouselIndices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  
  // Search timing
  searchStartTime: number | null;
  setSearchStartTime: React.Dispatch<React.SetStateAction<number | null>>;
  elapsedTime: string;
  setElapsedTime: React.Dispatch<React.SetStateAction<string>>;
  
  // Stats and processing
  advertiserStats: Map<string, { totalActiveAds: number; loading: boolean }>;
  setAdvertiserStats: React.Dispatch<React.SetStateAction<Map<string, { totalActiveAds: number; loading: boolean }>>>;
  statsQueue: string[];
  setStatsQueue: React.Dispatch<React.SetStateAction<string[]>>;
  isProcessingStats: boolean;
  setIsProcessingStats: React.Dispatch<React.SetStateAction<boolean>>;
  processedPageIds: Set<string>;
  setProcessedPageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  totalStatsToLoad: number;
  setTotalStatsToLoad: React.Dispatch<React.SetStateAction<number>>;
  statsLoaded: number;
  setStatsLoaded: React.Dispatch<React.SetStateAction<number>>;
  
  // Debug mode
  debugMode: boolean;
  setDebugMode: React.Dispatch<React.SetStateAction<boolean>>;
  debugData: any;
  setDebugData: React.Dispatch<React.SetStateAction<any>>;
  
  // Tracking modal
  trackingModal: {
    isOpen: boolean;
    ad: AdData | null;
    activeAdsCount: number;
  };
  setTrackingModal: React.Dispatch<React.SetStateAction<{
    isOpen: boolean;
    ad: AdData | null;
    activeAdsCount: number;
  }>>;
  
  // Utility functions
  clearSearchState: () => void;
  hasActiveSearch: () => boolean;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

// Storage keys
const STORAGE_KEYS = {
  SEARCH_PARAMS: 'ads_finder_search_params',
  SEARCH_RESULTS: 'ads_finder_search_results',
  ALL_CACHED_RESULTS: 'ads_finder_all_cached_results',
  NEXT_CURSOR: 'ads_finder_next_cursor',
  PAGINATION_DATA: 'ads_finder_pagination_data',
  SORT_CONFIG: 'ads_finder_sort_config',
  SEARCH_START_TIME: 'ads_finder_search_start_time',
  ELAPSED_TIME: 'ads_finder_elapsed_time',
  EXPANDED_TEXTS: 'ads_finder_expanded_texts',
  CAROUSEL_INDICES: 'ads_finder_carousel_indices',
  ADVERTISER_STATS: 'ads_finder_advertiser_stats',
  PROCESSED_PAGE_IDS: 'ads_finder_processed_page_ids',
  TOTAL_STATS_TO_LOAD: 'ads_finder_total_stats_to_load',
  STATS_LOADED: 'ads_finder_stats_loaded'
};

// Default values
const defaultSearchParams: SearchParams = {
  searchType: 'keyword',
  value: '',
  country: 'ALL',
  minDays: 1,
  adType: 'ALL',
  mediaType: 'ALL',
  searchPhraseType: 'unordered',
  languages: ['es']
};

const defaultPaginationData: PaginationData = {
  currentPage: 1,
  hasNextPage: false,
  totalResults: 0,
  isLoadingMore: false,
  displayedCount: 20
};

const defaultSortConfig: SortConfig = {
  primary: { field: 'collation_count', direction: 'desc' },
  secondary: { field: 'advertiser_active_ads', direction: 'desc' },
  tertiary: { field: 'days_running', direction: 'desc' }
};

const defaultTrackingModal = {
  isOpen: false,
  ad: null,
  activeAdsCount: 0
};

// Storage utilities
const saveToStorage = (key: string, value: any) => {
  try {
    if (value instanceof Set) {
      localStorage.setItem(key, JSON.stringify(Array.from(value)));
    } else if (value instanceof Map) {
      localStorage.setItem(key, JSON.stringify(Array.from(value.entries())));
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error);
  }
};

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    
    const parsed = JSON.parse(item);
    
    // Handle special types
    if (key === STORAGE_KEYS.EXPANDED_TEXTS && Array.isArray(parsed)) {
      return new Set(parsed) as T;
    }
    if (key === STORAGE_KEYS.ADVERTISER_STATS && Array.isArray(parsed)) {
      return new Map(parsed) as T;
    }
    if (key === STORAGE_KEYS.PROCESSED_PAGE_IDS && Array.isArray(parsed)) {
      return new Set(parsed) as T;
    }
    
    return parsed;
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
};

interface SearchProviderProps {
  children: ReactNode;
}

export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
  // Load initial state from localStorage
  const [searchParams, setSearchParams] = useState<SearchParams>(() => 
    loadFromStorage(STORAGE_KEYS.SEARCH_PARAMS, defaultSearchParams)
  );
  const [searchResults, setSearchResults] = useState<AdData[]>(() => 
    loadFromStorage(STORAGE_KEYS.SEARCH_RESULTS, [])
  );
  const [allCachedResults, setAllCachedResults] = useState<AdData[]>(() => 
    loadFromStorage(STORAGE_KEYS.ALL_CACHED_RESULTS, [])
  );
  const [nextCursor, setNextCursor] = useState<string | undefined>(() => 
    loadFromStorage(STORAGE_KEYS.NEXT_CURSOR, undefined)
  );
  const [paginationData, setPaginationData] = useState<PaginationData>(() => 
    loadFromStorage(STORAGE_KEYS.PAGINATION_DATA, defaultPaginationData)
  );
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => 
    loadFromStorage(STORAGE_KEYS.SORT_CONFIG, defaultSortConfig)
  );
  const [searchStartTime, setSearchStartTime] = useState<number | null>(() => 
    loadFromStorage(STORAGE_KEYS.SEARCH_START_TIME, null)
  );
  const [elapsedTime, setElapsedTime] = useState<string>(() => 
    loadFromStorage(STORAGE_KEYS.ELAPSED_TIME, '')
  );
  const [expandedTexts, setExpandedTexts] = useState<Set<string>>(() => 
    loadFromStorage(STORAGE_KEYS.EXPANDED_TEXTS, new Set())
  );
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>(() => 
    loadFromStorage(STORAGE_KEYS.CAROUSEL_INDICES, {})
  );
  const [advertiserStats, setAdvertiserStats] = useState<Map<string, { totalActiveAds: number; loading: boolean }>>(() => 
    loadFromStorage(STORAGE_KEYS.ADVERTISER_STATS, new Map())
  );
  const [processedPageIds, setProcessedPageIds] = useState<Set<string>>(() => 
    loadFromStorage(STORAGE_KEYS.PROCESSED_PAGE_IDS, new Set())
  );
  const [totalStatsToLoad, setTotalStatsToLoad] = useState<number>(() => 
    loadFromStorage(STORAGE_KEYS.TOTAL_STATS_TO_LOAD, 0)
  );
  const [statsLoaded, setStatsLoaded] = useState<number>(() => 
    loadFromStorage(STORAGE_KEYS.STATS_LOADED, 0)
  );

  // Non-persistent state (UI only)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [trackingModal, setTrackingModal] = useState(defaultTrackingModal);
  const [statsQueue, setStatsQueue] = useState<string[]>([]);
  const [isProcessingStats, setIsProcessingStats] = useState(false);

  // Save to localStorage whenever state changes
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SEARCH_PARAMS, searchParams);
  }, [searchParams]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SEARCH_RESULTS, searchResults);
  }, [searchResults]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ALL_CACHED_RESULTS, allCachedResults);
  }, [allCachedResults]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.NEXT_CURSOR, nextCursor);
  }, [nextCursor]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PAGINATION_DATA, paginationData);
  }, [paginationData]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SORT_CONFIG, sortConfig);
  }, [sortConfig]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SEARCH_START_TIME, searchStartTime);
  }, [searchStartTime]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ELAPSED_TIME, elapsedTime);
  }, [elapsedTime]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.EXPANDED_TEXTS, expandedTexts);
  }, [expandedTexts]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CAROUSEL_INDICES, carouselIndices);
  }, [carouselIndices]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ADVERTISER_STATS, advertiserStats);
  }, [advertiserStats]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PROCESSED_PAGE_IDS, processedPageIds);
  }, [processedPageIds]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.TOTAL_STATS_TO_LOAD, totalStatsToLoad);
  }, [totalStatsToLoad]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.STATS_LOADED, statsLoaded);
  }, [statsLoaded]);

  // Utility functions
  const clearSearchState = () => {
    setSearchResults([]);
    setAllCachedResults([]);
    setNextCursor(undefined);
    setPaginationData(defaultPaginationData);
    setSortConfig(defaultSortConfig);
    setSearchStartTime(null);
    setElapsedTime('');
    setExpandedTexts(new Set());
    setCarouselIndices({});
    setAdvertiserStats(new Map());
    setProcessedPageIds(new Set());
    setTotalStatsToLoad(0);
    setStatsLoaded(0);
    setStatsQueue([]);
    setIsProcessingStats(false);
    setDebugData(null);
    
    // Clear localStorage
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  };

  const hasActiveSearch = () => {
    return searchResults.length > 0 || searchParams.value.trim() !== '';
  };

  const value: SearchContextType = {
    // Search parameters
    searchParams,
    setSearchParams,
    
    // Search results
    searchResults,
    setSearchResults,
    allCachedResults,
    setAllCachedResults,
    nextCursor,
    setNextCursor,
    
    // Pagination
    paginationData,
    setPaginationData,
    
    // Sorting
    sortConfig,
    setSortConfig,
    
    // UI state
    isAdvancedOpen,
    setIsAdvancedOpen,
    showSavedSearches,
    setShowSavedSearches,
    expandedTexts,
    setExpandedTexts,
    carouselIndices,
    setCarouselIndices,
    
    // Search timing
    searchStartTime,
    setSearchStartTime,
    elapsedTime,
    setElapsedTime,
    
    // Stats and processing
    advertiserStats,
    setAdvertiserStats,
    statsQueue,
    setStatsQueue,
    isProcessingStats,
    setIsProcessingStats,
    processedPageIds,
    setProcessedPageIds,
    totalStatsToLoad,
    setTotalStatsToLoad,
    statsLoaded,
    setStatsLoaded,
    
    // Debug mode
    debugMode,
    setDebugMode,
    debugData,
    setDebugData,
    
    // Tracking modal
    trackingModal,
    setTrackingModal,
    
    // Utility functions
    clearSearchState,
    hasActiveSearch
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
};

// Custom hook to use search context
export const useSearch = (): SearchContextType => {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
