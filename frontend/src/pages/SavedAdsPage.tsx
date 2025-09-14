import { Bookmark } from 'lucide-react'

export function SavedAdsPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold holographic-title">
          <Bookmark className="inline w-8 h-8 mr-3" />
          Anuncios Guardados
        </h1>
        <p className="text-gray-400 mt-2">
          Tu colección curada de anuncios ganadores
        </p>
      </div>
      
      <div className="text-center py-20">
        <Bookmark className="w-24 h-24 mx-auto text-gray-600 mb-4" />
        <h3 className="text-2xl font-medium text-gray-400">Próximamente</h3>
        <p className="text-gray-500 mt-2">
          Guarda y organiza tus anuncios favoritos aquí
        </p>
      </div>
    </div>
  )
}
