import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { User } from '../types/shared';

interface AdminViewContextType {
  isViewingAsUser: boolean;
  viewedUser: User | null;
  enterUserView: (user: User) => void;
  exitUserView: () => void;
}

const AdminViewContext = createContext<AdminViewContextType | undefined>(undefined);

interface AdminViewProviderProps {
  children: ReactNode;
}

export function AdminViewProvider({ children }: AdminViewProviderProps) {
  const { setViewingAsUser, isViewingAsDifferentUser } = useAuth();

  const enterUserView = (user: User) => {
    setViewingAsUser(user);
  };

  const exitUserView = () => {
    setViewingAsUser(null);
  };

  return (
    <AdminViewContext.Provider
      value={{
        isViewingAsUser: isViewingAsDifferentUser(),
        viewedUser: null, // We'll get this from AuthContext
        enterUserView,
        exitUserView
      }}
    >
      {children}
    </AdminViewContext.Provider>
  );
}

export function useAdminView() {
  const context = useContext(AdminViewContext);
  if (context === undefined) {
    throw new Error('useAdminView must be used within an AdminViewProvider');
  }
  return context;
}
