// Copy of shared types for backend use
export interface AdData {
  id: string;
  source: 'facebook_api' | 'apify_scraping' | 'web_scraping';
  scraped?: boolean;
  
  // Basic fields
  page_name: string;
  page_id: string;
  
  // Creative content
  ad_creative_bodies: string[];
  ad_creative_link_captions: string[];
  ad_creative_link_descriptions: string[];
  ad_creative_link_titles: string[];
  
  // Dates
  ad_creation_time: string | null;
  ad_delivery_start_time: string | null;
  ad_delivery_stop_time: string | null;
  
  // URLs and platforms
  ad_snapshot_url: string;
  publisher_platforms: string[];
  languages: string[];
  
  // Metrics (for political ads)
  impressions?: {
    lower_bound: string;
    upper_bound: string;
    note?: string;
  };
  spend?: {
    lower_bound: string;
    currency: string;
    note?: string;
  };
  currency?: string;
  
  // Calculated fields
  days_running: number;
  is_long_running: boolean;
  is_indefinite: boolean;
  is_active?: boolean;
  total_active_time?: number;
  
  // Hotness scoring
  collation_count: number;
  hotness_score: number;
  flame_emoji?: string;
  
  // Save status
  isSaved?: boolean;
  savedInfo?: SavedInfo;
  
  // Apify specific data
  apify_data?: ApifyData;
}

export interface SavedInfo {
  savedAt: string;
  collection: string;
  tags: string[];
  isFavorite: boolean;
}

export interface ApifyData {
  ad_library_url?: string;
  page_profile_uri?: string;
  link_url?: string;
  images: string[];
  videos: VideoData[];
  page_profile_picture_url?: string;
  video_preview_image_url?: string;
  page_categories: string[];
  page_like_count: number;
  ig_followers: number;
  ig_username: string | null;
  page_verification: boolean;
  display_format?: string;
  cta_text?: string;
  cta_type?: string;
  reach_estimate?: string;
  contains_sensitive_content?: boolean;
  start_date_formatted?: string;
  end_date_formatted?: string;
  total_ads_from_page?: number;
  ads_count?: number;
  entity_type?: string;
  gated_type?: string;
  original_item?: any;
}

export interface VideoData {
  video_preview_image_url?: string;
  [key: string]: any;
}

export interface SearchParams {
  searchType: 'keyword' | 'page';
  value: string;
  country?: string;
  minDays?: number;
  dateFrom?: string;
  dateTo?: string;
  adType?: string;
  mediaType?: string;
  languages?: string[];
  platforms?: string[];
  searchPhraseType?: 'exact' | 'unordered';
  useWebScraping?: boolean;
  useApify?: boolean;
  apifyCount?: number;
  // New pagination parameters
  page?: number;        // Page number (1-based)
  limit?: number;       // Results per page (default: 20)
  offset?: number;      // Skip results (calculated from page)
}

export interface SearchResponse {
  data: AdData[];
  totalPages?: number;
  totalAds: number;
  paging?: {
    next?: string;
  } | null;
  // New pagination info
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalResults: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  source: string;
  message?: string;
  facebookLibraryUrl?: string;
  autoSaved?: {
    saved: boolean;
    searchName?: string;
    message: string;
  };
}

export interface SavedAd {
  _id: string;
  adData: AdData;
  tags: string[];
  notes: string;
  collection: string;
  savedAt: string;
  lastViewed: string;
  isFavorite: boolean;
  analysis: {
    hotnessScore: number;
    daysRunning: number;
    isLongRunning: boolean;
  };
}

export interface CompleteSearch {
  _id: string;
  searchName: string;
  searchParams: SearchParams;
  executedAt: string;
  source: string;
  totalResults: number;
  results: AdData[];
  metadata: {
    country: string;
    searchTerm: string;
    minDays: number;
    adType: string;
    useApify: boolean;
    apifyCount?: number;
  };
  stats: {
    avgHotnessScore: number;
    longRunningAds: number;
    topPages: string[];
  };
  lastAccessed: string;
  accessCount: number;
}

export interface CompleteSearchListItem {
  _id: string;
  searchName: string;
  searchParams: SearchParams;
  executedAt: string;
  source: string;
  totalResults: number;
  metadata: {
    country: string;
    searchTerm: string;
    minDays: number;
    adType: string;
    useApify: boolean;
    apifyCount?: number;
  };
  stats: {
    avgHotnessScore: number;
    longRunningAds: number;
    topPages: string[];
  };
  lastAccessed: string;
  accessCount: number;
  searchSummary: string;
  isRecent: boolean;
  costSavings: string;
}

export interface TrackedPage {
  _id: string;
  pageId: string;
  pageName: string;
  createdAt: string;
}

export interface AIsuggestion {
  suggestions: string[];
}

// === AUTHENTICATION TYPES ===
export interface User {
  _id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends AuthRequest {
  name: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface SearchStats {
  overview: {
    totalSearches: number;
    totalAds: number;
    avgAdsPerSearch: number;
    apifySearches: number;
    apiSearches: number;
    totalAccesses: number;
    avgHotness: number;
  };
  costSavings: {
    apifySearchesSaved: number;
    estimatedSavings: string;
    avgResultsPerApify: number;
  };
  topCountries: Array<{
    _id: string;
    count: number;
    totalAds: number;
  }>;
  topTerms: Array<{
    _id: string;
    count: number;
    totalAds: number;
  }>;
  mostAccessed: Array<{
    _id: string;
    searchName: string;
    accessCount: number;
    totalResults: number;
    source: string;
  }>;
  message: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  resultsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CompleteSearchWithPagination extends CompleteSearch {
  pagination: PaginationInfo;
}

// Enums for better type safety
export enum AdSource {
  FACEBOOK_API = 'facebook_api',
  APIFY_SCRAPING = 'apify_scraping',
  WEB_SCRAPING = 'web_scraping'
}

export enum SearchMethod {
  API = 'api',
  SCRAPING = 'scraping',
  APIFY = 'apify'
}

export enum AdType {
  ALL = 'ALL',
  POLITICAL = 'POLITICAL_AND_ISSUE_ADS',
  FINANCIAL = 'FINANCIAL_PRODUCTS_AND_SERVICES_ADS',
  EMPLOYMENT = 'EMPLOYMENT_ADS',
  HOUSING = 'HOUSING_ADS'
}

export enum MediaType {
  ALL = 'ALL',
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
  MEME = 'MEME',
  NONE = 'NONE'
}

export enum Country {
  ALL = 'ALL',
  US = 'US',
  CO = 'CO',
  BR = 'BR',
  MX = 'MX',
  AR = 'AR',
  ES = 'ES',
  // Add more as needed
}

// Additional backend-specific types
export interface AdvertiserStats {
  pageId: string;
  advertiserName: string;
  totalActiveAds: number;
  lastUpdated: string;
}

export interface AdvertiserStatsResult {
  success: boolean;
  stats?: AdvertiserStats;
  error?: string;
  executionTime: number;
}
