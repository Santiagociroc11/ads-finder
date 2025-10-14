import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { asyncHandler, CustomError } from '../middleware/errorHandler.js';
import { User } from '../models/User.js';
import { UserLimitsService } from '../services/userLimitsService.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Middleware to check if user is admin
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new CustomError('Access denied. Admin privileges required.', 403);
  }
  next();
};

// GET /api/admin/users - Get all users (admin only)
router.get('/users', requireAdmin, asyncHandler(async (req, res) => {
  const users = await User.find({}, {
    password: 0, // Exclude password from response
    __v: 0
  }).sort({ createdAt: -1 });

  // Transform users data for admin view
  const adminUsers = users.map(user => ({
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: {
      type: user.plan.type,
      name: user.plan.name,
      adsLimit: user.plan.adsLimit
    },
    usage: {
      currentMonth: user.usage.currentMonth,
      adsFetched: user.usage.adsFetched,
      searchesPerformed: user.usage.searchesPerformed
    },
    createdAt: user.createdAt
  }));

  res.json({
    success: true,
    users: adminUsers,
    total: adminUsers.length
  });
}));

// POST /api/admin/users/plan - Update user plan (admin only)
router.post('/users/plan', requireAdmin, asyncHandler(async (req, res) => {
  const { userId, planType } = req.body;

  if (!userId || !planType) {
    throw new CustomError('User ID and plan type are required', 400);
  }

  const validPlanTypes = ['free', 'pioneros', 'tactico', 'conquista', 'imperio'];
  if (!validPlanTypes.includes(planType)) {
    throw new CustomError('Invalid plan type', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new CustomError('User not found', 404);
  }

  // Update user plan using the existing service
  await UserLimitsService.upgradeUserPlan(userId, planType);

  res.json({
    success: true,
    message: `User plan updated to ${planType.toUpperCase()}`
  });
}));

// POST /api/admin/users/reset-usage - Reset user usage (admin only)
router.post('/users/reset-usage', requireAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    throw new CustomError('User ID is required', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new CustomError('User not found', 404);
  }

  // Reset usage for current month
  const currentMonth = new Date().toISOString().slice(0, 7);
  user.usage.currentMonth = currentMonth;
  user.usage.adsFetched = 0;
  user.usage.searchesPerformed = 0;
  user.usage.lastResetDate = new Date();

  await user.save();

  res.json({
    success: true,
    message: 'User usage reset successfully'
  });
}));

// POST /api/admin/users/toggle-admin - Toggle admin status (admin only)
router.post('/users/toggle-admin', requireAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    throw new CustomError('User ID is required', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new CustomError('User not found', 404);
  }

  // Prevent admin from removing their own admin status
  if (userId === req.user._id.toString()) {
    throw new CustomError('Cannot modify your own admin status', 400);
  }

  // Toggle admin status
  user.role = user.role === 'admin' ? 'user' : 'admin';

  await user.save();

  res.json({
    success: true,
    message: `User admin status updated to ${user.role}`,
    newRole: user.role
  });
}));

export default router;
