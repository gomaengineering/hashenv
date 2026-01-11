import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import User, { IUser } from '../models/User';

/**
 * Authentication and authorization utilities
 */

// Security: JWT_SECRET must be set, no default fallback
// Lazy validation: check when actually used, not at module load time
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET environment variable must be set and be at least 32 characters long');
  }
  return secret;
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Hash a password using bcrypt
 * Security: Uses 12 salt rounds (adequate for most use cases)
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (password.length > 128) {
    throw new Error('Password must be less than 128 characters');
  }
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(userId: string, email: string, role: string): string {
  return jwt.sign(
    { userId, email, role },
    getJWTSecret(),
    { expiresIn: JWT_EXPIRES_IN } as SignOptions
  );
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): { userId: string; email: string; role: string } {
  try {
    const decoded = jwt.verify(token, getJWTSecret()) as { userId: string; email: string; role: string };
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Express middleware to authenticate requests
 * Attaches user info to req.user if token is valid
 */
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: 'admin' | 'user'; // DEPRECATED: Not used for access control
  };
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = verifyToken(token);
      
      // Verify user still exists in database
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }
      
      // CRITICAL: Check if email is verified - unverified accounts cannot access protected routes
      if (!user.emailVerified) {
        res.status(403).json({ 
          error: 'Email not verified. Please verify your email before accessing this resource.',
          emailVerified: false,
        });
        return;
      }
      
      // Attach user info to request
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role as 'admin' | 'user',
      };
      
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  } catch (error) {
    res.status(500).json({ error: 'Authentication error' });
    return;
  }
}

/**
 * DEPRECATED: Middleware to check if user is an admin
 * This is no longer used for access control. Access is now based on project ownership and collaboration.
 * Kept for backward compatibility only.
 * 
 * @deprecated Use project ownership checks instead (requireProjectOwnership from authorization.ts)
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  
  next();
}
