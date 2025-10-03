import mongoose, { Schema, Document } from 'mongoose';

export interface ISearchHistory extends Document {
  userId: string;
  searchParams: {
    searchType: string;
    value: string;
    country: string;
    minDays: number;
    adType: string;
    mediaType: string;
    searchPhraseType: string;
    languages: string[];
    apifyCount: number;
  };
  results: {
    totalAds: number;
    totalPages: number;
    source: string;
    executionTime: number;
    cached: boolean;
    // Cache data for instant loading
    adsData?: any[]; // Store the actual ads data
    paginationData?: {
      currentPage: number;
      hasNextPage: boolean;
      totalResults: number;
      cursor?: string;
    };
    advertiserStats?: Map<string, any>; // Store advertiser stats
  };
  searchDate: Date;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

const SearchHistorySchema = new Schema<ISearchHistory>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  searchParams: {
    searchType: { type: String, required: true },
    value: { type: String, required: true },
    country: { type: String, required: true },
    minDays: { type: Number, required: true },
    adType: { type: String, required: true },
    mediaType: { type: String, required: true },
    searchPhraseType: { type: String, required: true },
    languages: [{ type: String }],
    apifyCount: { type: Number, required: true }
  },
  results: {
    totalAds: { type: Number, required: true },
    totalPages: { type: Number, required: true },
    source: { type: String, required: true },
    executionTime: { type: Number, required: true },
    cached: { type: Boolean, default: false },
    // Cache data for instant loading
    adsData: [{ type: Schema.Types.Mixed }], // Store the actual ads data
    paginationData: {
      currentPage: { type: Number, default: 1 },
      hasNextPage: { type: Boolean, default: false },
      totalResults: { type: Number, default: 0 },
      cursor: { type: String, default: null }
    },
    advertiserStats: { type: Schema.Types.Mixed, default: {} } // Store advertiser stats as object
  },
  searchDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  ipAddress: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false
  },
  sessionId: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
SearchHistorySchema.index({ userId: 1, searchDate: -1 });
SearchHistorySchema.index({ 'searchParams.value': 'text' });
SearchHistorySchema.index({ 'searchParams.country': 1 });
SearchHistorySchema.index({ searchDate: -1 });

export const SearchHistory = mongoose.model<ISearchHistory>('SearchHistory', SearchHistorySchema);
