import express from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '@/services/database.js';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import { authenticateToken } from '@/middleware/authMiddleware.js';
import type { SavedAd, AdData } from '../types/shared.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// POST /api/saved-ads - Save a specific ad
router.post('/', asyncHandler(async (req, res) => {
  const { adData, tags, notes, collection } = req.body;
  const userId = (req as any).user?._id?.toString();
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }
  
  if (!adData || !adData.id) {
    throw new CustomError('Los datos del anuncio son requeridos', 400);
  }

  // Check if ad is already saved by this user
  const existingAd = await collections.savedAds.findOne({ 'adData.id': adData.id, userId });
  if (existingAd) {
    throw new CustomError('Este anuncio ya está guardado', 409);
  }

  const newSavedAd: any = {
    userId,
    adData,
    tags: tags || [],
    notes: notes || '',
    collection: collection || 'General',
    savedAt: new Date().toISOString(),
    lastViewed: new Date().toISOString(),
    isFavorite: false,
    analysis: {
      hotnessScore: adData.hotness_score || 0,
      daysRunning: adData.days_running || 0,
      isLongRunning: adData.is_long_running || false
    }
  };

  const result = await collections.savedAds.insertOne(newSavedAd as any);
  
  console.log(`[SAVED_ADS] ✅ New ad saved: ${adData.page_name} (ID: ${adData.id})`);
  
  res.status(201).json({
    ...newSavedAd,
    _id: result.insertedId,
    message: 'Anuncio guardado exitosamente'
  });
}));

// GET /api/saved-ads - Get saved ads with filters
router.get('/', asyncHandler(async (req, res) => {
  const { collection, tags, isFavorite, sortBy, limit } = req.query;
  const userId = (req as any).user?._id?.toString();
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }
  
  // Build filter
  let filter: any = { userId };
  if (collection && collection !== 'all') {
    filter.collection = collection;
  }
  if (tags) {
    const tagArray = (tags as string).split(',');
    filter.tags = { $in: tagArray };
  }
  if (isFavorite === 'true') {
    filter.isFavorite = true;
  }
  
  // Configure sorting
  let sort: Record<string, 1 | -1> = {};
  switch (sortBy) {
    case 'savedAt':
      sort = { savedAt: -1 };
      break;
    case 'hotness':
      sort = { 'analysis.hotnessScore': -1 };
      break;
    case 'daysRunning':
      sort = { 'analysis.daysRunning': -1 };
      break;
    case 'pageName':
      sort = { 'adData.page_name': 1 };
      break;
    default:
      sort = { savedAt: -1 };
  }
  
  let query = collections.savedAds.find(filter).sort(sort);
  if (limit) {
    query = query.limit(parseInt(limit as string));
  }
  
  const savedAds = await query.toArray();
  
  // Get stats
  const stats = await collections.savedAds.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        favorites: { $sum: { $cond: ['$isFavorite', 1, 0] } },
        collections: { $addToSet: '$collection' },
        avgHotness: { $avg: '$analysis.hotnessScore' }
      }
    }
  ]).toArray();
  
  res.json({
    ads: savedAds,
    stats: stats[0] || { total: 0, favorites: 0, collections: [], avgHotness: 0 }
  });
}));

// PUT /api/saved-ads/:id - Update saved ad
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tags, notes, collection, isFavorite } = req.body;
  const userId = (req as any).user?._id?.toString();
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }
  
  if (!ObjectId.isValid(id)) {
    throw new CustomError('ID de anuncio inválido', 400);
  }
  
  const updateFields: any = {};
  if (tags !== undefined) updateFields.tags = tags;
  if (notes !== undefined) updateFields.notes = notes;
  if (collection !== undefined) updateFields.collection = collection;
  if (isFavorite !== undefined) updateFields.isFavorite = isFavorite;
  updateFields.lastViewed = new Date().toISOString();
  
  const result = await collections.savedAds.updateOne(
    { _id: new ObjectId(id || ''), userId },
    { $set: updateFields }
  );
  
  if (result.matchedCount === 0) {
    throw new CustomError('Anuncio guardado no encontrado', 404);
  }
  
  console.log(`[SAVED_ADS] ✏️ Ad updated: ${id}`);
  
  res.json({ message: 'Anuncio actualizado exitosamente' });
}));

// DELETE /api/saved-ads/:id - Delete saved ad
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = (req as any).user?._id?.toString();
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }
  
  if (!ObjectId.isValid(id)) {
    throw new CustomError('ID de anuncio inválido', 400);
  }
  
  const result = await collections.savedAds.deleteOne({ _id: new ObjectId(id || ''), userId });
  
  if (result.deletedCount === 0) {
    throw new CustomError('Anuncio guardado no encontrado', 404);
  }
  
  console.log(`[SAVED_ADS] 🗑️ Ad deleted: ${id}`);
  
  res.json({ message: 'Anuncio guardado eliminado exitosamente' });
}));

// GET /api/saved-ads/collections - Get available collections
router.get('/collections', asyncHandler(async (req, res) => {
  const userId = (req as any).user?._id?.toString();
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }
  
  const collections_data = await collections.savedAds.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$collection',
        count: { $sum: 1 },
        lastAdded: { $max: '$savedAt' }
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();
  
  res.json(collections_data);
}));

// GET /api/saved-ads/tags - Get available tags
router.get('/tags', asyncHandler(async (req, res) => {
  const userId = (req as any).user?._id?.toString();
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }
  
  const tags = await collections.savedAds.aggregate([
    { $match: { userId } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  
  res.json(tags);
}));

// POST /api/saved-ads/bulk - Save multiple ads
router.post('/bulk', asyncHandler(async (req, res) => {
  const { ads, defaultTags, defaultCollection, defaultNotes } = req.body;
  const userId = (req as any).user?._id?.toString();
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }
  
  if (!ads || !Array.isArray(ads) || ads.length === 0) {
    throw new CustomError('Se requiere un array de anuncios', 400);
  }

  const results = {
    saved: 0,
    skipped: 0,
    errors: 0,
    details: [] as any[]
  };

  // Check which ads already exist for this user
  const existingAdIds = await collections.savedAds.find(
    { 'adData.id': { $in: ads.map((ad: AdData) => ad.id) }, userId }
  ).toArray();
  const existingIds = new Set(existingAdIds.map(ad => ad.adData.id));

  const adsToSave: Omit<SavedAd, '_id'>[] = [];
  
  for (const adData of ads) {
    if (existingIds.has(adData.id)) {
      results.skipped++;
      results.details.push({
        adId: adData.id,
        status: 'skipped',
        reason: 'Already exists'
      });
      continue;
    }

    const newSavedAd: any = {
      userId,
      adData,
      tags: defaultTags || [],
      notes: defaultNotes || '',
      collection: defaultCollection || 'General',
      savedAt: new Date().toISOString(),
      lastViewed: new Date().toISOString(),
      isFavorite: false,
      analysis: {
        hotnessScore: adData.hotness_score || 0,
        daysRunning: adData.days_running || 0,
        isLongRunning: adData.is_long_running || false
      }
    };

    adsToSave.push(newSavedAd);
    results.details.push({
      adId: adData.id,
      status: 'pending',
      pageName: adData.page_name
    });
  }

  // Save ads in bulk
  if (adsToSave.length > 0) {
    const insertResult = await collections.savedAds.insertMany(adsToSave as any[]);
    results.saved = insertResult.insertedCount;
    
    // Update details with success
    results.details.forEach(detail => {
      if (detail.status === 'pending') {
        detail.status = 'saved';
      }
    });
  }

  console.log(`[SAVED_ADS] 📦 Bulk save: ${results.saved} saved, ${results.skipped} skipped`);
  
  res.json({
    message: `Guardado masivo completado: ${results.saved} anuncios guardados, ${results.skipped} ya existían`,
    results
  });
}));

// GET /api/saved-ads/collections - Get user's collections
router.get('/collections', asyncHandler(async (req, res) => {
  const userId = (req as any).user?._id?.toString();
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }

  try {
    // Aggregate to get collections with counts
    const userCollections = await collections.savedAds.aggregate([
      { $match: { userId } },
      { $group: { 
        _id: '$collection', 
        count: { $sum: 1 },
        lastUpdated: { $max: '$createdAt' }
      }},
      { $sort: { lastUpdated: -1 } },
      { $project: { 
        name: '$_id', 
        count: 1, 
        lastUpdated: 1,
        _id: 0 
      }}
    ]).toArray();

    res.json({
      success: true,
      collections: userCollections || []
    });

  } catch (error: any) {
    console.error('Error fetching collections:', error);
    throw new CustomError('Error al obtener las colecciones', 500);
  }
}));

export default router;
