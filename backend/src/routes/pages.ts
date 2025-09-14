import express from 'express';
import { ObjectId } from 'mongodb';
import fetch from 'node-fetch';
import { collections } from '@/services/database.js';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import type { TrackedPage } from '@shared/types/index.js';

const router = express.Router();

// POST /api/pages - Add a tracked page
router.post('/', asyncHandler(async (req, res) => {
  const { pageIdentifier } = req.body;
  
  if (!pageIdentifier) {
    throw new CustomError('Page identifier is required', 400);
  }

  let identifier = pageIdentifier;
  
  // Extract identifier from Facebook URL if provided
  if (pageIdentifier.includes('facebook.com')) {
    console.log(`[PAGES] 🔍 Detected URL. Extracting identifier: ${pageIdentifier}`);
    try {
      const url = new URL(pageIdentifier);
      if (url.pathname.includes('profile.php')) {
        identifier = url.searchParams.get('id');
      } else {
        identifier = url.pathname.split('/').filter(Boolean).pop();
      }
      console.log(`[PAGES] ✅ Extracted identifier: ${identifier}`);
    } catch (error) {
      throw new CustomError('Invalid Facebook URL format', 400);
    }
  }

  if (!identifier) {
    throw new CustomError('Could not extract page identifier', 400);
  }

  try {
    // Verify page exists with Facebook API
    const fbResponse = await fetch(
      `https://graph.facebook.com/v23.0/${identifier}?fields=name&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`
    );
    const fbData = await fbResponse.json() as any;

    if (!fbResponse.ok || fbData.error) {
      throw new CustomError(fbData.error?.message || 'Facebook API error', 400);
    }

    // Check if page is already tracked
    const existingPage = await collections.trackedPages().findOne({ pageId: fbData.id });
    if (existingPage) {
      throw new CustomError('Page is already being tracked', 409);
    }

    const newPage: Omit<TrackedPage, '_id'> = {
      pageId: fbData.id,
      pageName: fbData.name,
      createdAt: new Date().toISOString()
    };

    const result = await collections.trackedPages().insertOne(newPage as any);
    
    console.log(`[PAGES] ✅ New page tracked: ${fbData.name} (${fbData.id})`);
    
    res.status(201).json({
      ...newPage,
      _id: result.insertedId
    });

  } catch (error) {
    console.error('[PAGES] ❌ Error adding page:', error);
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(`Facebook API error: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
  }
}));

// GET /api/pages - Get all tracked pages
router.get('/', asyncHandler(async (req, res) => {
  const pages = await collections.trackedPages()
    .find()
    .sort({ createdAt: -1 })
    .toArray();
  
  res.json(pages);
}));

// DELETE /api/pages/:id - Remove a tracked page
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!ObjectId.isValid(id)) {
    throw new CustomError('Invalid page ID', 400);
  }
  
  const result = await collections.trackedPages().deleteOne({ _id: new ObjectId(id) });
  
  if (result.deletedCount === 0) {
    throw new CustomError('Tracked page not found', 404);
  }
  
  console.log(`[PAGES] 🗑️ Tracked page removed: ${id}`);
  
  res.json({ message: 'Tracked page removed successfully' });
}));

export default router;
