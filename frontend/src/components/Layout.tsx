import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Search,
  Bookmark, 
  BarChart3, 
  Database,
  Users,
  Sparkles,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'

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
        <div className="holographic-panel h-full p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="text-center">
              <h1 className="text-2xl holographic-title font-bold">
                <Sparkles className="inline w-6 h-6 mr-2" />
                Ads Finder PRO
              </h1>
              <p className="text-sm text-primary-400 font-orbitron">
                TypeScript Edition v2.0
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
          <nav className="space-y-2">
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

          {/* Footer */}
          <div className="pt-6 border-t border-primary-500/20">
            <div className="text-xs text-gray-400 text-center">
              <div className="font-orbitron text-primary-400 mb-1">
                🚀 Powered by TypeScript
              </div>
              <div>
                💎 Apify • 🤖 Gemini AI • 📊 MongoDB
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden bg-dark-900/80 backdrop-blur-sm border-b border-primary-500/20 p-4">
          <button
            className="btn-icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
