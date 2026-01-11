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

// Security: Helmet for security headers
app.use(securityHeaders);

// Security: CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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
