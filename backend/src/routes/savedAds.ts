import express from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '@/services/database.js';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import { authenticateToken } from '@/middleware/authMiddleware.js';
import { AdMediaProcessor } from '@/services/adMediaProcessor.js';
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

  // Process and upload media to MinIO
  console.log(`🎬 Processing media for ad: ${adData.id}`);
  const processedMedia = await AdMediaProcessor.processAdMedia(adData, adData.id);
  const updatedAdData = AdMediaProcessor.updateAdDataWithProcessedMedia(adData, processedMedia);

  const newSavedAd: any = {
    userId,
    adData: updatedAdData,
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
    },
    // Store original URLs for reference
    originalMedia: {
      images: processedMedia.originalImages,
      videos: processedMedia.originalVideos
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
  
  // Process media for all ads in bulk
  console.log(`🎬 Processing media for ${ads.length} ads in bulk`);
  const bulkProcessResult = await AdMediaProcessor.processBulkAdsMedia(ads);
  
  console.log(`📊 Bulk media processing completed: ${bulkProcessResult.totalProcessed} processed, ${bulkProcessResult.totalFailed} failed`);
  
  for (let i = 0; i < ads.length; i++) {
    const adData = ads[i];
    const processedAdData = bulkProcessResult.processedAds[i];
    
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
      adData: processedAdData,
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
      },
      // Store original URLs for reference
      originalMedia: {
        images: processedAdData.apify_data?.images || processedAdData.scrapecreators_data?.images_detailed?.map((img: any) => img.url) || [],
        videos: processedAdData.apify_data?.videos?.map((video: any) => video.video_hd_url || video.video_sd_url) || []
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

export default router;
