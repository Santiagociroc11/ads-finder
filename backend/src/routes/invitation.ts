import express from 'express';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import { InvitationService } from '../services/invitationService.js';

const router = express.Router();

// GET /api/invitation/generate - Ruta pública para generar tokens
router.get('/generate', asyncHandler(async (req, res) => {
  console.log(`[INVITATION] 🎫 Generating new invitation token...`);
  
  try {
    // Parámetros opcionales desde query string
    const expiresInHours = req.query.hours ? parseInt(req.query.hours as string) : 24;
    const maxUses = req.query.uses ? parseInt(req.query.uses as string) : 1;
    
    // Validar parámetros
    if (expiresInHours < 1 || expiresInHours > 168) { // Max 1 week
      throw new CustomError('Las horas de expiración deben estar entre 1 y 168 (1 semana)', 400);
    }
    
    if (maxUses < 1 || maxUses > 100) {
      throw new CustomError('Los usos máximos deben estar entre 1 y 100', 400);
    }
    
    const result = await InvitationService.generateToken({
      expiresInHours,
      maxUses,
      createdBy: 'admin'
    });
    
    if (!result.success) {
      throw new CustomError(result.message, 500);
    }
    
    console.log(`[INVITATION] ✅ Token generated successfully`);
    
    res.json({
      success: true,
      token: result.token,
      message: result.message,
      details: {
        expiresInHours,
        maxUses,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      }
    });
    
  } catch (error) {
    console.error('[INVITATION] ❌ Error generating token:', error);
    throw error;
  }
}));

// GET /api/invitation/validate/:token - Validar un token
router.get('/validate/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  if (!token || token.length !== 64) { // 32 bytes = 64 hex chars
    throw new CustomError('Token inválido', 400);
  }
  
  const validation = await InvitationService.validateToken(token);
  
  res.json({
    isValid: validation.isValid,
    message: validation.message,
    token: validation.token ? {
      createdAt: validation.token.createdAt,
      expiresAt: validation.token.expiresAt,
      maxUses: validation.token.maxUses,
      currentUses: validation.token.currentUses,
      isUsed: validation.token.isUsed
    } : null
  });
}));

// GET /api/invitation/tokens - Ver todos los tokens (para admin)
router.get('/tokens', asyncHandler(async (req, res) => {
  console.log(`[INVITATION] 📋 Getting all invitation tokens...`);
  
  const tokens = await InvitationService.getAllTokens();
  
  res.json({
    success: true,
    count: tokens.length,
    tokens: tokens.map(token => ({
      id: token._id,
      token: `${token.token.substring(0, 8)}...${token.token.substring(-8)}`, // Hide full token
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      isUsed: token.isUsed,
      usedAt: token.usedAt,
      usedBy: token.usedBy,
      createdBy: token.createdBy,
      maxUses: token.maxUses,
      currentUses: token.currentUses
    }))
  });
}));

// POST /api/invitation/clean - Limpiar tokens expirados
router.post('/clean', asyncHandler(async (req, res) => {
  console.log(`[INVITATION] 🧹 Cleaning expired tokens...`);
  
  const result = await InvitationService.cleanExpiredTokens();
  
  res.json({
    success: result.success,
    deletedCount: result.deletedCount,
    message: `Se eliminaron ${result.deletedCount} tokens expirados`
  });
}));

export default router;
