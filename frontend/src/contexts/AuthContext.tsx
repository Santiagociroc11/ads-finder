import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, apiUtils } from '../services/api';
import type { User, AuthRequest, RegisterRequest } from '../types/shared';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: AuthRequest) => Promise<{ success: boolean; message?: string }>;
  register: (userData: RegisterRequest) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token storage utilities
const TOKEN_KEY = 'ads_finder_token';
const USER_KEY = 'ads_finder_user';

const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const getStoredUser = (): User | null => {
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const setStoredAuth = (token: string, user: User): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    apiUtils.setAuthToken(token);
  } catch (error) {
    console.error('Failed to store auth data:', error);
  }
};

const clearStoredAuth = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    apiUtils.setAuthToken(null);
  } catch (error) {
    console.error('Failed to clear auth data:', error);
  }
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();

      if (storedToken && storedUser) {
        // Set token in axios headers
        apiUtils.setAuthToken(storedToken);
        
        try {
          // Verify token is still valid
          const response = await authApi.verifyToken(storedToken);
          
          if (response.success && response.user) {
            setUser(response.user);
            console.log('✅ Token verified successfully, user restored');
          } else {
            console.warn('⚠️ Token verification failed:', response);
            clearStoredAuth();
          }
        } catch (error: any) {
          console.error('❌ Token verification error:', error);
          
          // Check if it's a network error (server restarting)
          if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
            console.log('🔄 Server appears to be restarting, keeping token for retry...');
            // Don't clear auth data, just set user from localStorage for now
            setUser(storedUser);
          } else {
            // Real authentication error, clear stored auth
            clearStoredAuth();
          }
        }
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: AuthRequest): Promise<{ success: boolean; message?: string }> => {
    try {
      setIsLoading(true);
      
      const response = await authApi.login(credentials);
      
      if (response.success && response.token && response.user) {
        setStoredAuth(response.token, response.user);
        setUser(response.user);
        
        console.log('✅ Login successful:', response.user.email);
        
        return { success: true };
      } else {
        return { 
          success: false, 
          message: response.message || 'Login failed' 
        };
      }
    } catch (error: any) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: apiUtils.handleApiError(error)
      };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterRequest): Promise<{ success: boolean; message?: string }> => {
    try {
      console.log('🔄 [AUTH] Setting loading to true...');
      setIsLoading(true);
      
      console.log('📡 [AUTH] Calling API register...');
      const response = await authApi.register(userData);
      console.log('📥 [AUTH] API response:', response);
      
      if (response.success && response.token && response.user) {
        console.log('✅ [AUTH] Registration successful, setting user state...');
        setStoredAuth(response.token, response.user);
        setUser(response.user);
        
        console.log('✅ Registration successful:', response.user.email);
        
        return { success: true };
      } else {
        console.log('❌ [AUTH] Registration failed:', response.message);
        return { 
          success: false, 
          message: response.message || 'Registration failed' 
        };
      }
    } catch (error: any) {
      console.error('💥 [AUTH] Registration error:', error);
      const errorMessage = apiUtils.handleApiError(error);
      console.log('🔄 [AUTH] Returning error message:', errorMessage);
      return { 
        success: false, 
        message: errorMessage
      };
    } finally {
      console.log('🔄 [AUTH] Setting loading to false...');
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Call logout endpoint if user is authenticated
      if (user) {
        await authApi.logout();
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local logout even if API call fails
    }

    // Clear local state and storage
    clearStoredAuth();
    setUser(null);
    
    console.log('✅ Logout successful');
  };

  const refreshUser = async (): Promise<void> => {
    const token = getStoredToken();
    
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const response = await authApi.me();
      
      if (response.success && response.user) {
        setUser(response.user);
        // Update stored user data
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        console.log('✅ User data refreshed successfully');
      } else {
        console.warn('⚠️ Failed to refresh user, clearing auth');
        clearStoredAuth();
        setUser(null);
      }
    } catch (error: any) {
      console.error('❌ Failed to refresh user:', error);
      
      // Don't clear auth on network errors
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        console.log('🔄 Network error during refresh, keeping current session');
        // Keep current user state
      } else {
        clearStoredAuth();
        setUser(null);
      }
    }
  };

  const updateUser = (userData: User): void => {
    setUser(userData);
    // Update stored user data
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      console.log('✅ User data updated successfully');
    } catch (error) {
      console.error('Failed to update stored user data:', error);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

// Hook for checking if user is authenticated
export const useRequireAuth = (): User => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated || !user) {
    throw new Error('Authentication required');
  }
  
  return user;
};

export default AuthContext;
