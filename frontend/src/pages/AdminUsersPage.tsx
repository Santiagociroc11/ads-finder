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
  UserPlus,
  DollarSign,
  CreditCard,
  Calculator,
  Activity,
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  Check,
  AlertCircle
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
    scrapeCreatorsCreditsMonth?: number;
    scrapeCreatorsCreditsTotal?: number;
  };
  createdAt: string;
}

interface CreditsStats {
  totalCreditsThisMonth: number;
  totalCreditsAllTime: number;
  topUsersThisMonth: CreditsUsageStats[];
  topUsersAllTime: CreditsUsageStats[];
  averageCreditsPerUser: number;
  totalUsers: number;
}

interface CreditsUsageStats {
  userId: string;
  email: string;
  name: string;
  creditsMonth: number;
  creditsTotal: number;
  plan: string;
  lastUsed: Date | null;
}

interface AdminUsersResponse {
  success: boolean;
  users: AdminUser[];
  total: number;
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingUserPlan, setEditingUserPlan] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planChangeForm, setPlanChangeForm] = useState({
    userId: '',
    userName: '',
    newPlanType: 'free',
    expirationDate: ''
  });
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
  const [showCreditsStats, setShowCreditsStats] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    currentPasswordDisplay: '' // Para mostrar la contraseña actual
  });

  // Credit value constant
  const CREDIT_VALUE_USD = 0.001;

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

  // Fetch credits statistics
  const { data: creditsStatsData, isLoading: creditsStatsLoading } = useQuery({
    queryKey: ['adminCreditsStats'],
    queryFn: async (): Promise<{ success: boolean; data: CreditsStats }> => {
      const response = await apiClient.get('/admin/credits/stats');
      return response.data;
    },
    enabled: showCreditsStats
  });

  // Fetch credits usage by users
  const { data: creditsUsersData, isLoading: creditsUsersLoading } = useQuery({
    queryKey: ['adminCreditsUsers'],
    queryFn: async (): Promise<{ success: boolean; data: { users: CreditsUsageStats[] } }> => {
      const response = await apiClient.get('/admin/credits/users');
      return response.data;
    },
    enabled: showCreditsStats
  });

  // Function to fetch user password directly
  const fetchUserPassword = async (userId: string): Promise<{ success: boolean; password: string }> => {
    const response = await apiClient.get(`/admin/users/${userId}/password`);
    return response.data;
  };

  // Update user plan mutation
  const updatePlanMutation = useMutation(
    ({ userId, planType, expirationDate }: { userId: string; planType: string; expirationDate?: string }) =>
      apiClient.post('/admin/users/plan', { userId, planType, expirationDate }).then(res => res.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success('Plan actualizado exitosamente');
        setEditingUserPlan(null);
      },
      onError: (error: any) => {
        toast.error('Error al actualizar el plan');
        console.error('Update plan error:', error);
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

  // Update user mutation
  const updateUserMutation = useMutation(
    ({ userId, userData }: { userId: string; userData: any }) =>
      apiClient.put(`/admin/users/${userId}`, userData).then(res => res.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success('Usuario actualizado exitosamente');
        setShowEditModal(false);
        setEditingUser(null);
        setEditForm({
          name: '',
          email: '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
          currentPasswordDisplay: ''
        });
      },
      onError: (error: any) => {
        const message = error.response?.data?.message || 'Error al actualizar usuario';
        toast.error(message);
        console.error('Update user error:', error);
      }
    }
  );

  const users = usersData?.users || [];
  const creditsStats = creditsStatsData?.data;
  const creditsUsers = creditsUsersData?.data?.users || [];

  // Helper functions for cost calculations
  const calculateUserCost = (credits: number): number => {
    return credits * CREDIT_VALUE_USD;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

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

  const handleOpenPlanModal = (user: AdminUser) => {
    setPlanChangeForm({
      userId: user._id,
      userName: user.name,
      newPlanType: user.plan.type,
      expirationDate: ''
    });
    setShowPlanModal(true);
    setEditingUserPlan(null);
  };

  const handlePlanChange = () => {
    if (!planChangeForm.userId || !planChangeForm.newPlanType) {
      toast.error('Todos los campos son requeridos');
      return;
    }

    const updateData: any = {
      userId: planChangeForm.userId,
      planType: planChangeForm.newPlanType
    };

    // Only include expirationDate if provided
    if (planChangeForm.expirationDate) {
      updateData.expirationDate = planChangeForm.expirationDate;
    }

    updatePlanMutation.mutate(updateData, {
      onSuccess: () => {
        setShowPlanModal(false);
        setPlanChangeForm({
          userId: '',
          userName: '',
          newPlanType: 'free',
          expirationDate: ''
        });
      }
    });
  };



  const handleCreateUser = () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('Todos los campos son requeridos');
      return;
    }
    createUserMutation.mutate(newUser);
  };

  const handleEditUser = async (user: AdminUser) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      currentPasswordDisplay: ''
    });
    setShowEditModal(true);
    
    // Fetch user password directly with userId
    try {
      const result = await fetchUserPassword(user._id);
      if (result.success && result.password) {
        setEditForm(prev => ({
          ...prev,
          currentPasswordDisplay: result.password
        }));
        
        // Show success message for temporary password generation
        toast.success('🔑 Contraseña temporal generada. El usuario debe cambiarla en su próximo login.', { 
          duration: 8000,
          icon: '⚠️'
        });
      } else {
        setEditForm(prev => ({
          ...prev,
          currentPasswordDisplay: 'Error al generar contraseña'
        }));
      }
    } catch (error) {
      console.error('Error fetching user password:', error);
      setEditForm(prev => ({
        ...prev,
        currentPasswordDisplay: 'Error al generar contraseña'
      }));
      toast.error('Error al generar contraseña temporal');
    }
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;

    // Validate required fields
    if (!editForm.name || !editForm.email) {
      toast.error('Nombre y email son requeridos');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editForm.email)) {
      toast.error('Email inválido');
      return;
    }

    // If changing password, validate password fields
    if (editForm.newPassword) {
      if (!editForm.currentPassword) {
        toast.error('Contraseña actual es requerida para cambiar la contraseña');
        return;
      }
      if (editForm.newPassword !== editForm.confirmPassword) {
        toast.error('Las contraseñas nuevas no coinciden');
        return;
      }
      if (editForm.newPassword.length < 6) {
        toast.error('La nueva contraseña debe tener al menos 6 caracteres');
        return;
      }
    }

    const updateData: any = {
      name: editForm.name,
      email: editForm.email
    };

    if (editForm.newPassword) {
      updateData.currentPassword = editForm.currentPassword;
      updateData.newPassword = editForm.newPassword;
    }

    updateUserMutation.mutate({ userId: editingUser._id, userData: updateData });
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingUser(null);
    setEditForm({
      name: '',
      email: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      currentPasswordDisplay: ''
    });
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
            onClick={() => setShowCreditsStats(!showCreditsStats)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showCreditsStats 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            {showCreditsStats ? 'Ocultar Créditos' : 'Ver Créditos'}
          </button>
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

      {/* Credits Statistics Cards */}
      {showCreditsStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Credits This Month */}
          <div className="holographic-panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Créditos Este Mes</p>
                <p className="text-2xl font-bold text-white">
                  {creditsStatsLoading ? '...' : creditsStats?.totalCreditsThisMonth.toLocaleString() || 0}
                </p>
                <p className="text-sm text-green-400">
                  {formatCurrency(calculateUserCost(creditsStats?.totalCreditsThisMonth || 0))}
                </p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-full">
                <Activity className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Total Credits All Time */}
          <div className="holographic-panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Créditos Totales</p>
                <p className="text-2xl font-bold text-white">
                  {creditsStatsLoading ? '...' : creditsStats?.totalCreditsAllTime.toLocaleString() || 0}
                </p>
                <p className="text-sm text-green-400">
                  {formatCurrency(calculateUserCost(creditsStats?.totalCreditsAllTime || 0))}
                </p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-full">
                <BarChart3 className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Average Credits Per User */}
          <div className="holographic-panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Promedio por Usuario</p>
                <p className="text-2xl font-bold text-white">
                  {creditsStatsLoading ? '...' : Math.round(creditsStats?.averageCreditsPerUser || 0)}
                </p>
                <p className="text-sm text-green-400">
                  {formatCurrency(calculateUserCost(creditsStats?.averageCreditsPerUser || 0))}
                </p>
              </div>
              <div className="p-3 bg-yellow-500/20 rounded-full">
                <Calculator className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </div>

          {/* Credit Value */}
          <div className="holographic-panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Valor por Crédito</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(CREDIT_VALUE_USD)}
                </p>
                <p className="text-sm text-gray-400">USD</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-full">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>
        </div>
      )}

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
                {showCreditsStats && (
                  <>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Créditos Mes</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Créditos Total</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Costo Total</th>
                  </>
                )}
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
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getPlanColor(user.plan.type)}`}>
                        {getPlanIcon(user.plan.type)}
                        {user.plan.name}
                      </span>
                      <button
                        onClick={() => handleOpenPlanModal(user)}
                        className="text-gray-400 hover:text-white"
                        title="Cambiar plan"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
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
                  {showCreditsStats && (
                    <>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="text-white">
                            {(user.usage.scrapeCreatorsCreditsMonth || 0).toLocaleString()}
                          </div>
                          <div className="text-green-400 text-xs">
                            {formatCurrency(calculateUserCost(user.usage.scrapeCreatorsCreditsMonth || 0))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="text-white">
                            {(user.usage.scrapeCreatorsCreditsTotal || 0).toLocaleString()}
                          </div>
                          <div className="text-blue-400 text-xs">
                            Total histórico
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="text-white font-medium">
                            {formatCurrency(calculateUserCost(user.usage.scrapeCreatorsCreditsTotal || 0))}
                          </div>
                          <div className="text-gray-400 text-xs">
                            Costo acumulado
                          </div>
                        </div>
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="flex items-center gap-1 px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs rounded transition-colors"
                        title="Editar usuario"
                      >
                        <Edit className="w-3 h-3" />
                        Editar
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

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="holographic-panel p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Editar Usuario</h2>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleUpdateUser(); }} className="space-y-4">
              {/* User Info Section */}
              <div className="border-b border-gray-600 pb-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Información Personal
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                      placeholder="usuario@ejemplo.com"
                    />
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Contraseña
                </h3>
                
                {/* Current Password Display */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Contraseña Temporal Generada
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editForm.currentPasswordDisplay}
                      readOnly
                      className="w-full px-3 py-2 bg-green-900 border border-green-600 rounded-lg text-green-100 placeholder-gray-400 focus:outline-none focus:border-green-500 cursor-not-allowed font-mono"
                      placeholder="Generando contraseña..."
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-400">
                      <Eye className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xs text-yellow-400 mt-1">
                    ⚠️ Esta es una contraseña temporal. El usuario debe cambiarla en su próximo login.
                  </p>
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <h4 className="text-md font-medium text-white mb-3">
                    Cambiar Contraseña
                  </h4>
                  <p className="text-sm text-gray-400 mb-3">
                    Deja los campos de contraseña vacíos si no quieres cambiar la contraseña.
                  </p>
                  
                  <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Contraseña Actual
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={editForm.currentPassword}
                        onChange={(e) => setEditForm({ ...editForm, currentPassword: e.target.value })}
                        className="w-full px-3 py-2 pr-10 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                        placeholder="Solo si cambias la contraseña"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      value={editForm.newPassword}
                      onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Confirmar Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      value={editForm.confirmPassword}
                      onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                      placeholder="Repite la nueva contraseña"
                    />
                  </div>
                  </div>
                </div>
              </div>

              {/* User Stats Section */}
              <div className="border-t border-gray-600 pt-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Información del Usuario
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Plan Actual:</p>
                    <p className="text-white font-medium">{editingUser.plan.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Rol:</p>
                    <p className="text-white font-medium capitalize">{editingUser.role}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Anuncios Usados:</p>
                    <p className="text-white font-medium">
                      {editingUser.usage.adsFetched.toLocaleString()} / {editingUser.plan.adsLimit.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Búsquedas:</p>
                    <p className="text-white font-medium">{editingUser.usage.searchesPerformed}</p>
                  </div>
                </div>
              </div>
            </form>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={updateUserMutation.isLoading}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updateUserMutation.isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Change Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="holographic-panel p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Cambiar Plan de Usuario</h3>
              <button
                onClick={() => setShowPlanModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Usuario
                </label>
                <div className="px-3 py-2 bg-gray-700 rounded-lg text-white">
                  {planChangeForm.userName}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nuevo Plan
                </label>
                <select
                  value={planChangeForm.newPlanType}
                  onChange={(e) => setPlanChangeForm({ ...planChangeForm, newPlanType: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
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
                  Fecha de Vencimiento (Opcional)
                </label>
                <input
                  type="date"
                  value={planChangeForm.expirationDate}
                  onChange={(e) => setPlanChangeForm({ ...planChangeForm, expirationDate: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Si no se especifica, se establecerá a 1 mes desde hoy
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPlanModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePlanChange}
                disabled={updatePlanMutation.isLoading}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {updatePlanMutation.isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Actualizando...
                  </div>
                ) : (
                  'Actualizar Plan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
