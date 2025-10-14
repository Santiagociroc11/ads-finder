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


  if (usageLoading || plansLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando planes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-500/20 to-secondary-500/20 border border-primary-500/30 rounded-full px-4 py-2 mb-4">
          <Crown className="w-4 h-4 text-yellow-400" />
          <span className="text-primary-200 font-semibold text-sm">Gestión de Planes</span>
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-primary-200 to-secondary-200 bg-clip-text text-transparent mb-4">
          Elige tu Plan Perfecto
        </h1>
        <p className="text-gray-300 max-w-2xl mx-auto mb-6">
          Maximiza tu potencial con nuestros planes diseñados para cada nivel de necesidad
        </p>

        {/* Admin Actions */}
      </div>

      {/* Current Usage Section */}
      <div className="holographic-panel p-6">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-2">Tu Uso Actual</h2>
          <p className="text-gray-400 text-sm">Monitorea tu actividad mensual</p>
        </div>

        {usage && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Plan Actual */}
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-lg p-4 text-center">
              <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/50 rounded-full flex items-center justify-center mx-auto mb-3">
                {getPlanIcon(usage.planType)}
              </div>
              <h3 className="text-base font-semibold text-white mb-1">{usage.planName}</h3>
              <p className="text-blue-300 text-xs">Plan Actual</p>
            </div>

            {/* Anuncios */}
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-lg p-4 text-center">
              <div className="w-12 h-12 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{usage.adsRemaining.toLocaleString()}</h3>
              <p className="text-green-300 text-xs">Anuncios Restantes</p>
            </div>

            {/* Búsquedas */}
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-lg p-4 text-center">
              <div className="w-12 h-12 bg-purple-500/20 border border-purple-500/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{usage.searchesPerformed.toLocaleString()}</h3>
              <p className="text-purple-300 text-xs">Búsquedas Realizadas</p>
            </div>
          </div>
        )}
      </div>

      {/* Available Plans Section */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-3">Planes Disponibles</h2>
        <p className="text-gray-400 text-sm">Encuentra el plan perfecto para tus necesidades</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {plans.map((plan: UserPlan) => {
          const isCurrentPlan = usage?.planType === plan.type;
          const isUpgrading = selectedPlan === plan.type && upgradeMutation.isLoading;
          
          return (
            <div
              key={plan.type}
              className={`relative holographic-panel p-4 transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                isCurrentPlan 
                  ? 'ring-2 ring-primary-500 shadow-primary-500/20' 
                  : ''
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
                    <Star className="w-3 h-3" />
                    Popular
                  </span>
                </div>
              )}
              
              {/* Current Plan Badge */}
              {isCurrentPlan && (
                <div className="absolute -top-2 right-2">
                  <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
                    <Check className="w-3 h-3" />
                    Actual
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500/20 to-secondary-500/20 border-2 border-primary-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <div className="text-primary-400">
                    {getPlanIcon(plan.type)}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-gray-400 text-xs">{plan.adsLimit.toLocaleString()} anuncios/mes</p>
              </div>

              {/* Price */}
              <div className="text-center mb-4">
                <div className="text-2xl font-bold bg-gradient-to-r from-white to-primary-200 bg-clip-text text-transparent mb-1">
                  {plan.price === 0 ? 'Gratis' : `$${plan.price.toFixed(2)}`}
                </div>
                {plan.price !== 0 && <p className="text-gray-400 text-xs">por mes</p>}
              </div>

              {/* Features */}
              <div className="mb-4">
                <ul className="space-y-1">
                  {plan.features.slice(0, 3).map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-gray-300">
                      <div className="w-4 h-4 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-2 h-2 text-green-400" />
                      </div>
                      <span className="text-xs">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              {plan.type === 'free' ? (
                <div className="w-full py-2 px-4 rounded-lg font-medium text-sm bg-gray-700/50 text-gray-500 cursor-not-allowed text-center">
                  Plan Actual
                </div>
              ) : plan.paymentLink ? (
                <a
                  href={plan.paymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all duration-300 text-center block ${
                    plan.popular
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-purple-500/25'
                      : 'bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white shadow-lg hover:shadow-primary-500/25'
                  }`}
                >
                  Comprar Ahora - ${plan.price}
                </a>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.type)}
                  disabled={isCurrentPlan || isUpgrading || user?.role !== 'admin'}
                  className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all duration-300 ${
                    isCurrentPlan || user?.role !== 'admin'
                      ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-purple-500/25'
                      : 'bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white shadow-lg hover:shadow-primary-500/25'
                  }`}
                  title={user?.role !== 'admin' ? 'Solo administradores pueden cambiar planes' : ''}
                >
                  {isUpgrading ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Actualizando...
                    </div>
                  ) : isCurrentPlan ? (
                    'Plan Actual'
                  ) : user?.role !== 'admin' ? (
                    'Contactar Admin'
                  ) : (
                    'Seleccionar'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Admin Notice */}
      {user?.role === 'admin' && (
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-3 bg-blue-500/20 border border-blue-500/30 rounded-lg px-6 py-4">
            <AlertCircle className="w-5 h-5 text-blue-400" />
            <div className="text-left">
              <h4 className="font-semibold text-blue-400 mb-1">Nota para Administradores</h4>
              <p className="text-sm text-blue-300">
                Los cambios de plan son inmediatos y se aplicarán en la siguiente búsqueda.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}