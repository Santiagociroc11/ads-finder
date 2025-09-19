import express from 'express';
import { AuthService } from '../services/authService.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { asyncHandler, CustomError } from '../middleware/errorHandler.js';
import type { AuthRequest, RegisterRequest, AuthResponse } from '@shared/types/index.js';

const router = express.Router();

// POST /api/auth/register - Register new user
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, name }: RegisterRequest = req.body;

  if (!email || !password || !name) {
    throw new CustomError('Email, password, and name are required', 400);
  }

  const result = await AuthService.register({ email, password, name });

  if (!result.success) {
    const statusCode = result.message?.includes('already exists') ? 409 : 400;
    throw new CustomError(result.message || 'Registration failed', statusCode);
  }

  console.log(`[AUTH] ✅ New user registered: ${email}`);

  res.status(201).json(result);
}));

// POST /api/auth/login - Login user
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password }: AuthRequest = req.body;

  if (!email || !password) {
    throw new CustomError('Email and password are required', 400);
  }

  const result = await AuthService.login({ email, password });

  if (!result.success) {
    throw new CustomError(result.message || 'Login failed', 401);
  }

  console.log(`[AUTH] ✅ User logged in: ${email}`);

  res.json(result);
}));

// GET /api/auth/me - Get current user info
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new CustomError('User not found', 404);
  }

  res.json({
    success: true,
    user: req.user
  });
}));

// POST /api/auth/verify - Verify token validity
router.post('/verify', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw new CustomError('Token is required', 400);
  }

  const user = await AuthService.verifyTokenAndGetUser(token);

  if (!user) {
    throw new CustomError('Invalid or expired token', 401);
  }

  res.json({
    success: true,
    user,
    message: 'Token is valid'
  });
}));

// POST /api/auth/logout - Logout (client-side only, but useful for logging)
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  console.log(`[AUTH] ✅ User logged out: ${req.user?.email}`);
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

export default router;
