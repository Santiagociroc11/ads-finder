import React, { useState } from 'react';
import { X, Eye, Package, Smartphone, Wrench, HelpCircle, Save, Loader } from 'lucide-react';
import { AdData } from '../types/shared';
import { trackedAdvertisersApi } from '../services/api';

interface TrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  ad: AdData | null;
  activeAdsCount: number;
  onSuccess: () => void;
}

const TrackingModal: React.FC<TrackingModalProps> = ({ isOpen, onClose, ad, activeAdsCount, onSuccess }) => {
  const [productType, setProductType] = useState<'physical' | 'digital' | 'service' | 'other'>('physical');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !ad) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ad) return;

    setIsLoading(true);
    setError('');

    try {
      await trackedAdvertisersApi.addAdvertiser({
        pageId: ad.page_id,
        pageName: ad.page_name,
        pageProfileUri: ad.apify_data?.page_profile_uri,
        pageProfilePictureUrl: ad.apify_data?.page_profile_picture_url,
        pageLikeCount: ad.apify_data?.page_like_count,
        pageCategories: ad.apify_data?.page_categories,
        pageVerification: ad.apify_data?.page_verification,
        productType,
        notes: notes.trim(),
        initialActiveAdsCount: activeAdsCount
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al agregar el anunciante al seguimiento');
    } finally {
      setIsLoading(false);
    }
  };

  const productTypeOptions = [
    {
      value: 'physical',
      label: 'Producto Físico',
      description: 'Productos tangibles, envío físico',
      icon: Package,
      color: 'text-blue-500'
    },
    {
      value: 'digital',
      label: 'Producto Digital',
      description: 'Software, cursos, ebooks, apps',
      icon: Smartphone,
      color: 'text-green-500'
    },
    {
      value: 'service',
      label: 'Servicio',
      description: 'Consultoría, marketing, desarrollo',
      icon: Wrench,
      color: 'text-purple-500'
    },
    {
      value: 'other',
      label: 'Otro',
      description: 'Categoría no especificada',
      icon: HelpCircle,
      color: 'text-gray-500'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Eye className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Activar Seguimiento del Anunciante</h2>
              <p className="text-sm text-gray-400">Clasifica el producto y comienza el tracking diario de todos sus anuncios</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Advertiser Info */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-start space-x-4">
              {ad.apify_data?.page_profile_picture_url && (
                <img
                  src={ad.apify_data.page_profile_picture_url}
                  alt={ad.page_name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">{ad.page_name}</h3>
                <p className="text-sm text-gray-400">
                  {ad.apify_data?.page_categories?.[0] || 'Sin categoría'}
                  {ad.apify_data?.page_verification && (
                    <span className="ml-2 text-green-400">✓ Verificado</span>
                  )}
                </p>
                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                  {ad.apify_data?.page_like_count && (
                    <span>👥 {ad.apify_data.page_like_count.toLocaleString()} seguidores</span>
                  )}
                  {ad.apify_data?.total_ads_from_page && (
                    <span>📊 {ad.apify_data.total_ads_from_page.toLocaleString()} ads históricos</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Active Ads Count */}
          {activeAdsCount > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <h4 className="text-sm font-medium text-blue-300">
                  Anuncios activos actuales: {activeAdsCount}
                </h4>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Se hará seguimiento diario de este conteo y nuevos anuncios que aparezcan
              </p>
            </div>
          )}

          {/* Product Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Tipo de Producto/Servicio
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {productTypeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setProductType(option.value as any)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      productType === option.value
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-800/30'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <Icon className={`w-5 h-5 mt-0.5 ${option.color}`} />
                      <div>
                        <div className="font-medium text-white">{option.label}</div>
                        <div className="text-xs text-gray-400 mt-1">{option.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notas (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agrega observaciones sobre este anunciante..."
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              maxLength={500}
            />
            <div className="text-xs text-gray-500 mt-1">
              {notes.length}/500 caracteres
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Agregando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Activar Seguimiento</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackingModal;
