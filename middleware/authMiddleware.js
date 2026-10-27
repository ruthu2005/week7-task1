import jwt from 'jsonwebtoken';
import { tokenBlacklist } from '../config/tokenBlacklist.js';

/**
 * Authentication Middleware
 * Extracts and verifies JSON Web Tokens (JWT) from the Authorization header.
 * Attaches decoded user payload to `req.user` if valid.
 */
export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    // Check if Authorization header is provided
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authorization header provided.',
        error: 'MissingToken'
      });
    }

    // Verify Bearer schema format
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format. Expected "Bearer <token>".',
        error: 'InvalidTokenFormat'
      });
    }

    // Extract the token string
    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token string is empty.',
        error: 'EmptyToken'
      });
    }

    // Check if token has been invalidated / logged out
    if (tokenBlacklist.isBlacklisted(token)) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked or logged out. Please log in again.',
        error: 'TokenRevoked'
      });
    }

    // Verify token cryptographic signature and expiration
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_replace_in_production_environment_with_strong_entropy';
    const decoded = jwt.verify(token, secret);

    // Attach decoded user claims and raw token to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user'
    };
    req.token = token;
    req.tokenExp = decoded.exp;

    next();
  } catch (error) {
    // Distinguish token expiration from malformed/tampered tokens
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again to receive a new token.',
        error: 'TokenExpiredError',
        expiredAt: error.expiredAt
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or tampered token. Authentication failed.',
        error: 'JsonWebTokenError'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Token verification failed.',
      error: error.message
    });
  }
};

// Aliases for versatility across routes and tests
export const authenticate = verifyToken;
export const authMiddleware = verifyToken;
export default verifyToken;
