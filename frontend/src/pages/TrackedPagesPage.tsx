import { } from 'react'
import { Users, Plus } from 'lucide-react'

export function TrackedPagesPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold holographic-title">
            <Users className="inline w-8 h-8 mr-3" />
            Páginas Seguidas
          </h1>
          <p className="text-gray-400 mt-2">
            Monitorea páginas específicas de Facebook para nuevos anuncios
          </p>
        </div>
        <button className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Agregar Página
        </button>
      </div>
      
      <div className="text-center py-20">
        <Users className="w-24 h-24 mx-auto text-gray-600 mb-4" />
        <h3 className="text-2xl font-medium text-gray-400">Próximamente</h3>
        <p className="text-gray-500 mt-2">
          Rastrea páginas de competidores y recibe notificaciones de nuevos anuncios
        </p>
      </div>
    </div>
  )
}
