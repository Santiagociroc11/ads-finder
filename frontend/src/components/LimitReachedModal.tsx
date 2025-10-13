import React from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Crown, 
  Zap, 
  TrendingUp, 
  BarChart3, 
  Check, 
  Star,
  Gift,
  X,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { userPlansApi } from '../services/userPlansApi';
import { useAuth } from '../contexts/AuthContext';
import type { UserPlan } from '../types/shared';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsage: number;
  monthlyLimit: number;
  planType: string;
}

export function LimitReachedModal({ 
  isOpen, 
  onClose, 
  currentUsage, 
  monthlyLimit, 
  planType 
}: LimitReachedModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch available plans
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['userPlans'],
    queryFn: () => userPlansApi.getPlans(),
    enabled: isOpen
  });

  // Fetch current usage data
  const { data: usageData } = useQuery({
    queryKey: ['userUsage'],
    queryFn: () => userPlansApi.getUserUsage(),
    enabled: isOpen
  });

  // Use real data if available, fallback to props
  const actualUsage = usageData?.usage || {
    adsFetched: currentUsage,
    monthlyLimit: monthlyLimit,
    planType: planType
  };

  // Upgrade plan mutation
  const upgradeMutation = useMutation(
    (newPlanType: 'free' | 'pioneros' | 'tactico' | 'conquista' | 'imperio') => 
      userPlansApi.upgradePlan(newPlanType),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('userUsage');
        queryClient.invalidateQueries('user');
        onClose();
      }
    }
  );

  const plans = plansData?.plans || [];

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'free': return <Gift className="w-6 h-6" />;
      case 'pioneros': return <BarChart3 className="w-6 h-6" />;
      case 'tactico': return <TrendingUp className="w-6 h-6" />;
      case 'conquista': return <Crown className="w-6 h-6" />;
      case 'imperio': return <Zap className="w-6 h-6" />;
      default: return <BarChart3 className="w-6 h-6" />;
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

  const handleUpgrade = (newPlanType: string) => {
    if (user?.role !== 'admin') {
      alert('Solo los administradores pueden cambiar planes. Contacta al administrador del sistema.');
      return;
    }
    
    if (confirm(`¿Estás seguro de que quieres cambiar al plan ${newPlanType.toUpperCase()}?`)) {
      upgradeMutation.mutate(newPlanType as any);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 border border-red-500/50 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Límite de Anuncios Alcanzado</h2>
              <p className="text-gray-400">Has usado {actualUsage.adsFetched} de {actualUsage.monthlyLimit} anuncios disponibles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Current Status */}
          <div className="mb-8 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-semibold text-red-400">Plan Actual: {actualUsage.planType.toUpperCase()}</h3>
            </div>
            <p className="text-gray-300">
              Has alcanzado el límite mensual de tu plan actual. Para continuar buscando anuncios, 
              considera hacer upgrade a un plan con mayor capacidad.
            </p>
          </div>

          {/* Available Plans */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              Planes Disponibles
            </h3>
            
            {plansLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-64 bg-gray-800/50 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans
                  .filter(plan => plan.type !== actualUsage.planType) // Exclude current plan
                  .map((plan) => (
                    <div 
                      key={plan.type} 
                      className={`border rounded-lg p-4 transition-all hover:scale-105 ${getPlanColor(plan.type)}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getPlanIcon(plan.type)}
                          <h4 className="text-lg font-bold text-white capitalize">{plan.name}</h4>
                        </div>
                        {plan.popular && (
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-full">
                            Popular
                          </span>
                        )}
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-2xl font-bold text-white">
                          {plan.price === 0 ? 'Gratis' : `$${plan.price.toFixed(2)}`}
                          {plan.price !== 0 && <span className="text-sm text-gray-400">/mes</span>}
                        </p>
                        <p className="text-sm text-gray-400">{plan.adsLimit.toLocaleString()} anuncios/mes</p>
                      </div>
                      
                      <div className="mb-4">
                        <ul className="space-y-1">
                          {plan.features.slice(0, 3).map((feature, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                              <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <button
                        onClick={() => handleUpgrade(plan.type)}
                        disabled={upgradeMutation.isLoading || user?.role !== 'admin'}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                          user?.role !== 'admin'
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                        title={user?.role !== 'admin' ? 'Solo administradores pueden cambiar planes' : ''}
                      >
                        {upgradeMutation.isLoading ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            {user?.role !== 'admin' ? 'Contactar Admin' : 'Actualizar Plan'}
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Additional Options */}
          <div className="border-t border-gray-700 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <h4 className="text-lg font-semibold text-blue-400 mb-2">Reset Mensual</h4>
                <p className="text-gray-300 text-sm mb-3">
                  Tu límite se resetea automáticamente el primer día de cada mes.
                </p>
                <p className="text-blue-300 text-sm font-medium">
                  Próximo reset: 1 de {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleString('es-ES', { month: 'long' })}
                </p>
              </div>
              
              <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                <h4 className="text-lg font-semibold text-purple-400 mb-2">Contactar Soporte</h4>
                <p className="text-gray-300 text-sm mb-3">
                  ¿Necesitas ayuda para elegir el plan correcto?
                </p>
                <button className="text-purple-300 text-sm font-medium hover:text-purple-200">
                  Contactar al administrador →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
