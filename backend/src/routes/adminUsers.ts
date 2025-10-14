import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { asyncHandler, CustomError } from '../middleware/errorHandler.js';
import { User } from '../models/User.js';
import { UserLimitsService } from '../services/userLimitsService.js';
import bcrypt from 'bcryptjs';

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
      searchesPerformed: user.usage.searchesPerformed,
      scrapeCreatorsCreditsMonth: user.usage.scrapeCreatorsCreditsMonth || 0,
      scrapeCreatorsCreditsTotal: user.usage.scrapeCreatorsCreditsTotal || 0
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

// GET /api/admin/users/:userId/password - Generate temporary password for admin to see
router.get('/users/:userId/password', requireAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new CustomError('User ID is required', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new CustomError('User not found', 404);
  }

  // Generate a temporary password that admin can see
  const tempPassword = Math.random().toString(36).slice(-8); // 8 character random password
  
  // Hash the temporary password
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  
  // Update user with temporary password
  user.password = hashedPassword;
  await user.save();

  res.json({
    success: true,
    password: tempPassword, // Return the actual temporary password
    isTemporary: true,
    message: 'Se generó una contraseña temporal. El usuario debe cambiarla en su próximo login.'
  });
}));

// PUT /api/admin/users/:userId - Update user (admin only)
router.put('/users/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { name, email, currentPassword, newPassword } = req.body;

  if (!userId) {
    throw new CustomError('User ID is required', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new CustomError('User not found', 404);
  }

  // Update basic info
  if (name) user.name = name.trim();
  if (email) user.email = email.toLowerCase().trim();

  // Update password if provided
  if (newPassword) {
    if (!currentPassword) {
      throw new CustomError('Current password is required to change password', 400);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new CustomError('Current password is incorrect', 400);
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    user.password = hashedNewPassword;
  }

  await user.save();

  console.log(`[ADMIN] ✅ User updated by admin: ${user.email}`);

  res.json({
    success: true,
    message: 'User updated successfully'
  });
}));

// POST /api/admin/users/create - Create new user (admin only)
router.post('/users/create', requireAdmin, asyncHandler(async (req, res) => {
  const { name, email, password, planType = 'free', role = 'user' } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    throw new CustomError('Name, email, and password are required', 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new CustomError('Invalid email format', 400);
  }

  // Validate password strength
  if (password.length < 6) {
    throw new CustomError('Password must be at least 6 characters long', 400);
  }

  // Validate plan type
  const validPlanTypes = ['free', 'pioneros', 'tactico', 'conquista', 'imperio'];
  if (!validPlanTypes.includes(planType)) {
    throw new CustomError('Invalid plan type', 400);
  }

  // Validate role
  if (!['user', 'admin'].includes(role)) {
    throw new CustomError('Invalid role', 400);
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new CustomError('User with this email already exists', 409);
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Get plan configuration
  const planConfig = (User as any).getPlanConfig(planType);

  // Create new user
  const newUser = new User({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    role,
    plan: {
      type: planType,
      name: planConfig.name,
      adsLimit: planConfig.adsLimit,
      trackedAdvertisersLimit: planConfig.trackedAdvertisersLimit,
      savedAdsLimit: planConfig.savedAdsLimit,
      features: planConfig.features
    },
    usage: {
      currentMonth: new Date().toISOString().slice(0, 7),
      adsFetched: 0,
      searchesPerformed: 0,
      scrapeCreatorsCreditsMonth: 0,
      scrapeCreatorsCreditsTotal: 0,
      lastResetDate: new Date()
    }
  });

  await newUser.save();

  console.log(`[ADMIN] ✅ New user created by admin: ${email} (${planType} plan)`);

  // Return user data without password
  const userResponse = {
    _id: newUser._id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role,
    plan: newUser.plan,
    usage: newUser.usage,
    createdAt: newUser.createdAt
  };

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    user: userResponse
  });
}));

export default router;
