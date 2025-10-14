import React from 'react';
import { ArrowLeft, User, Shield } from 'lucide-react';
import { useAdminView } from '../contexts/AdminViewContext';
import { useAuth } from '../contexts/AuthContext';

export function AdminViewBanner() {
  const { isViewingAsUser, exitUserView } = useAdminView();
  const { getCurrentUser, user: realUser } = useAuth();
  
  const viewedUser = getCurrentUser();

  if (!isViewingAsUser || !viewedUser || !realUser) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-red-600 to-red-700 border-b border-red-500/30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-white" />
              <span className="text-white font-semibold text-sm">Vista de Administrador</span>
            </div>
            <div className="h-4 w-px bg-white/30"></div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-white/80" />
              <span className="text-white/90 text-sm">
                Estás viendo como: <span className="font-medium">{viewedUser.name}</span>
              </span>
              <span className="text-white/70 text-xs">({viewedUser.email})</span>
            </div>
          </div>
          
          <button
            onClick={exitUserView}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors duration-200 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">Volver a Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
}
