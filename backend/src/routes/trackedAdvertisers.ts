import express from 'express';
import { authenticateToken } from '@/middleware/authMiddleware.js';
import { TrackedAdvertiser } from '@/models/TrackedAdvertiser.js';
import { connectDatabase } from '@/services/database.js';

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// GET / - Obtener anunciantes en seguimiento del usuario
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user._id.toString();
    const { page = 1, limit = 20, active = 'true' } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const isActive = active === 'true';
    
    const query = { 
      userId, 
      ...(isActive !== undefined && { isActive }) 
    };
    
    const [advertisers, total] = await Promise.all([
      TrackedAdvertiser.find(query)
        .sort({ trackingStartDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      TrackedAdvertiser.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: advertisers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error getting tracked advertisers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// GET /stats - Obtener estadísticas de seguimiento
router.get('/stats', async (req, res) => {
  try {
    const userId = (req as any).user._id.toString();
    
    const [
      totalTracked,
      activeTracked,
      productTypeStats,
      totalAdsTracked,
      topCategories,
      recentActivity
    ] = await Promise.all([
      TrackedAdvertiser.countDocuments({ userId }),
      TrackedAdvertiser.countDocuments({ userId, isActive: true }),
      TrackedAdvertiser.aggregate([
        { $match: { userId } },
        { $group: { _id: '$productType', count: { $sum: 1 } } }
      ]),
      TrackedAdvertiser.aggregate([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: '$totalAdsTracked' } } }
      ]),
      TrackedAdvertiser.aggregate([
        { $match: { userId } },
        { $unwind: '$pageCategories' },
        { $group: { _id: '$pageCategories', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      TrackedAdvertiser.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(10)
        .select('pageName pageId updatedAt')
        .lean()
    ]);
    
    const productTypeCounts = {
      physical: 0,
      digital: 0,
      service: 0,
      other: 0
    };
    
    productTypeStats.forEach(stat => {
      productTypeCounts[stat._id as keyof typeof productTypeCounts] = stat.count;
    });
    
    const avgAdsPerAdvertiser = totalTracked > 0 
      ? Math.round((totalAdsTracked[0]?.total || 0) / totalTracked) 
      : 0;
    
    res.json({
      success: true,
      data: {
        totalTracked,
        activeTracked,
        ...productTypeCounts,
        totalAdsTracked: totalAdsTracked[0]?.total || 0,
        avgAdsPerAdvertiser,
        topCategories: topCategories.map(cat => ({
          category: cat._id,
          count: cat.count
        })),
        recentActivity: recentActivity.map(advertiser => ({
          advertiser: advertiser.pageName,
          pageId: advertiser.pageId,
          action: 'updated' as const,
          date: advertiser.updatedAt
        }))
      }
    });
  } catch (error) {
    console.error('Error getting tracking stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// POST / - Agregar anunciante al seguimiento
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).user._id.toString();
    const {
      pageId,
      pageName,
      pageProfileUri,
      pageProfilePictureUrl,
      pageLikeCount,
      pageCategories,
      pageVerification,
      productType,
      notes,
      initialActiveAdsCount
    } = req.body;
    
    // Verificar si ya está siendo seguido
    const existing = await TrackedAdvertiser.findOne({ 
      userId, 
      pageId 
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Este anunciante ya está siendo seguido'
      });
    }
    
    const trackedAdvertiser = new TrackedAdvertiser({
      userId,
      pageId,
      pageName,
      pageProfileUri,
      pageProfilePictureUrl,
      pageLikeCount: pageLikeCount || 0,
      pageCategories: pageCategories || [],
      pageVerification: pageVerification || false,
      productType,
      notes: notes || '',
      isActive: true,
      trackingStartDate: new Date(),
      totalAdsTracked: initialActiveAdsCount || 0,
      initialActiveAdsCount: initialActiveAdsCount || 0,
      dailyStats: []
    });
    
    await trackedAdvertiser.save();
    
    res.status(201).json({
      success: true,
      data: trackedAdvertiser,
      message: 'Anunciante agregado al seguimiento'
    });
  } catch (error) {
    console.error('Error adding tracked advertiser:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// PUT /:id - Actualizar anunciante en seguimiento
router.put('/:id', async (req, res) => {
  try {
    const userId = (req as any).user._id.toString();
    const { id } = req.params;
    const updateData = req.body;
    
    const advertiser = await TrackedAdvertiser.findOneAndUpdate(
      { _id: id, userId },
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );
    
    if (!advertiser) {
      return res.status(404).json({
        success: false,
        message: 'Anunciante no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: advertiser,
      message: 'Anunciante actualizado'
    });
  } catch (error) {
    console.error('Error updating tracked advertiser:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// DELETE /:id - Eliminar anunciante del seguimiento
router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).user._id.toString();
    const { id } = req.params;
    
    const result = await TrackedAdvertiser.findOneAndDelete(
      { _id: id, userId }
    );
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Anunciante no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Anunciante eliminado del seguimiento'
    });
  } catch (error) {
    console.error('Error deleting tracked advertiser:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// POST /:id/check - Actualizar estadísticas diarias
router.post('/:id/check', async (req, res) => {
  try {
    const userId = (req as any).user._id.toString();
    const { id } = req.params;
    const { activeAds, newAds, totalAds, reachEstimate, avgSpend } = req.body;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const advertiser = await TrackedAdvertiser.findOne({ _id: id, userId });
    
    if (!advertiser) {
      return res.status(404).json({
        success: false,
        message: 'Anunciante no encontrado'
      });
    }
    
    // Buscar estadísticas de hoy
    const todayStatsIndex = advertiser.dailyStats.findIndex(
      stat => stat.date.getTime() === today.getTime()
    );
    
    const todayStats = {
      date: today,
      activeAds: activeAds || 0,
      newAds: newAds || 0,
      totalAds: totalAds || 0,
      reachEstimate,
      avgSpend
    };
    
    if (todayStatsIndex >= 0) {
      // Actualizar estadísticas de hoy
      advertiser.dailyStats[todayStatsIndex] = todayStats;
    } else {
      // Agregar nuevas estadísticas de hoy
      advertiser.dailyStats.push(todayStats);
    }
    
    // Actualizar totales
    advertiser.totalAdsTracked = totalAds || advertiser.totalAdsTracked;
    advertiser.lastCheckedDate = new Date();
    
    await advertiser.save();
    
    res.json({
      success: true,
      data: advertiser,
      message: 'Estadísticas actualizadas'
    });
  } catch (error) {
    console.error('Error updating daily stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

export default router;
