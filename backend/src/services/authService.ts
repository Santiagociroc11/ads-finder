import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { collections } from './database.js';
import type { User, AuthRequest, RegisterRequest, AuthResponse, TokenPayload } from '../types/shared.js';
import { InvitationService } from './invitationService.js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env variables first (same logic as server.ts)
// Try multiple paths to find .env file
const possiblePaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '..', '.env'),
  path.join(process.cwd(), '..', '..', '.env')
];

let envLoaded = false;
for (const envPath of possiblePaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (result.parsed && !result.error) {
      console.log(`[AUTH] 📁 .env loaded from: ${envPath}`);
      envLoaded = true;
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

if (!envLoaded) {
  console.log(`[AUTH] ⚠️  No .env file found, using fallback values`);
}

// JWT Secret - in production this should be a strong secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'ads-finder-jwt-secret-key-2024-production-ready-secure-key-123456789'; // Fallback for development
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

// Log JWT secret status on startup
const secretSource = process.env.JWT_SECRET ? 'from environment' : 'using fallback';
const secretPreview = process.env.JWT_SECRET 
  ? `${process.env.JWT_SECRET.substring(0, 8)}...${process.env.JWT_SECRET.substring(process.env.JWT_SECRET.length - 8)}`
  : 'fallback-secret';
console.log(`[AUTH] 🔑 JWT Secret loaded: ${secretSource} (${secretPreview})`);

export class AuthService {
  // Hash password
  private static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Compare password
  private static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Generate JWT token
  private static generateToken(user: User): string {
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId: user._id,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  // Verify JWT token
  public static verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      return null;
    }
  }

  // Register new user
  public static async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      if (!collections.users) {
        throw new Error('Database not initialized');
      }

      // Validate input
      if (!userData.email || !userData.password || !userData.name || !userData.invitationToken) {
        return {
          success: false,
          message: 'Email, password, name, and invitation token are required'
        };
      }

      // Validate invitation token FIRST
      const tokenValidation = await InvitationService.validateToken(userData.invitationToken);
      if (!tokenValidation.isValid) {
        return {
          success: false,
          message: tokenValidation.message
        };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        return {
          success: false,
          message: 'Invalid email format'
        };
      }

      // Validate password strength
      if (userData.password.length < 6) {
        return {
          success: false,
          message: 'Password must be at least 6 characters long'
        };
      }

      // Check if user already exists
      const existingUser = await collections.users.findOne({ 
        email: userData.email.toLowerCase() 
      });

      if (existingUser) {
        return {
          success: false,
          message: 'User with this email already exists'
        };
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user document
      const newUser = {
        email: userData.email.toLowerCase(),
        name: userData.name.trim(),
        password: hashedPassword,
        role: 'user' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Insert user
      const result = await collections.users.insertOne(newUser);

      // Prepare user response (without password)
      const userResponse: User = {
        _id: result.insertedId.toString(),
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt
      };

      // Mark invitation token as used
      await InvitationService.useToken(userData.invitationToken, userResponse._id);

      // Generate JWT token
      const token = this.generateToken(userResponse);

      console.log(`[AUTH] ✅ User registered successfully: ${userData.email} with invitation token`);

      return {
        success: true,
        token,
        user: userResponse,
        message: 'User registered successfully'
      };

    } catch (error) {
      console.error('[AUTH] ❌ Registration error:', error);
      return {
        success: false,
        message: 'Internal server error during registration'
      };
    }
  }

  // Login user
  public static async login(credentials: AuthRequest): Promise<AuthResponse> {
    try {
      if (!collections.users) {
        throw new Error('Database not initialized');
      }

      // Validate input
      if (!credentials.email || !credentials.password) {
        return {
          success: false,
          message: 'Email and password are required'
        };
      }

      // Find user by email
      const userDoc = await collections.users.findOne({ 
        email: credentials.email.toLowerCase() 
      });

      if (!userDoc) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Compare password
      const isPasswordValid = await this.comparePassword(credentials.password, userDoc.password);

      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Prepare user response (without password)
      const user: User = {
        _id: userDoc._id.toString(),
        email: userDoc.email,
        name: userDoc.name,
        role: userDoc.role,
        createdAt: userDoc.createdAt,
        updatedAt: userDoc.updatedAt
      };

      // Generate token
      const token = this.generateToken(user);

      console.log(`[AUTH] ✅ User logged in successfully: ${credentials.email}`);

      return {
        success: true,
        token,
        user,
        message: 'Login successful'
      };

    } catch (error) {
      console.error('[AUTH] ❌ Login error:', error);
      return {
        success: false,
        message: 'Internal server error during login'
      };
    }
  }

  // Get user by ID
  public static async getUserById(userId: string): Promise<User | null> {
    try {
      if (!collections.users) {
        throw new Error('Database not initialized');
      }

      const userDoc = await collections.users.findOne({ 
        _id: new ObjectId(userId) 
      });

      if (!userDoc) {
        return null;
      }

      return {
        _id: userDoc._id.toString(),
        email: userDoc.email,
        name: userDoc.name,
        role: userDoc.role,
        createdAt: userDoc.createdAt,
        updatedAt: userDoc.updatedAt
      };

    } catch (error) {
      console.error('[AUTH] ❌ Get user error:', error);
      return null;
    }
  }

  // Verify token and get user
  public static async verifyTokenAndGetUser(token: string): Promise<User | null> {
    try {
      const payload = this.verifyToken(token);
      if (!payload) {
        return null;
      }

      return this.getUserById(payload.userId);
    } catch (error) {
      console.error('[AUTH] ❌ Token verification error:', error);
      return null;
    }
  }

  // Change user password
  public static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthResponse> {
    try {
      if (!collections.users) {
        throw new Error('Database not initialized');
      }

      // Find user by ID
      const userDoc = await collections.users.findOne({ 
        _id: new ObjectId(userId) 
      });

      if (!userDoc) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await this.comparePassword(currentPassword, userDoc.password);
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          message: 'Current password is incorrect'
        };
      }

      // Hash new password
      const hashedNewPassword = await this.hashPassword(newPassword);

      // Update password in database
      await collections.users.updateOne(
        { _id: new ObjectId(userId) },
        { 
          $set: { 
            password: hashedNewPassword,
            updatedAt: new Date().toISOString()
          } 
        }
      );

      console.log(`[AUTH] ✅ Password changed successfully for user: ${userDoc.email}`);

      return {
        success: true,
        message: 'Password changed successfully'
      };

    } catch (error) {
      console.error('[AUTH] ❌ Change password error:', error);
      return {
        success: false,
        message: 'Internal server error during password change'
      };
    }
  }
}
