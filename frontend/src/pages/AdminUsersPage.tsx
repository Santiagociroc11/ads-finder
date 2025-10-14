import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Users, 
  Crown, 
  Zap, 
  TrendingUp, 
  BarChart3, 
  Gift,
  Edit,
  Save,
  X,
  RefreshCw,
  Search,
  Filter,
  Plus,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
import toast from 'react-hot-toast';

interface AdminUser {
  _id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  plan: {
    type: 'free' | 'pioneros' | 'tactico' | 'conquista' | 'imperio';
    name: string;
    adsLimit: number;
  };
  usage: {
    currentMonth: string;
    adsFetched: number;
    searchesPerformed: number;
  };
  createdAt: string;
}

interface AdminUsersResponse {
  success: boolean;
  users: AdminUser[];
  total: number;
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    planType: 'free' as 'free' | 'pioneros' | 'tactico' | 'conquista' | 'imperio',
    role: 'user' as 'user' | 'admin'
  });

  // Debug: Log user info
  console.log('🔍 AdminUsersPage - Current user:', user);
  console.log('🔍 AdminUsersPage - User role:', user?.role);

  // Check if current user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-red-400 mb-4">Acceso Denegado</h2>
          <p className="text-gray-300">Solo los administradores pueden acceder a esta página.</p>
          <p className="text-gray-400 text-sm mt-2">
            Tu rol actual: {user?.role || 'No definido'}
          </p>
        </div>
      </div>
    );
  }

  // Fetch all users
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async (): Promise<AdminUsersResponse> => {
      console.log('🔍 AdminUsersPage - Fetching users with apiClient...');
      const response = await apiClient.get('/admin/users');
      console.log('🔍 AdminUsersPage - Response:', response.data);
      return response.data;
    }
  });

  // Update user plan mutation
  const updatePlanMutation = useMutation(
    ({ userId, newPlanType }: { userId: string; newPlanType: string }) =>
      apiClient.post('/admin/users/plan', { userId, planType: newPlanType }).then(res => res.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success('Plan actualizado exitosamente');
        setEditingUser(null);
      },
      onError: (error: any) => {
        toast.error('Error al actualizar el plan');
        console.error('Update plan error:', error);
      }
    }
  );

  // Reset usage mutation
  const resetUsageMutation = useMutation(
    (userId: string) =>
      apiClient.post('/admin/users/reset-usage', { userId }).then(res => res.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success('Uso resetado exitosamente');
      },
      onError: (error: any) => {
        toast.error('Error al resetar el uso');
        console.error('Reset usage error:', error);
      }
    }
  );

  // Create user mutation
  const createUserMutation = useMutation(
    (userData: typeof newUser) =>
      apiClient.post('/admin/users/create', userData).then(res => res.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success('Usuario creado exitosamente');
        setShowCreateModal(false);
        setNewUser({
          name: '',
          email: '',
          password: '',
          planType: 'free',
          role: 'user'
        });
      },
      onError: (error: any) => {
        const message = error.response?.data?.message || 'Error al crear usuario';
        toast.error(message);
        console.error('Create user error:', error);
      }
    }
  );

  const users = usersData?.users || [];

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'free': return <Gift className="w-4 h-4" />;
      case 'pioneros': return <BarChart3 className="w-4 h-4" />;
      case 'tactico': return <TrendingUp className="w-4 h-4" />;
      case 'conquista': return <Crown className="w-4 h-4" />;
      case 'imperio': return <Zap className="w-4 h-4" />;
      default: return <BarChart3 className="w-4 h-4" />;
    }
  };

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'free': return 'text-green-400 bg-green-500/10';
      case 'pioneros': return 'text-gray-400 bg-gray-500/10';
      case 'tactico': return 'text-blue-400 bg-blue-500/10';
      case 'conquista': return 'text-purple-400 bg-purple-500/10';
      case 'imperio': return 'text-yellow-400 bg-yellow-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handlePlanUpdate = (userId: string, newPlanType: string) => {
    updatePlanMutation.mutate({ userId, newPlanType });
  };

  const handleResetUsage = (userId: string, userName: string) => {
    if (confirm(`¿Estás seguro de resetear el uso mensual de ${userName}?`)) {
      resetUsageMutation.mutate(userId);
    }
  };

  const handleCreateUser = () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('Todos los campos son requeridos');
      return;
    }
    createUserMutation.mutate(newUser);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary-400 text-lg flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin" />
          Cargando usuarios...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error al cargar usuarios</h2>
          <p className="text-gray-300">No se pudieron cargar los usuarios. Por favor, intenta de nuevo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Gestión de Usuarios</h1>
          <p className="text-gray-400">Administra usuarios y sus planes</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Crear Usuario
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Users className="w-5 h-5" />
            <span>{filteredUsers.length} usuarios</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="holographic-panel p-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as 'all' | 'admin' | 'user')}
              className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
            >
              <option value="all">Todos</option>
              <option value="admin">Administradores</option>
              <option value="user">Usuarios</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="holographic-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Usuario</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Plan Actual</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Uso Mensual</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Registro</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user._id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{user.name}</span>
                        {user.role === 'admin' && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {editingUser === user._id ? (
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={user.plan.type}
                          onChange={(e) => handlePlanUpdate(user._id, e.target.value)}
                          className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-primary-500"
                        >
                          <option value="free">GRATIS</option>
                          <option value="pioneros">PIONEROS</option>
                          <option value="tactico">TACTICO</option>
                          <option value="conquista">CONQUISTA</option>
                          <option value="imperio">IMPERIO</option>
                        </select>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getPlanColor(user.plan.type)}`}>
                          {getPlanIcon(user.plan.type)}
                          {user.plan.name}
                        </span>
                        <button
                          onClick={() => setEditingUser(user._id)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="text-white">
                        {user.usage.adsFetched.toLocaleString()} / {user.plan.adsLimit.toLocaleString()} anuncios
                      </div>
                      <div className="text-gray-400">
                        {user.usage.searchesPerformed} búsquedas
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResetUsage(user._id, user.name)}
                        disabled={resetUsageMutation.isLoading}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs rounded transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${resetUsageMutation.isLoading ? 'animate-spin' : ''}`} />
                        Resetear Uso
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">No se encontraron usuarios</p>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="holographic-panel p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Crear Nuevo Usuario</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                  placeholder="Nombre completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                  placeholder="usuario@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Plan
                </label>
                <select
                  value={newUser.planType}
                  onChange={(e) => setNewUser({ ...newUser, planType: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="free">GRATIS</option>
                  <option value="pioneros">PIONEROS</option>
                  <option value="tactico">TACTICO</option>
                  <option value="conquista">CONQUISTA</option>
                  <option value="imperio">IMPERIO</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rol
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUser}
                disabled={createUserMutation.isLoading}
                className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createUserMutation.isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Crear Usuario
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
