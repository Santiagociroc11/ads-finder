import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { BarChart3, TrendingUp, AlertCircle, Crown, Zap, Gift, ArrowRight } from 'lucide-react';
import { userPlansApi } from '../services/userPlansApi';
import type { UserUsage } from '../types/shared';

interface UsageCounterProps {
  className?: string;
  showDetails?: boolean;
}

export function UsageCounter({ className = '', showDetails = false }: UsageCounterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: usageData, isLoading, error } = useQuery({
    queryKey: ['userUsage'],
    queryFn: () => userPlansApi.getUserUsage(),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    retry: 2
  });

  const usage = usageData?.usage;

  if (isLoading) {
    return (
      <div className={`bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-600/20 rounded-full animate-pulse"></div>
          <div className="space-y-1 flex-1">
            <div className="h-3 bg-gray-600/20 rounded animate-pulse"></div>
            <div className="h-2 bg-gray-600/10 rounded animate-pulse w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className={`bg-red-900/20 border border-red-500/30 rounded-lg p-3 ${className}`}>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-red-400 font-medium text-sm">Error al cargar uso</p>
            <p className="text-red-300 text-xs">No se pudo obtener la información</p>
          </div>
        </div>
      </div>
    );
  }

  const usagePercentage = (usage.adsFetched / usage.monthlyLimit) * 100;
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = usagePercentage >= 100;

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'free': return <Gift className="w-5 h-5" />;
      case 'pioneros': return <BarChart3 className="w-5 h-5" />;
      case 'tactico': return <TrendingUp className="w-5 h-5" />;
      case 'conquista': return <Crown className="w-5 h-5" />;
      case 'imperio': return <Zap className="w-5 h-5" />;
      default: return <BarChart3 className="w-5 h-5" />;
    }
  };

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'free': return 'text-green-400';
      case 'pioneros': return 'text-gray-400';
      case 'tactico': return 'text-blue-400';
      case 'conquista': return 'text-purple-400';
      case 'imperio': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getProgressColor = () => {
    if (isAtLimit) return 'bg-red-500';
    if (isNearLimit) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className={`bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 hover:bg-gray-800/70 transition-colors ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 bg-gray-700/50 border border-gray-600/50 rounded-full flex items-center justify-center ${getPlanColor(usage.planType)}`}>
            {getPlanIcon(usage.planType)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">{usage.planName}</h3>
              {isAtLimit && (
                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                  Límite
                </span>
              )}
              {isNearLimit && !isAtLimit && (
                <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                  Cerca
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {usage.adsFetched.toLocaleString()} / {usage.monthlyLimit.toLocaleString()} anuncios
            </p>
          </div>
        </div>
        
        {showDetails && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Uso mensual</span>
          <span>{usagePercentage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-700/50 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Ver Planes Button */}
      <Link 
        to="/user-plans" 
        className="mt-3 flex items-center justify-center gap-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-md py-1.5 px-2 transition-colors"
      >
        <Crown className="w-3 h-3" />
        Ver Planes
        <ArrowRight className="w-3 h-3" />
      </Link>

      {/* Expanded details */}
      {isExpanded && showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Anuncios restantes</p>
              <p className="font-semibold text-white">{usage.adsRemaining.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400">Búsquedas realizadas</p>
              <p className="font-semibold text-white">{usage.searchesPerformed.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            <p>Próximo reset: {new Date(usage.resetDate).toLocaleDateString('es-ES', { 
              month: 'long', 
              year: 'numeric' 
            })}</p>
          </div>
        </div>
      )}
    </div>
  );
}
