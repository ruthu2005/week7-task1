import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import User from '../models/User.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { tokenBlacklist } from '../config/tokenBlacklist.js';

describe('JWT User Authentication & Security Test Suite', () => {
  const testUser = {
    name: 'Test Engineer',
    email: `engineer_${Date.now()}@example.com`,
    password: 'Password123!'
  };

  let activeToken = '';

  before(async () => {
    await connectDB();
    tokenBlacklist.clear();
  });

  after(async () => {
    tokenBlacklist.clear();
    await disconnectDB();
  });

  // ==========================================
  // 1. User Registration Tests
  // ==========================================
  describe('POST /api/auth/register', () => {
    it('should successfully register a new user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.email, testUser.email.toLowerCase());
      assert.equal(res.body.user.name, testUser.name);
      assert.ok(res.body.token, 'Registration should return an authentication token');
      assert.equal(typeof res.body.token, 'string');
      // Verify password is NOT exposed
      assert.equal(res.body.user.password, undefined, 'Password must not be returned in API response');
    });

    it('should reject registration with duplicate email (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /already exists/i);
    });

    it('should reject registration when name is missing or too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'A',
          email: 'valid_test@example.com',
          password: 'ValidPassword123'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /at least 2 characters/i);
    });

    it('should reject registration when email is improperly formatted', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'invalid-email-address',
          password: 'ValidPassword123'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /valid email/i);
    });

    it('should reject registration when password is shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'shortpwd@example.com',
          password: '12345'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /at least 8 characters/i);
    });

    it('should verify password in database is hashed with bcrypt and not plain text', async () => {
      const savedUser = await User.findOne({ email: testUser.email });
      assert.ok(savedUser, 'User should exist in database');
      assert.notEqual(savedUser.password, testUser.password, 'Stored password must not be plain text');
      assert.match(
        savedUser.password,
        /^\$2[ab]\$\d{2}\$/,
        'Stored password must be a valid bcrypt hash starting with $2a$ or $2b$'
      );
    });
  });

  // ==========================================
  // 2. User Login Tests
  // ==========================================
  describe('POST /api/auth/login', () => {
    it('should successfully log in with correct credentials and return signed JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.token, 'Login must return a JWT token');
      assert.equal(res.body.tokenType, 'Bearer');
      assert.equal(res.body.user.email, testUser.email.toLowerCase());

      // Save token for protected route tests
      activeToken = res.body.token;

      // Decode and verify token structure
      const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_replace_in_production_environment_with_strong_entropy';
      const decoded = jwt.verify(activeToken, secret);
      assert.equal(decoded.email, testUser.email.toLowerCase());
      assert.ok(decoded.exp, 'Token must contain expiration timestamp');
      assert.ok(decoded.iat, 'Token must contain issued-at timestamp');
    });

    it('should reject login when password is incorrect (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword999!'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /invalid email or password/i);
    });

    it('should reject login when email does not exist (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent_user@example.com',
          password: 'SomePassword123!'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /invalid email or password/i);
    });

    it('should reject login when required fields are missing (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  // ==========================================
  // 3. Protected Route & Auth Middleware Tests
  // ==========================================
  describe('Authentication Middleware (verifyToken)', () => {
    it('should allow access to protected profile with a valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${activeToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.email, testUser.email.toLowerCase());
      assert.equal(res.body.user.name, testUser.name);
    });

    it('should allow access to token verification endpoint with active token', async () => {
      const res = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${activeToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.remainingSeconds > 0, 'Remaining seconds should be positive');
    });

    it('should reject access when Authorization header is missing (401)', async () => {
      const res = await request(app)
        .get('/api/auth/profile');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'MissingToken');
    });

    it('should reject access when Authorization scheme is not Bearer (401)', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Basic ${activeToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'InvalidTokenFormat');
    });

    it('should reject access with a malformed or invalid token (401)', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid.tampered.token_signature');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'JsonWebTokenError');
    });

    it('should reject access with an expired token (401 TokenExpiredError)', async () => {
      const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_replace_in_production_environment_with_strong_entropy';
      // Issue an immediately expired token (1 second in the past)
      const expiredToken = jwt.sign(
        { id: 'dummy_id', email: 'expired@example.com' },
        secret,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'TokenExpiredError');
      assert.match(res.body.message, /expired/i);
    });
  });

  // ==========================================
  // 4. Logout & Token Invalidation Tests
  // ==========================================
  describe('POST /api/auth/logout', () => {
    it('should successfully log out and invalidate the token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${activeToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.match(res.body.message, /logout successful/i);
    });

    it('should reject subsequent requests using the logged-out revoked token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${activeToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'TokenRevoked');
      assert.match(res.body.message, /revoked or logged out/i);
    });
  });
});
