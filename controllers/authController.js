import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { tokenBlacklist } from '../config/tokenBlacklist.js';

// Helper to sign JWT tokens
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_replace_in_production_environment_with_strong_entropy';
  const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

  const payload = {
    id: user._id ? user._id.toString() : user.id,
    email: user.email,
    role: user.role || 'user'
  };

  return jwt.sign(payload, secret, { expiresIn });
};

// Email validation helper
const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return typeof email === 'string' && emailRegex.test(email.trim());
};

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Input Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name is required and must be at least 2 characters long.',
        field: 'name'
      });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.',
        field: 'email'
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 8 characters long.',
        field: 'password'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Check for existing user (Conflict check)
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
        field: 'email'
      });
    }

    // 3. Create user (password will be hashed via schema pre-save hook or store)
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: role === 'admin' ? 'admin' : 'user'
    });

    // 4. Generate JWT token
    const token = generateToken(user);

    // 5. Respond with sanitized user object and auth token
    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
        field: 'email'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration.',
      error: error.message
    });
  }
};

/**
 * Log in an existing user and issue a signed JWT
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Input Presence Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Both email and password are required.'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 2. Retrieve user by email
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 3. Verify password hash using bcrypt
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 4. Issue signed JSON Web Token
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login.',
      error: error.message
    });
  }
};

/**
 * Log out user by invalidating the current JWT token
 * POST /api/auth/logout (Protected route)
 */
export const logout = async (req, res) => {
  try {
    const token = req.token;
    const tokenExp = req.tokenExp;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'No token found in request to invalidate.'
      });
    }

    // Add token to revoked blacklist
    tokenBlacklist.add(token, tokenExp);

    return res.status(200).json({
      success: true,
      message: 'Logout successful. Token has been invalidated and cannot be reused.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to process logout.',
      error: error.message
    });
  }
};

/**
 * Get current authenticated user profile
 * GET /api/auth/profile (Protected route)
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully.',
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile.',
      error: error.message
    });
  }
};

/**
 * Verify token status and return token claims & TTL
 * GET /api/auth/verify (Protected route)
 */
export const verifyTokenStatus = async (req, res) => {
  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const remainingSeconds = req.tokenExp ? Math.max(0, req.tokenExp - currentTimestamp) : null;

    return res.status(200).json({
      success: true,
      message: 'Token is valid and active.',
      claims: req.user,
      expiresAt: req.tokenExp ? new Date(req.tokenExp * 1000).toISOString() : null,
      remainingSeconds
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to verify token status.',
      error: error.message
    });
  }
};
