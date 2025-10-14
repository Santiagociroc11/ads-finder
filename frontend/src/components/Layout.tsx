import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Search,
  Bookmark, 
  History,
  Users,
  Settings,
  Sparkles,
  Menu,
  X,
  Crown,
  Sliders
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LogOut } from 'lucide-react'
import { UsageCounter } from './UsageCounter'
import { LimitReachedModal } from './LimitReachedModal'
import { useQuery } from 'react-query'
import { userPlansApi } from '../services/userPlansApi'
import toast from 'react-hot-toast'

interface LayoutProps {
  children: React.ReactNode
}

const navigationItems = [
  {
    name: 'Búsqueda',
    href: '/',
    icon: Search,
    description: 'Buscar anuncios'
  },
  {
    name: 'Historial de Búsquedas',
    href: '/search-history',
    icon: History,
    description: 'Ver historial de búsquedas'
  },
  {
    name: 'Anunciantes en Seguimiento',
    href: '/tracked-advertisers',
    icon: Users,
    description: 'Monitorear anunciantes'
  },
  {
    name: 'Anuncios Favoritos',
    href: '/saved-ads',
    icon: Bookmark,
    description: 'Anuncios guardados'
  },
]

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const { user, logout } = useAuth()

  // Fetch user usage to check if at limit
  const { data: usageData } = useQuery({
    queryKey: ['userUsage'],
    queryFn: () => userPlansApi.getUserUsage(),
    refetchInterval: 30000, // Check every 30 seconds
    enabled: !!user
  })

  const usage = usageData?.usage

  // Check if user is at limit and show modal on every navigation (except config and plans pages)
  useEffect(() => {
    if (usage) {
      const usagePercentage = (usage.adsFetched / usage.monthlyLimit) * 100
      const isAtLimit = usagePercentage >= 100

      // Don't show modal on config or plans pages
      const isExcludedPage = location.pathname === '/settings' || location.pathname === '/user-plans'

      if (isAtLimit && !isExcludedPage) {
        // Show modal on every page navigation when at limit (except excluded pages)
        setShowLimitModal(true)
      }
    }
  }, [usage, location.pathname]) // Trigger on usage change AND route change

  // Reset modal state when usage changes (e.g., after upgrade)
  useEffect(() => {
    if (usage) {
      const usagePercentage = (usage.adsFetched / usage.monthlyLimit) * 100
      const isAtLimit = usagePercentage >= 100
      
      // Only auto-close if not at limit (regardless of current page)
      if (!isAtLimit) {
        setShowLimitModal(false)
      }
    }
  }, [usage])

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Sesión cerrada exitosamente')
    } catch (error) {
      toast.error('Error al cerrar sesión')
    }
  }

  // Get user initials
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <div className="flex h-screen bg-dark-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0 md:transition-none
          sidebar
        `}
      >
        <div className="holographic-panel h-full p-6 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="text-center">
              <h1 className="text-2xl holographic-title font-bold">
                <Sparkles className="inline w-6 h-6 mr-2" />
                Ads Finder PRO
              </h1>
            </div>
            
            {/* Mobile close button */}
            <button
              className="md:hidden btn-icon"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 py-6">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center p-3 rounded-lg transition-all duration-300
                    ${isActive 
                      ? 'bg-primary-500/20 text-primary-200 border border-primary-500/30' 
                      : 'text-gray-300 hover:bg-primary-500/10 hover:text-primary-200 border border-transparent hover:border-primary-500/20'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.description}</div>
                  </div>
                </Link>
              )
            })}
          </nav>

          {/* User Info Footer */}
          <div className="mt-auto pt-4 border-t border-gray-700/30">
            {user && (
              <div className="space-y-3">
                {/* Usage Counter */}
                <UsageCounter showDetails={false} className="mb-3" />

                {/* Compact User Info */}
                <div className="flex items-center justify-between px-2 py-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">
                        {getInitials(user.name)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {user.role === 'admin' ? 'Admin' : 'Usuario'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Compact Action Buttons */}
                  <div className="flex items-center gap-1">
                    <Link
                      to="/user-plans"
                      className={`p-2 rounded-md transition-colors ${
                        location.pathname === '/user-plans'
                          ? 'bg-primary-500/20 text-primary-300'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                      title="Planes y Límites"
                    >
                      <Crown className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/settings"
                      className={`p-2 rounded-md transition-colors ${
                        location.pathname === '/settings'
                          ? 'bg-primary-500/20 text-primary-300'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                      title="Configuración"
                    >
                      <Sliders className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Cerrar Sesión"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-dark-900/80 backdrop-blur-sm border-b border-primary-500/20 p-4">
          <div className="flex items-center justify-between">
            {/* Mobile menu button */}
            <button
              className="md:hidden btn-icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            
           
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 main-content">
          {children}
        </main>
      </div>

      {/* Global Limit Reached Modal */}
      {usage && (
        <LimitReachedModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          currentUsage={usage.adsFetched}
          monthlyLimit={usage.monthlyLimit}
          planType={usage.planType}
        />
      )}
    </div>
  )
}
