import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Search,
  Bookmark, 
  BarChart3, 
  Database,
  History,
  Users,
  Sparkles,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LogOut } from 'lucide-react'
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
    name: 'Búsquedas Guardadas',
    href: '/saved-searches',
    icon: Database,
    description: 'Ver búsquedas guardadas'
  },
  {
    name: 'Historial de Búsquedas',
    href: '/search-history',
    icon: History,
    description: 'Ver historial de búsquedas'
  },
  {
    name: 'Anuncios Favoritos',
    href: '/saved-ads',
    icon: Bookmark,
    description: 'Anuncios guardados'
  },
  {
    name: 'Estadísticas',
    href: '/stats',
    icon: BarChart3,
    description: 'Análisis y estadísticas'
  },
  {
    name: 'Páginas Seguidas',
    href: '/pages',
    icon: Users,
    description: 'Páginas rastreadas'
  },
]

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuth()

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
              <p className="text-sm text-primary-400 font-orbitron">
                Edición TypeScript v2.0
              </p>
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
          <div className="mt-auto pt-6 border-t border-primary-500/20">
            {user && (
              <div className="space-y-4">
                {/* User Info */}
                <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-dark-800/50">
                  <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-medium">
                      {getInitials(user.name)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {user.email}
                    </p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 mt-1">
                      {user.role === 'admin' ? 'Admin' : 'Usuario'}
                    </span>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>

                {/* Tech Footer */}
                <div className="text-xs text-gray-500 text-center pt-2 border-t border-primary-500/10">
                  <div className="font-orbitron text-primary-400 mb-1">
                    🚀 TypeScript v2.0
                  </div>
                  <div>
                    💎 Apify • 🤖 Gemini AI
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
            
            {/* Desktop title */}
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-100">
                Panel de Control
              </h2>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
