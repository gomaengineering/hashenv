import nodemailer from 'nodemailer';
import crypto from 'crypto';

/**
 * Email service for sending verification and password reset emails
 */

// Create transporter based on environment
// Emails are sent via SMTP in both development and production
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true'; // true for 465, false for other ports
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_API_KEY;

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration is missing. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

// Lazy initialization - create transporter when first needed
let transporter: ReturnType<typeof createTransporter> | null = null;
function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

/**
 * Sanitize and escape display name for email headers (RFC 5322 compliant)
 * Handles special characters, quotes, and backslashes properly
 */
function sanitizeDisplayName(name: string): string {
  // Remove leading/trailing whitespace
  const trimmed = name.trim();
  
  // If empty after trimming, return empty string
  if (!trimmed) {
    return '';
  }
  
  // Check if name needs to be quoted (contains special characters or spaces)
  const needsQuoting = /[(),:;<>@[\]\\"]/.test(trimmed) || trimmed.includes(' ');
  
  if (needsQuoting) {
    // Escape backslashes and double quotes, then wrap in quotes
    const escaped = trimmed
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/"/g, '\\"');   // Escape double quotes
    return `"${escaped}"`;
  }
  
  return trimmed;
}

/**
 * Get formatted "from" email address with optional display name
 * Production-grade implementation with proper RFC 5322 compliance
 * 
 * Format options:
 * - With display name: "Display Name" <email@example.com>
 * - Without display name: email@example.com
 * 
 * @returns Properly formatted email address string
 */
function getFromAddress(): string {
  // Get email address (priority: SMTP_FROM > SMTP_USER > fallback)
  const email = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@hashenv.com';
  
  // Validate email format (basic check)
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new Error('Invalid email address in SMTP configuration. SMTP_FROM or SMTP_USER must be a valid email address.');
  }
  
  // Get and sanitize display name
  const displayName = process.env.SMTP_DISPLAY_NAME;
  
  // If no display name is set, return just the email address
  if (!displayName || typeof displayName !== 'string') {
    return email.trim();
  }
  
  const sanitizedName = sanitizeDisplayName(displayName);
  
  // If sanitization resulted in empty string, return just email
  if (!sanitizedName) {
    return email.trim();
  }
  
  // Format: "Display Name" <email@example.com>
  return `${sanitizedName} <${email.trim()}>`;
}

/**
 * Generate a secure random token for email verification or password reset
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(email: string, token: string, name: string): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

  // In development mode, also log the verification URL for convenience
  if (process.env.NODE_ENV === 'development') {
    console.log('\n========== EMAIL VERIFICATION (DEVELOPMENT MODE) ==========');
    console.log(`To: ${email}`);
    console.log(`Subject: Verify Your Email Address - HashEnv`);
    console.log(`Verification URL: ${verificationUrl}`);
    console.log('===========================================================\n');
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff !important; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Verify Your Email Address</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering with HashEnv. Please verify your email address by clicking the button below:</p>
        <a href="${verificationUrl}" class="button" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff !important; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: bold;">Verify Email Address</a>
        <p>Or copy and paste this link into your browser:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account, you can safely ignore this email.</p>
        <div class="footer">
          <p>Best regards,<br>The HashEnv Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await getTransporter().sendMail({
      from: getFromAddress(),
      to: email,
      subject: 'Verify Your Email Address - HashEnv',
      html,
    });
    if (process.env.NODE_ENV === 'development') {
      console.log('✓ Verification email sent successfully');
    }
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, token: string, name: string): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  // In development mode, also log the reset URL for convenience
  if (process.env.NODE_ENV === 'development') {
    console.log('\n========== PASSWORD RESET (DEVELOPMENT MODE) ==========');
    console.log(`To: ${email}`);
    console.log(`Subject: Reset Your Password - HashEnv`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('======================================================\n');
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff !important; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Reset Your Password</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password for your HashEnv account. Click the button below to reset your password:</p>
        <a href="${resetUrl}" class="button" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff !important; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: bold;">Reset Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <div class="warning">
          <p><strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>The HashEnv Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await getTransporter().sendMail({
      from: getFromAddress(),
      to: email,
      subject: 'Reset Your Password - HashEnv',
      html,
    });
    if (process.env.NODE_ENV === 'development') {
      console.log('✓ Password reset email sent successfully');
    }
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}
