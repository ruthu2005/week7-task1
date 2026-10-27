import express from 'express';
import {
  register,
  login,
  logout,
  getProfile,
  verifyTokenStatus
} from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Public Authentication Routes
 */
// Register a new user
router.post('/register', register);

// Login and obtain JWT
router.post('/login', login);

/**
 * Protected Authentication Routes (Require valid JWT Bearer token)
 */
// Log out and invalidate token
router.post('/logout', verifyToken, logout);

// Get authenticated user profile
router.get('/profile', verifyToken, getProfile);

// Convenient alias for profile endpoint
router.get('/me', verifyToken, getProfile);

// Verify token status and expiration info
router.get('/verify', verifyToken, verifyTokenStatus);

export default router;
