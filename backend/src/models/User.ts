import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'user';
  telegramId?: string;
  analysisTime?: string;
  
  // Plan and limits
  plan: {
    type: 'free' | 'pioneros' | 'tactico' | 'conquista' | 'imperio';
    name: string;
    adsLimit: number; // Monthly limit for ads fetched
    features: string[];
  };
  
  // Usage tracking
  usage: {
    currentMonth: string; // YYYY-MM format
    adsFetched: number; // Total ads fetched this month
    searchesPerformed: number; // Total searches this month
    lastResetDate: Date; // When the monthly limit was last reset
  };
  
  // Plan management
  subscription?: {
    status: 'active' | 'inactive' | 'cancelled' | 'expired';
    startDate: Date;
    endDate?: Date;
    autoRenew: boolean;
    paymentMethod?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  telegramId: {
    type: String,
    required: false
  },
  analysisTime: {
    type: String,
    required: false
  },
  
  // Plan configuration
  plan: {
          type: {
            type: String,
            enum: ['free', 'pioneros', 'tactico', 'conquista', 'imperio'],
            default: 'free'
          },
    name: {
      type: String,
      default: 'GRATIS'
    },
    adsLimit: {
      type: Number,
      default: 100 // FREE plan: 100 ads per month
    },
    features: [{
      type: String
    }]
  },
  
  // Usage tracking
  usage: {
    currentMonth: {
      type: String,
      default: () => new Date().toISOString().slice(0, 7) // YYYY-MM
    },
    adsFetched: {
      type: Number,
      default: 0
    },
    searchesPerformed: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },
  
  // Subscription management
  subscription: {
    status: {
      type: String,
      enum: ['active', 'inactive', 'cancelled', 'expired'],
      default: 'active'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      required: false
    },
    autoRenew: {
      type: Boolean,
      default: true
    },
    paymentMethod: {
      type: String,
      required: false
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ 'plan.type': 1 });
UserSchema.index({ 'usage.currentMonth': 1 });
UserSchema.index({ 'subscription.status': 1 });

// Pre-save middleware to handle monthly reset
UserSchema.pre('save', function(next) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  // If it's a new month, reset the usage counters
  if (this.usage.currentMonth !== currentMonth) {
    this.usage.currentMonth = currentMonth;
    this.usage.adsFetched = 0;
    this.usage.searchesPerformed = 0;
    this.usage.lastResetDate = new Date();
  }
  
  next();
});

// Static method to get plan configuration
UserSchema.statics.getPlanConfig = function(planType: string) {
  const plans = {
    free: {
      type: 'free',
      name: 'GRATIS',
      adsLimit: 100,
      features: ['Búsquedas básicas', 'Hasta 100 anuncios por mes', 'Soporte por email']
    },
    pioneros: {
      type: 'pioneros',
      name: 'PIONEROS',
      adsLimit: 5000,
      features: ['Búsquedas básicas', 'Hasta 5,000 anuncios por mes', 'Soporte por email', 'Historial de búsquedas']
    },
    tactico: {
      type: 'tactico',
      name: 'TACTICO',
      adsLimit: 14000,
      features: ['Búsquedas avanzadas', 'Hasta 14,000 anuncios por mes', 'Análisis de competencia', 'Exportación básica', 'Soporte prioritario']
    },
    conquista: {
      type: 'conquista',
      name: 'CONQUISTA',
      adsLimit: 35000,
      features: ['Búsquedas ilimitadas', 'Hasta 35,000 anuncios por mes', 'Análisis avanzados', 'Exportación completa', 'API básica', 'Soporte prioritario']
    },
    imperio: {
      type: 'imperio',
      name: 'IMPERIO',
      adsLimit: 90000,
      features: ['Búsquedas ilimitadas', 'Hasta 90,000 anuncios por mes', 'Análisis premium', 'Exportación completa', 'API completa', 'Integraciones personalizadas', 'Soporte dedicado', 'Consultoría estratégica']
    }
  };
  
  return plans[planType as keyof typeof plans] || plans.free;
};

export const User = mongoose.model<IUser>('User', UserSchema);
