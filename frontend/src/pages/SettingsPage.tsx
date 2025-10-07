import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface UserSettings {
  telegramId?: string;
}

export const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({
    telegramId: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load user settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch('/api/user/settings', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to load settings');
        }

        const data = await response.json();
        if (data.success) {
          setSettings({
            telegramId: data.user.telegramId || ''
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('Error al cargar la configuración');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Validate telegram ID format if provided
      if (settings.telegramId && !/^\d+$/.test(settings.telegramId)) {
        toast.error('El ID de Telegram debe ser un número');
        return;
      }

      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          telegramId: settings.telegramId || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Configuración guardada exitosamente');
        // Update user context with new data
        if (updateUser && data.user) {
          updateUser(data.user);
        }
      } else {
        throw new Error(data.message || 'Error al guardar configuración');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Settings className="w-8 h-8 text-primary-500" />
            <h1 className="text-3xl font-bold text-gray-100">Configuración</h1>
          </div>
          <p className="text-gray-400">
            Gestiona tu configuración personal y notificaciones
          </p>
        </div>

        {/* Settings Form */}
        <div className="bg-dark-900 rounded-xl border border-primary-500/20 p-6">
          <div className="space-y-6">
            {/* Telegram Notifications Section */}
            <div className="border-b border-gray-700 pb-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
                  <span className="text-primary-500 font-semibold">📱</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-100">
                    Notificaciones de Telegram
                  </h2>
                  <p className="text-gray-400 text-sm">
                    Configura tu ID de Telegram para recibir notificaciones
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="telegramId" className="block text-sm font-medium text-gray-300 mb-2">
                    ID de Telegram
                  </label>
                  <input
                    type="text"
                    id="telegramId"
                    name="telegramId"
                    value={settings.telegramId}
                    onChange={handleInputChange}
                    placeholder="Ej: 123456789"
                    className="w-full px-4 py-3 bg-dark-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Para obtener tu ID de Telegram, envía un mensaje al bot @userinfobot
                  </p>
                </div>

                {settings.telegramId && (
                  <div className="flex items-center space-x-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-green-400 text-sm">
                      Las notificaciones de Telegram están habilitadas
                    </span>
                  </div>
                )}

                {!settings.telegramId && (
                  <div className="flex items-center space-x-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <span className="text-yellow-400 text-sm">
                      Las notificaciones de Telegram están deshabilitadas
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* User Info Section */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">
                Información de la Cuenta
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Nombre
                  </label>
                  <div className="px-4 py-3 bg-dark-800 rounded-lg text-gray-300">
                    {user?.name}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Email
                  </label>
                  <div className="px-4 py-3 bg-dark-800 rounded-lg text-gray-300">
                    {user?.email}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Rol
                  </label>
                  <div className="px-4 py-3 bg-dark-800 rounded-lg text-gray-300">
                    {user?.role === 'admin' ? 'Administrador' : 'Usuario'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Miembro desde
                  </label>
                  <div className="px-4 py-3 bg-dark-800 rounded-lg text-gray-300">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-6">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center space-x-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Configuración</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Environment Variables Info */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <h3 className="text-blue-400 font-medium mb-2">Configuración del Bot de Telegram</h3>
          <p className="text-blue-300 text-sm">
            Para habilitar las notificaciones, asegúrate de que el token del bot de Telegram esté configurado en las variables de entorno del servidor.
          </p>
          <code className="block mt-2 text-xs bg-dark-800 px-2 py-1 rounded text-gray-300">
            TELEGRAM_BOT_TOKEN=tu_token_aqui
          </code>
        </div>
      </div>
    </div>
  );
};
