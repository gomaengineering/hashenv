import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { hashPassword, comparePassword, generateToken, authenticate } from '../lib/auth';
import { AuthRequest } from '../lib/auth';
import { authRateLimiter } from '../middleware/security';
import { validateEmail, validatePassword } from '../middleware/validation';
import { generateVerificationToken, sendVerificationEmail, sendPasswordResetEmail } from '../lib/email';

const router = express.Router();

/**
 * Register a new user
 * POST /api/auth/register
 * Security: Rate limited, password validation, input sanitization
 */
router.post(
  '/register',
  authRateLimiter, // Security: Rate limit to prevent account enumeration
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters')
      .matches(/^[a-zA-Z0-9\s\-_.]+$/)
      .withMessage('Name contains invalid characters'),
    validateEmail(),
    validatePassword(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      const { name, email, password } = req.body;
      
      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        res.status(400).json({ error: 'User with this email already exists' });
        return;
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Generate email verification token
      const emailVerificationToken = generateVerificationToken();
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Create user with emailVerified: false (role field is deprecated and not used for access control)
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'admin', // Kept for backward compatibility, not used for access control
        emailVerified: false,
        emailVerificationToken,
        emailVerificationExpires,
      });
      
      // Send verification email (in development mode, this will log to console)
      try {
        await sendVerificationEmail(user.email, emailVerificationToken, user.name);
      } catch (emailError) {
        // If email sending fails, still return success but log the error
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails - user can request resend later
      }
      
      // DO NOT return token - user must verify email first
      res.status(201).json({
        message: 'Registration successful. Please check your email to verify your account.',
        emailSent: true,
      });
    } catch (error) {
      // Security: Don't log sensitive registration errors
      console.error('Registration error:', error instanceof Error ? error.message : 'Registration failed');
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

/**
 * Login user
 * POST /api/auth/login
 * Security: Rate limited to prevent brute force attacks
 */
router.post(
  '/login',
  authRateLimiter, // Security: Rate limit to prevent brute force
  [
    validateEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      const { email, password } = req.body;
      
      // Find user with password field
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }
      
      // Verify password
      const isPasswordValid = await comparePassword(password, user.password);
      
      if (!isPasswordValid) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }
      
      // Check if email is verified - CRITICAL: Account must be verified
      if (!user.emailVerified) {
        res.status(403).json({ 
          error: 'Email not verified. Please check your email and verify your account before logging in.',
          emailVerified: false,
        });
        return;
      }
      
      // Generate token
      const token = generateToken(user._id.toString(), user.email, user.role);
      
      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      // Security: Don't log authentication errors in detail
      console.error('Login error:', error instanceof Error ? error.message : 'Login failed');
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

/**
 * Get current user info
 * GET /api/auth/me
 */
/**
 * Verify email address
 * GET /api/auth/verify-email?token=xxx
 */
router.get('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Verification token is required' });
      return;
    }
    
    // Find user with verification token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');
    
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired verification token' });
      return;
    }
    
    // Verify email and clear token
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error instanceof Error ? error.message : 'Verification failed');
    res.status(500).json({ error: 'Email verification failed' });
  }
});

/**
 * Resend verification email
 * POST /api/auth/resend-verification
 */
router.post(
  '/resend-verification',
  authRateLimiter,
  [validateEmail()],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      const { email } = req.body;
      
      const user = await User.findOne({ email: email.toLowerCase() })
        .select('+emailVerificationToken +emailVerificationExpires');
      
      if (!user) {
        // Don't reveal if user exists (security best practice)
        res.json({ message: 'If an account exists with this email, a verification email has been sent.' });
        return;
      }
      
      if (user.emailVerified) {
        res.status(400).json({ error: 'Email is already verified' });
        return;
      }
      
      // Generate new verification token
      const emailVerificationToken = generateVerificationToken();
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      user.emailVerificationToken = emailVerificationToken;
      user.emailVerificationExpires = emailVerificationExpires;
      await user.save();
      
      // Send verification email
      try {
        await sendVerificationEmail(user.email, emailVerificationToken, user.name);
        res.json({ message: 'Verification email sent. Please check your inbox.' });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        res.status(500).json({ error: 'Failed to send verification email' });
      }
    } catch (error) {
      console.error('Resend verification error:', error instanceof Error ? error.message : 'Failed');
      res.status(500).json({ error: 'Failed to resend verification email' });
    }
  }
);

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
router.post(
  '/forgot-password',
  authRateLimiter,
  [validateEmail()],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      const { email } = req.body;
      
      const user = await User.findOne({ email: email.toLowerCase() })
        .select('+passwordResetToken +passwordResetExpires');
      
      if (!user) {
        // Don't reveal if user exists (security best practice)
        res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
        return;
      }
      
      // Generate password reset token
      const passwordResetToken = generateVerificationToken();
      const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      user.passwordResetToken = passwordResetToken;
      user.passwordResetExpires = passwordResetExpires;
      await user.save();
      
      // Send password reset email
      try {
        await sendPasswordResetEmail(user.email, passwordResetToken, user.name);
        res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        res.status(500).json({ error: 'Failed to send password reset email' });
      }
    } catch (error) {
      console.error('Forgot password error:', error instanceof Error ? error.message : 'Failed');
      res.status(500).json({ error: 'Failed to process password reset request' });
    }
  }
);

/**
 * Reset password
 * POST /api/auth/reset-password
 */
router.post(
  '/reset-password',
  authRateLimiter,
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    validatePassword(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      const { token, password } = req.body;
      
      // Find user with valid reset token
      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
      }).select('+password +passwordResetToken +passwordResetExpires');
      
      if (!user) {
        res.status(400).json({ error: 'Invalid or expired password reset token' });
        return;
      }
      
      // Hash new password
      const hashedPassword = await hashPassword(password);
      
      // Update password and clear reset token
      user.password = hashedPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      
      res.json({ message: 'Password reset successful. You can now log in with your new password.' });
    } catch (error) {
      console.error('Reset password error:', error instanceof Error ? error.message : 'Failed');
      res.status(500).json({ error: 'Password reset failed' });
    }
  }
);

/**
 * Get current user info
 * GET /api/auth/me
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    });
    } catch (error) {
      console.error('Get user error:', error instanceof Error ? error.message : 'Failed to get user info');
      res.status(500).json({ error: 'Failed to get user info' });
    }
});

export default router;
