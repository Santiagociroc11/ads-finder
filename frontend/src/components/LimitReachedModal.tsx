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
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-500/20 border border-red-500/50 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Límite de Anuncios Alcanzado</h2>
              <p className="text-gray-400 text-sm">Has usado {actualUsage.adsFetched} de {actualUsage.monthlyLimit} anuncios disponibles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Current Status */}
          <div className="mb-6 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-base font-semibold text-red-400">Plan Actual: {actualUsage.planType.toUpperCase()}</h3>
            </div>
            <p className="text-gray-300 text-sm">
              Has alcanzado el límite mensual de tu plan actual. Para continuar buscando anuncios, 
              considera hacer upgrade a un plan con mayor capacidad.
            </p>
          </div>

          {/* Available Plans */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              Planes Disponibles
            </h3>
            
            {plansLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-48 bg-gray-800/50 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {plans
                  .filter(plan => plan.type !== actualUsage.planType) // Exclude current plan
                  .map((plan) => (
                    <div 
                      key={plan.type} 
                      className={`border rounded-lg p-3 transition-all hover:scale-105 ${getPlanColor(plan.type)}`}
                    >
                      <div className="text-center mb-3">
                        <div className="flex items-center justify-center mb-2">
                          {getPlanIcon(plan.type)}
                        </div>
                        <h4 className="text-base font-bold text-white capitalize">{plan.name}</h4>
                        {plan.popular && (
                          <span className="inline-block px-2 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-full mt-1">
                            Popular
                          </span>
                        )}
                      </div>
                      
                      <div className="text-center mb-3">
                        <p className="text-lg font-bold text-white">
                          {plan.price === 0 ? 'Gratis' : `$${plan.price.toFixed(2)}`}
                          {plan.price !== 0 && <span className="text-xs text-gray-400">/mes</span>}
                        </p>
                        <p className="text-xs text-gray-400">{plan.adsLimit.toLocaleString()} anuncios/mes</p>
                      </div>
                      
                      <div className="mb-3">
                        <ul className="space-y-1">
                          {plan.features.slice(0, 2).map((feature, index) => (
                            <li key={index} className="flex items-center gap-2 text-xs text-gray-300">
                              <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                              <span className="truncate">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {plan.paymentLink ? (
                        <a
                          href={plan.paymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 px-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          Comprar - ${plan.price}
                        </a>
                      ) : (
                        <button
                          onClick={() => handleUpgrade(plan.type)}
                          disabled={upgradeMutation.isLoading || user?.role !== 'admin'}
                          className={`w-full py-2 px-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-1 ${
                            user?.role !== 'admin'
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                          title={user?.role !== 'admin' ? 'Solo administradores pueden cambiar planes' : ''}
                        >
                          {upgradeMutation.isLoading ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              {user?.role !== 'admin' ? 'Contactar' : 'Actualizar'}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Additional Options */}
          <div className="border-t border-gray-700 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <h4 className="text-base font-semibold text-blue-400 mb-2">Reset Mensual</h4>
                <p className="text-gray-300 text-xs mb-2">
                  Tu límite se resetea automáticamente el primer día de cada mes.
                </p>
                <p className="text-blue-300 text-xs font-medium">
                  Próximo reset: 1 de {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleString('es-ES', { month: 'long' })}
                </p>
              </div>
              
              <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                <h4 className="text-base font-semibold text-purple-400 mb-2">Contactar Soporte</h4>
                <p className="text-gray-300 text-xs mb-2">
                  ¿Necesitas ayuda para elegir el plan correcto?
                </p>
                <button className="text-purple-300 text-xs font-medium hover:text-purple-200">
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
