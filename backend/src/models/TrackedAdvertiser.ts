import mongoose, { Schema, Document } from 'mongoose';

export interface ITrackedAdvertiser extends Document {
  userId: string;
  pageId: string;
  pageName: string;
  pageProfileUri?: string;
  pageProfilePictureUrl?: string;
  pageLikeCount?: number;
  pageCategories?: string[];
  pageVerification?: boolean;
  productType: 'physical' | 'digital';
  notes?: string;
  isActive: boolean;
  trackingStartDate: Date;
  lastCheckedDate?: Date;
  totalAdsTracked: number;
  initialActiveAdsCount: number; // Número de anuncios activos al momento de agregar
  dailyStats: Array<{
    date: Date;
    activeAds: number;
    newAds: number;
    totalAds: number;
    reachEstimate?: number;
    avgSpend?: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const TrackedAdvertiserSchema = new Schema<ITrackedAdvertiser>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  pageId: {
    type: String,
    required: true,
    index: true
  },
  pageName: {
    type: String,
    required: true
  },
  pageProfileUri: {
    type: String
  },
  pageProfilePictureUrl: {
    type: String
  },
  pageLikeCount: {
    type: Number,
    default: 0
  },
  pageCategories: [{
    type: String
  }],
  pageVerification: {
    type: Boolean,
    default: false
  },
  productType: {
    type: String,
    enum: ['physical', 'digital'],
    required: true
  },
  notes: {
    type: String,
    maxlength: 500
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  trackingStartDate: {
    type: Date,
    default: Date.now
  },
  lastCheckedDate: {
    type: Date
  },
  totalAdsTracked: {
    type: Number,
    default: 0
  },
  initialActiveAdsCount: {
    type: Number,
    default: 0
  },
  dailyStats: [{
    date: {
      type: Date,
      required: true
    },
    activeAds: {
      type: Number,
      default: 0
    },
    newAds: {
      type: Number,
      default: 0
    },
    totalAds: {
      type: Number,
      default: 0
    },
    reachEstimate: {
      type: Number
    },
    avgSpend: {
      type: Number
    }
  }]
}, {
  timestamps: true
});

// Índices compuestos para consultas eficientes
TrackedAdvertiserSchema.index({ userId: 1, isActive: 1 });
TrackedAdvertiserSchema.index({ pageId: 1, userId: 1 }, { unique: true });
TrackedAdvertiserSchema.index({ trackingStartDate: -1 });
TrackedAdvertiserSchema.index({ 'dailyStats.date': -1 });

export const TrackedAdvertiser = mongoose.model<ITrackedAdvertiser>('TrackedAdvertiser', TrackedAdvertiserSchema);
