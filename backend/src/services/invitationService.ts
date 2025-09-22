import { ObjectId } from 'mongodb';
import { collections } from './database.js';
import crypto from 'crypto';

export interface InvitationToken {
  _id?: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  isUsed: boolean;
  usedAt?: string;
  usedBy?: string; // userId who used it
  createdBy: string; // 'admin' or userId who generated it
  maxUses: number;
  currentUses: number;
}

export interface GenerateTokenRequest {
  expiresInHours?: number; // Default 24 hours
  maxUses?: number; // Default 1
  createdBy?: string; // Default 'admin'
}

export interface TokenValidationResult {
  isValid: boolean;
  token?: InvitationToken;
  message: string;
}

export class InvitationService {
  
  // Generate a new invitation token
  static async generateToken(options: GenerateTokenRequest = {}): Promise<{ success: boolean; token?: string; message: string }> {
    try {
      if (!collections.invitationTokens) {
        throw new Error('Database not initialized');
      }

      const {
        expiresInHours = 24,
        maxUses = 1,
        createdBy = 'admin'
      } = options;

      // Generate a secure random token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);

      const tokenDoc: InvitationToken = {
        token,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        isUsed: false,
        createdBy,
        maxUses,
        currentUses: 0
      };

      await collections.invitationTokens.insertOne(tokenDoc);

      console.log(`[INVITATION] ✅ New token generated: ${token.substring(0, 8)}... (expires in ${expiresInHours}h, max uses: ${maxUses})`);

      return {
        success: true,
        token,
        message: `Token generated successfully. Expires in ${expiresInHours} hours, max uses: ${maxUses}`
      };

    } catch (error) {
      console.error('[INVITATION] ❌ Error generating token:', error);
      return {
        success: false,
        message: 'Failed to generate invitation token'
      };
    }
  }

  // Validate an invitation token
  static async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      if (!collections.invitationTokens) {
        throw new Error('Database not initialized');
      }

      const tokenDoc = await collections.invitationTokens.findOne({ token });

      if (!tokenDoc) {
        return {
          isValid: false,
          message: 'Token de invitación inválido'
        };
      }

      // Check if token is expired
      const now = new Date();
      const expiresAt = new Date(tokenDoc.expiresAt);
      
      if (now > expiresAt) {
        return {
          isValid: false,
          token: tokenDoc,
          message: 'El token de invitación ha expirado'
        };
      }

      // Check if token has reached max uses
      if (tokenDoc.currentUses >= tokenDoc.maxUses) {
        return {
          isValid: false,
          token: tokenDoc,
          message: 'El token de invitación ya ha sido utilizado el máximo número de veces'
        };
      }

      return {
        isValid: true,
        token: tokenDoc,
        message: 'Token válido'
      };

    } catch (error) {
      console.error('[INVITATION] ❌ Error validating token:', error);
      return {
        isValid: false,
        message: 'Error validando el token de invitación'
      };
    }
  }

  // Mark token as used
  static async useToken(token: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!collections.invitationTokens) {
        throw new Error('Database not initialized');
      }

      const result = await collections.invitationTokens.updateOne(
        { token },
        {
          $inc: { currentUses: 1 },
          $set: {
            usedAt: new Date().toISOString(),
            usedBy: userId
          }
        }
      );

      if (result.modifiedCount === 0) {
        return {
          success: false,
          message: 'Failed to mark token as used'
        };
      }

      console.log(`[INVITATION] ✅ Token used: ${token.substring(0, 8)}... by user ${userId}`);

      return {
        success: true,
        message: 'Token marked as used successfully'
      };

    } catch (error) {
      console.error('[INVITATION] ❌ Error using token:', error);
      return {
        success: false,
        message: 'Error marking token as used'
      };
    }
  }

  // Get all tokens (for admin)
  static async getAllTokens(): Promise<InvitationToken[]> {
    try {
      if (!collections.invitationTokens) {
        throw new Error('Database not initialized');
      }

      const tokens = await collections.invitationTokens
        .find({})
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      return tokens.map(token => ({
        ...token,
        _id: token._id?.toString()
      }));

    } catch (error) {
      console.error('[INVITATION] ❌ Error getting tokens:', error);
      return [];
    }
  }

  // Clean expired tokens
  static async cleanExpiredTokens(): Promise<{ success: boolean; deletedCount: number }> {
    try {
      if (!collections.invitationTokens) {
        throw new Error('Database not initialized');
      }

      const now = new Date().toISOString();
      const result = await collections.invitationTokens.deleteMany({
        expiresAt: { $lt: now }
      });

      console.log(`[INVITATION] 🧹 Cleaned ${result.deletedCount} expired tokens`);

      return {
        success: true,
        deletedCount: result.deletedCount
      };

    } catch (error) {
      console.error('[INVITATION] ❌ Error cleaning tokens:', error);
      return {
        success: false,
        deletedCount: 0
      };
    }
  }
}

export const invitationService = new InvitationService();
