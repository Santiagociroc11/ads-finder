import React, { createContext, useContext, useState, ReactNode } from 'react';
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
  const [isViewingAsUser, setIsViewingAsUser] = useState(false);
  const [viewedUser, setViewedUser] = useState<User | null>(null);

  const enterUserView = (user: User) => {
    setViewedUser(user);
    setIsViewingAsUser(true);
  };

  const exitUserView = () => {
    setViewedUser(null);
    setIsViewingAsUser(false);
  };

  return (
    <AdminViewContext.Provider
      value={{
        isViewingAsUser,
        viewedUser,
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
