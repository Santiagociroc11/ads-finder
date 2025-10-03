import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Folder, Tag, MessageSquare } from 'lucide-react';
import { savedAdsApi } from '../services/api';
import { useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';

interface SaveAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  adData: any;
}

export default function SaveAdModal({ isOpen, onClose, adData }: SaveAdModalProps) {
  const queryClient = useQueryClient();
  const [selectedCollection, setSelectedCollection] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch existing collections
  const { data: collections, isLoading: collectionsLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => savedAdsApi.getCollections(),
    enabled: isOpen
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCollection('');
      setNewCollectionName('');
      setTags('');
      setNotes('');
      setIsCreatingCollection(false);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!adData) return;

    try {
      setIsSaving(true);

      let collectionName = selectedCollection;
      
      // If creating new collection
      if (isCreatingCollection) {
        if (!newCollectionName.trim()) {
          toast.error('El nombre de la colección es requerido');
          return;
        }
        collectionName = newCollectionName.trim();
      }

      if (!collectionName) {
        toast.error('Selecciona o crea una colección');
        return;
      }

      // Parse tags
      const tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);

      // Save the ad
      await savedAdsApi.saveAd({
        adData,
        collection: collectionName,
        tags: tagsArray,
        notes: notes.trim() || undefined
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries('savedAds');
      queryClient.invalidateQueries('collections');

      toast.success(`Anuncio guardado en "${collectionName}"`);
      onClose();

    } catch (error: any) {
      console.error('Error saving ad:', error);
      toast.error(error.response?.data?.message || 'Error al guardar el anuncio');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-dark-800 border border-primary-500/30 rounded-lg p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Guardar Anuncio
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ad Preview */}
        <div className="bg-gray-700/50 rounded-lg p-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
              <span className="text-primary-400 font-semibold text-sm">
                {adData?.page_name?.charAt(0) || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium truncate">
                {adData?.page_name || 'Anuncio'}
              </h3>
              <p className="text-gray-400 text-sm truncate">
                {adData?.ad_creative_bodies?.[0]?.substring(0, 50) || 'Sin descripción'}...
              </p>
            </div>
          </div>
        </div>

        {/* Collection Selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Colección
            </label>
            
            {/* Collection Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setIsCreatingCollection(false)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !isCreatingCollection
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Folder className="w-4 h-4 inline mr-2" />
                Seleccionar
              </button>
              <button
                onClick={() => setIsCreatingCollection(true)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isCreatingCollection
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <FolderPlus className="w-4 h-4 inline mr-2" />
                Crear Nueva
              </button>
            </div>

            {/* Collection Selection */}
            {!isCreatingCollection ? (
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-primary-500 focus:outline-none"
                disabled={collectionsLoading}
              >
                <option value="">Selecciona una colección</option>
                {collections?.map((collection: any) => (
                  <option key={collection.name} value={collection.name}>
                    {collection.name} ({collection.count} anuncios)
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Nombre de la nueva colección"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none"
              />
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Tag className="w-4 h-4 inline mr-1" />
              Etiquetas (opcional)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="etiqueta1, etiqueta2, etiqueta3"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Separa las etiquetas con comas
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agrega notas sobre este anuncio..."
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || (!selectedCollection && !isCreatingCollection)}
            className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Anuncio'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
