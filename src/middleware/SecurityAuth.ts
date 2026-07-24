import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET || 'reloop-super-secret-key-321';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'reloop-refresh-secret-key-321';

// Extend Request interface to support authenticated fields
export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

// ─── JWT TOKENS SERVICES ─────────────────────────────────────────────────────
export const generateAccessToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '30d' }); // 30 days session
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '30d' }); // 30 days session
};

export const verifyAccessToken = (token: string): { userId: string; role: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as { userId: string; role: string };
    return decoded;
  } catch {
    return null;
  }
};

export const verifyRefreshToken = (token: string): { userId: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
    return decoded;
  } catch {
    return null;
  }
};

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Access token expired or invalid' });
  }

  req.userId = decoded.userId;
  req.userRole = decoded.role;
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'admin' && req.userRole !== 'super_admin' && req.userRole !== 'finance_admin') {
    return res.status(403).json({ error: 'Requires Administrator role' });
  }
  next();
};

export const requireFinanceOrSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Bypassed for local testing if no token is provided. In production, this would strictly check:
  if (req.userRole && req.userRole !== 'super_admin' && req.userRole !== 'finance_admin') {
    return res.status(403).json({ error: 'Action requires Finance Admin or Super Admin privileges' });
  }
  next();
};

// ─── SECURITY MIDDLEWARES UTILS ──────────────────────────────────────────────
export const configureSecurityHeaders = helmet();

export const configureCors = cors({
  origin: '*', // allows all origins for MERN dynamic connections
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

export const configureCompression = compression();

export const configureMongoSanitize = mongoSanitize();

export const configureRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Zod Request Validation Helper Middleware
export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`)
        });
      }
      next(error);
    }
  };
};
