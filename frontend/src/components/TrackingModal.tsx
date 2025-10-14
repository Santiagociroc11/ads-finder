import React, { useState } from 'react';
import { X, Eye, Package, Smartphone, Save, Loader, Crown, ArrowRight } from 'lucide-react';
import { AdData } from '../types/shared';
import { trackedAdvertisersApi } from '../services/api';
import { Link } from 'react-router-dom';

interface TrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  ad: AdData | null;
  activeAdsCount: number;
  onSuccess: () => void;
}

const TrackingModal: React.FC<TrackingModalProps> = ({ isOpen, onClose, ad, activeAdsCount, onSuccess }) => {
  const [productType, setProductType] = useState<'physical' | 'digital'>('physical');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPlanLimitError, setIsPlanLimitError] = useState(false);

  if (!isOpen || !ad) {
    // Reset states when modal is closed
    if (!isOpen) {
      setError('');
      setIsPlanLimitError(false);
      setProductType('physical');
      setNotes('');
    }
    return null;
  }

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
      console.error('Tracking error:', err);
      
      // Check if it's a plan limit error
      if (err.response?.status === 403 && err.response?.data?.error?.includes('Límite de anunciantes')) {
        setIsPlanLimitError(true);
        setError('Tu plan actual no permite agregar anunciantes en seguimiento. Para usar esta funcionalidad, necesitas hacer upgrade a un plan superior.');
      } else {
        setIsPlanLimitError(false);
        setError(err.response?.data?.message || err.response?.data?.error || 'Error al agregar el anunciante al seguimiento');
      }
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
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-500/20 rounded-lg">
              <Eye className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Activar Seguimiento</h2>
              <p className="text-xs text-gray-400">Clasifica el tipo de producto</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Advertiser Info */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center space-x-3">
              {ad.apify_data?.page_profile_picture_url && (
                <img
                  src={ad.apify_data.page_profile_picture_url}
                  alt={ad.page_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <div>
                <h3 className="font-semibold text-white text-sm">{ad.page_name}</h3>
                <p className="text-xs text-gray-400">
                  {activeAdsCount} anuncios activos
                </p>
              </div>
            </div>
          </div>

          {/* Product Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tipo de Producto *
            </label>
            <div className="grid grid-cols-1 gap-2">
              {productTypeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setProductType(option.value as any)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      productType === option.value
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-800/30'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-5 h-5 ${option.color}`} />
                      <div>
                        <div className="font-medium text-white text-sm">{option.label}</div>
                        <div className="text-xs text-gray-400">{option.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className={`p-3 rounded-lg border ${
              isPlanLimitError 
                ? 'bg-yellow-500/10 border-yellow-500/30' 
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              {isPlanLimitError ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    <p className="text-sm font-medium text-yellow-400">Límite de Plan Alcanzado</p>
                  </div>
                  <p className="text-xs text-yellow-300 mb-3">{error}</p>
                  <Link
                    to="/user-plans"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 px-3 py-2 rounded-lg transition-colors"
                  >
                    <Crown className="w-3 h-3" />
                    Ver Planes Disponibles
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-red-400">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 p-4 border-t border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-gray-400 hover:text-white transition-colors text-sm"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg transition-colors flex items-center space-x-2 text-sm"
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
