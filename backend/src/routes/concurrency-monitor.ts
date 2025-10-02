import express from 'express';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import { monitor } from '../middleware/concurrencyMonitor.js';
import { balancedScraperService } from '../services/balancedScraperService.js';

const router = express.Router();

// GET /api/concurrency-monitor - Endpoint disabled
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    status: 'disabled',
    message: 'Concurrency monitoring has been disabled.'
  });
}));

// POST /api/concurrency-monitor/reset - Endpoint disabled
router.post('/reset', asyncHandler(async (req, res) => {
  res.status(404).json({
    status: 'disabled',
    message: 'Concurrency monitoring has been disabled.'
  });
}));

// POST /api/concurrency-monitor/clear-cache - Endpoint disabled
router.post('/clear-cache', asyncHandler(async (req, res) => {
  res.status(404).json({
    status: 'disabled',
    message: 'Concurrency monitoring has been disabled.'
  });
}));

export default router;
