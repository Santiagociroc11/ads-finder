import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Crown, 
  Zap, 
  TrendingUp, 
  BarChart3, 
  Check, 
  Star,
  AlertCircle,
  RefreshCw,
  Settings,
  Gift
} from 'lucide-react';
import { userPlansApi } from '../services/userPlansApi';
import { useAuth } from '../contexts/AuthContext';
import type { UserPlan, UserUsage } from '../types/shared';

export function UserPlansPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Fetch user usage
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['userUsage'],
    queryFn: () => userPlansApi.getUserUsage(),
    refetchInterval: 30000
  });

  // Fetch available plans
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['userPlans'],
    queryFn: () => userPlansApi.getPlans()
  });

  // Upgrade plan mutation
  const upgradeMutation = useMutation(
    (planType: 'free' | 'pioneros' | 'tactico' | 'conquista' | 'imperio') => 
      userPlansApi.upgradePlan(planType),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('userUsage');
        queryClient.invalidateQueries('user');
        setSelectedPlan(null);
      }
    }
  );

  // Reset usage mutation
  const resetUsageMutation = useMutation(
    () => userPlansApi.resetUsage(),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('userUsage');
      }
    }
  );

  const usage = usageData?.usage;
  const plans = plansData?.plans || [];

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'free': return <Gift className="w-8 h-8" />;
      case 'pioneros': return <BarChart3 className="w-8 h-8" />;
      case 'tactico': return <TrendingUp className="w-8 h-8" />;
      case 'conquista': return <Crown className="w-8 h-8" />;
      case 'imperio': return <Zap className="w-8 h-8" />;
      default: return <BarChart3 className="w-8 h-8" />;
    }
  };

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'free': return 'border-green-500 bg-green-900/20';
      case 'pioneros': return 'border-gray-600 bg-gray-800/30';
      case 'tactico': return 'border-blue-500 bg-blue-900/20';
      case 'conquista': return 'border-purple-500 bg-purple-900/20';
      case 'imperio': return 'border-yellow-500 bg-yellow-900/20';
      default: return 'border-gray-600 bg-gray-800/30';
    }
  };

  const getPlanTextColor = (planType: string) => {
    switch (planType) {
      case 'free': return 'text-green-400';
      case 'pioneros': return 'text-gray-400';
      case 'tactico': return 'text-blue-400';
      case 'conquista': return 'text-purple-400';
      case 'imperio': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const handleUpgrade = (planType: 'free' | 'pioneros' | 'tactico' | 'conquista' | 'imperio') => {
    if (user?.role !== 'admin') {
      alert('Solo los administradores pueden cambiar planes. Contacta al administrador del sistema.');
      return;
    }
    
    if (confirm(`¿Estás seguro de que quieres cambiar al plan ${planType.toUpperCase()}?`)) {
      upgradeMutation.mutate(planType);
    }
  };

  const handleResetUsage = () => {
    if (user?.role !== 'admin') {
      alert('Solo los administradores pueden resetear el uso.');
      return;
    }
    
    if (confirm('¿Estás seguro de que quieres resetear el uso mensual? Esta acción no se puede deshacer.')) {
      resetUsageMutation.mutate();
    }
  };

  if (usageLoading || plansLoading) {
    return (
      <div className="space-y-8">
        <div className="holographic-panel p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-600/20 rounded-full animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-8 w-64 bg-gray-600/20 rounded animate-pulse"></div>
              <div className="h-4 w-96 bg-gray-600/10 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-800/20 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="holographic-panel p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/50 rounded-full flex items-center justify-center">
              <Settings className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Planes y Límites</h1>
              <p className="text-gray-300">Gestiona tu plan y monitorea tu uso mensual</p>
            </div>
          </div>
          <div className="flex gap-3">
            {user?.role === 'admin' && (
              <button
                onClick={handleResetUsage}
                disabled={resetUsageMutation.isLoading}
                className="btn-secondary flex items-center gap-2"
                title="Solo administradores pueden resetear el uso"
              >
                <RefreshCw className={`w-4 h-4 ${resetUsageMutation.isLoading ? 'animate-spin' : ''}`} />
                Resetear Uso
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Current Usage */}
        <div className="space-y-6">
          <div className="holographic-panel p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Uso Actual
            </h2>
            

            {/* Usage Statistics */}
            {usage && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 border border-blue-500/50 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Anuncios Restantes</p>
                      <p className="text-xl font-bold text-white">{usage.adsRemaining.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Búsquedas Realizadas</p>
                      <p className="text-xl font-bold text-white">{usage.searchesPerformed.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Available Plans */}
        <div className="space-y-6">
          <div className="holographic-panel p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-400" />
              Planes Disponibles
            </h2>
            
            <div className="space-y-4">
              {plans.map((plan: UserPlan) => {
                const isCurrentPlan = usage?.planType === plan.type;
                const isUpgrading = selectedPlan === plan.type && upgradeMutation.isLoading;
                
                return (
                  <div
                    key={plan.type}
                    className={`relative border-2 rounded-lg p-6 transition-all duration-200 hover:scale-105 ${
                      isCurrentPlan 
                        ? `${getPlanColor(plan.type)} ring-2 ring-current` 
                        : `${getPlanColor(plan.type)} hover:border-opacity-70`
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                          <Star className="w-4 h-4" />
                          Más Popular
                        </span>
                      </div>
                    )}
                    
                    {isCurrentPlan && (
                      <div className="absolute -top-3 right-4">
                        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          Plan Actual
                        </span>
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 border-2 rounded-full flex items-center justify-center ${getPlanColor(plan.type)}`}>
                          <div className={getPlanTextColor(plan.type)}>
                            {getPlanIcon(plan.type)}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                          <p className={`text-2xl font-bold ${getPlanTextColor(plan.type)}`}>
                            ${plan.price}/mes
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300">Límite mensual:</span>
                        <span className="font-semibold text-white">{plan.adsLimit.toLocaleString()} anuncios</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      <h4 className="text-sm font-semibold text-gray-300 mb-3">Características incluidas:</h4>
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span className="text-gray-300 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleUpgrade(plan.type)}
                      disabled={isCurrentPlan || isUpgrading || user?.role !== 'admin'}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                        isCurrentPlan || user?.role !== 'admin'
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : `${getPlanColor(plan.type)} hover:bg-opacity-80 text-white border-0`
                      }`}
                      title={user?.role !== 'admin' ? 'Solo administradores pueden cambiar planes' : ''}
                    >
                      {isUpgrading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Actualizando...
                        </div>
                      ) : isCurrentPlan ? (
                        'Plan Actual'
                      ) : user?.role !== 'admin' ? (
                        'Contactar Admin'
                      ) : (
                        'Cambiar Plan'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Admin Notice */}
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-400 mb-1">Nota para Administradores</h4>
                  <p className="text-sm text-blue-300">
                    Los cambios de plan son inmediatos. Los límites se aplicarán en la siguiente búsqueda.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
