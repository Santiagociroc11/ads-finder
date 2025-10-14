import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, CheckCircle, Clock, Lock, Eye, EyeOff, User, Bell, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAuthToken } from '../utils/auth';
import toast from 'react-hot-toast';

interface UserSettings {
  telegramId?: string;
  analysisTime?: string;
}

export const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({
    telegramId: '',
    analysisTime: '09:00'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security'>('profile');

  // Load user settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const token = getAuthToken();
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
            telegramId: data.user.telegramId || '',
            analysisTime: data.user.analysisTime || '09:00'
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
      const token = getAuthToken();
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
          telegramId: settings.telegramId || null,
          analysisTime: settings.analysisTime || '09:00'
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

  const handleTestNotification = async () => {
    setIsTesting(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/user/settings/test-notification', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('¡Notificación de prueba enviada! Revisa tu Telegram.');
      } else {
        throw new Error(data.message || 'Error al enviar notificación de prueba');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Error al enviar notificación de prueba');
    } finally {
      setIsTesting(false);
    }
  };

  const handleChangePassword = async () => {
    // Validate form
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Las contraseñas nuevas no coinciden');
      return;
    }

    setIsChangingPassword(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al cambiar contraseña');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Contraseña cambiada exitosamente');
        // Clear form
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        throw new Error(data.message || 'Error al cambiar contraseña');
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Error al cambiar contraseña');
    } finally {
      setIsChangingPassword(false);
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

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'profile', label: 'Perfil', icon: User },
                { id: 'notifications', label: 'Notificaciones', icon: Bell },
                { id: 'security', label: 'Seguridad', icon: Shield }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-400'
                        : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-dark-900 rounded-xl border border-primary-500/20 p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* User Information Section */}
              <div className="border-b border-gray-700 pb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-100">
                      Información del Perfil
                    </h2>
                    <p className="text-gray-400 text-sm">
                      Tu información personal y datos de cuenta
                    </p>
                  </div>
                </div>

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
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
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
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-500">
                      Para obtener tu ID de Telegram, envía el comando /id a @adfinderprobot
                    </p>
                    <a
                      href="https://t.me/adfinderprobot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <span>📱</span>
                      <span>Abrir @adfinderprobot</span>
                    </a>
                  </div>
                </div>

                {settings.telegramId && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-green-400 text-sm">
                        Las notificaciones de Telegram están habilitadas
                      </span>
                    </div>
                    
                    <button
                      onClick={handleTestNotification}
                      disabled={isTesting}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {isTesting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <span>📱</span>
                          <span>Enviar Notificación de Prueba</span>
                        </>
                      )}
                    </button>
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

            {/* Analysis Time Section */}
            <div className="border-b border-gray-700 pb-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-100">
                    Análisis Automático
                  </h2>
                  <p className="text-gray-400 text-sm">
                    Configura la hora para el análisis automático de anuncios en seguimiento
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="analysisTime" className="block text-sm font-medium text-gray-300 mb-2">
                    Hora de Análisis Diario
                  </label>
                  <input
                    type="time"
                    id="analysisTime"
                    name="analysisTime"
                    value={settings.analysisTime}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-dark-800 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    El sistema analizará automáticamente los anuncios activos de tu lista de seguimiento a esta hora todos los días
                  </p>
                </div>

                <div className="flex items-center space-x-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                  <span className="text-blue-400 text-sm">
                    El análisis se ejecutará todos los días a las {settings.analysisTime || '09:00'}
                  </span>
                </div>
              </div>
            </div>

            {/* Help Section */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h3 className="text-blue-400 font-medium mb-2">¿Cómo obtener tu ID de Telegram?</h3>
              <div className="mb-3">
                <a
                  href="https://t.me/adfinderprobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <span>🤖</span>
                  <span>Abrir @adfinderprobot en Telegram</span>
                </a>
              </div>
              <ol className="text-blue-300 text-sm space-y-1 list-decimal list-inside">
                <li>Envía el comando /start para comenzar</li>
                <li>Envía el comando /id para obtener tu ID</li>
                <li>Copia el ID que aparece en el mensaje</li>
                <li>Pega el ID en el campo de arriba y guarda</li>
              </ol>
            </div>

            {/* Save Button for Notifications Tab */}
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
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Password Change Section */}
              <div className="border-b border-gray-700 pb-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
                  <Lock className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-100">
                    Cambiar Contraseña
                  </h2>
                  <p className="text-gray-400 text-sm">
                    Actualiza tu contraseña para mantener tu cuenta segura
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Contraseña Actual
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      placeholder="Ingresa tu contraseña actual"
                      className="w-full px-4 py-3 pl-12 bg-dark-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nueva Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-4 py-3 pl-12 bg-dark-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Confirmar Nueva Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="Repite la nueva contraseña"
                      className="w-full px-4 py-3 pl-12 bg-dark-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Change Password Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                    className="flex items-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    {isChangingPassword ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Cambiando...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Cambiar Contraseña</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
