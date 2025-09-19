import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'login' | 'register';

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  const handleAuthSuccess = () => {
    // Navigation will be handled by the redirect above
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🎯 Ads Finder Pro
          </h1>
          <p className="text-lg text-gray-600">
            Descubre anuncios ganadores de Facebook
          </p>
        </div>

        {/* Auth Forms */}
        <div className="w-full max-w-md">
          {mode === 'login' ? (
            <LoginForm
              onSuccess={handleAuthSuccess}
              onSwitchToRegister={() => setMode('register')}
            />
          ) : (
            <RegisterForm
              onSuccess={handleAuthSuccess}
              onSwitchToLogin={() => setMode('login')}
            />
          )}
        </div>

        {/* Features */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔍</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Búsqueda Avanzada
              </h3>
              <p className="text-gray-600 text-sm">
                Encuentra anuncios específicos con filtros potentes y búsqueda inteligente
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                IA Integrada
              </h3>
              <p className="text-gray-600 text-sm">
                Sugerencias automáticas de palabras clave con inteligencia artificial
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💾</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Guarda Favoritos
              </h3>
              <p className="text-gray-600 text-sm">
                Organiza y guarda los anuncios más prometedores para análisis posterior
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>© 2024 Ads Finder Pro. Hecho con ❤️ para marketers digitales.</p>
        </div>
      </div>
    </div>
  );
};
