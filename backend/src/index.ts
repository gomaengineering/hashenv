import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import envRoutes from './routes/env';
import { securityHeaders, apiRateLimiter } from './middleware/security';
import { sanitizeError } from './middleware/security';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

// Trust proxy - Required for Render and other reverse proxy setups
// Set to 1 to trust only the first proxy (Render's proxy), which is more secure
// This allows Express to correctly identify client IPs from X-Forwarded-* headers
app.set('trust proxy', 1);

// Security: Helmet for security headers
app.use(securityHeaders);

// Security: CORS configuration
// Supports single origin (FRONTEND_URL) or multiple origins (CORS_ORIGINS - comma-separated)
function getCorsOrigins(): string | string[] | boolean {
  // Check if CORS_ORIGINS is set (comma-separated list for multiple origins)
  const corsOriginsEnv = process.env.CORS_ORIGINS;
  
  if (corsOriginsEnv) {
    // Split by comma and trim each origin
    const origins = corsOriginsEnv.split(',').map(origin => origin.trim()).filter(Boolean);
    
    if (origins.length > 0) {
      // In production, only allow specified origins
      if (process.env.NODE_ENV === 'production') {
        return origins;
      }
      // In development, also allow localhost
      return [...origins, 'http://localhost:3000', 'http://127.0.0.1:3000'];
    }
  }
  
  // Fallback to FRONTEND_URL (single origin)
  const frontendUrl = process.env.FRONTEND_URL;
  
  if (frontendUrl) {
    // In development, also allow localhost even if FRONTEND_URL is set
    if (process.env.NODE_ENV === 'development') {
      return [frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'];
    }
    return frontendUrl;
  }
  
  // Default: allow localhost in development, deny all in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CORS configuration error: FRONTEND_URL or CORS_ORIGINS must be set in production');
  }
  
  return 'http://localhost:3000';
}

const corsOptions: cors.CorsOptions = {
  origin: getCorsOrigins(),
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Security: Expose only necessary headers
  exposedHeaders: [],
  // Security: Max age for preflight requests (24 hours)
  maxAge: 86400,
  // Security: Validate origin in production
  ...(process.env.NODE_ENV === 'production' && {
    preflightContinue: false,
  }),
};

app.use(cors(corsOptions));

// Security: Request size limits (prevent DoS)
app.use(express.json({ limit: '100kb' })); // Limit JSON payloads
app.use(express.urlencoded({ extended: true, limit: '100kb' })); // Limit URL-encoded payloads

// Security: Apply rate limiting to API routes
app.use('/api', apiRateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', envRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Security: Sanitize error messages in production
  const errorMessage = sanitizeError(err);
  
  // Log full error details (server-side only)
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
  
  // Handle multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 50KB limit' });
    }
    return res.status(400).json({ error: 'File upload error' });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Invalid input data' });
  }
  
  // Handle MongoDB errors
  if (err.name === 'CastError' || err.name === 'MongoError') {
    return res.status(400).json({ error: 'Invalid data format' });
  }
  
  // Generic error response
  res.status(err.status || 500).json({
    error: errorMessage,
  });
});

// Connect to MongoDB
if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not set.');
  process.exit(1);
}

// Security: MongoDB connection options
const mongoOptions: mongoose.ConnectOptions = {
  // Security: Use TLS/SSL in production
  ...(process.env.NODE_ENV === 'production' && {
    tls: true,
    tlsAllowInvalidCertificates: false,
  }),
  // Security: Connection timeout
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  // Security: Retry configuration
  retryWrites: true,
  w: 'majority',
};

mongoose
  .connect(MONGODB_URI, mongoOptions)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      if (process.env.NODE_ENV === 'development') {
        console.log(`Health check: http://localhost:${PORT}/health`);
      }
    });
  })
  .catch((error) => {
    // Security: Don't log full connection string
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});
