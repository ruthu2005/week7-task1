/**
 * Verification Script for JWT User Authentication API
 * Tests all endpoints end-to-end and outputs formatted test evidence.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../app.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { tokenBlacklist } from '../config/tokenBlacklist.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runVerification() {
  console.log('================================================================');
  console.log(' Starting End-to-End JWT Authentication API Verification');
  console.log(` Timestamp: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  await connectDB();
  tokenBlacklist.clear();

  const evidenceLogs = [];
  const logStep = (stepNumber, title, status, details) => {
    const symbol = status === 'PASS' ? '✅' : '❌';
    console.log(`${symbol} [Test ${stepNumber}] ${title} -> ${status}`);
    if (details) {
      console.log(`   ${details}`);
    }
    evidenceLogs.push({ stepNumber, title, status, details });
  };

  const uniqueId = Date.now();
  const testUser = {
    name: 'Alice Security Specialist',
    email: `alice_${uniqueId}@secure-corp.com`,
    password: 'SuperSecretPassword2026!'
  };

  let issuedToken = '';

  try {
    // 1. Health Check
    const healthRes = await request(app).get('/api/health');
    logStep(
      1,
      'GET /api/health - Service Health Check',
      healthRes.status === 200 && healthRes.body.status === 'healthy' ? 'PASS' : 'FAIL',
      `Status Code: ${healthRes.status}, Database: ${healthRes.body.database}`
    );

    // 2. User Registration Success
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    const regPass = regRes.status === 201 && regRes.body.success && regRes.body.token && !regRes.body.user.password;
    issuedToken = regRes.body.token;
    logStep(
      2,
      'POST /api/auth/register - User Registration',
      regPass ? 'PASS' : 'FAIL',
      `Status: ${regRes.status}, User ID: ${regRes.body.user?.id}, Token Generated: ${Boolean(issuedToken)}, Password Hidden: ${!regRes.body.user?.password}`
    );

    // 3. User Registration Duplicate Email Conflict
    const dupRes = await request(app).post('/api/auth/register').send(testUser);
    logStep(
      3,
      'POST /api/auth/register - Duplicate Email Conflict Handling',
      dupRes.status === 409 && dupRes.body.success === false ? 'PASS' : 'FAIL',
      `Status: ${dupRes.status}, Message: "${dupRes.body.message}"`
    );

    // 4. Registration Validation - Short Password
    const shortPwdRes = await request(app).post('/api/auth/register').send({
      name: 'Bob Test',
      email: `bob_${uniqueId}@test.com`,
      password: '123'
    });
    logStep(
      4,
      'POST /api/auth/register - Input Validation (Password minlength: 8)',
      shortPwdRes.status === 400 && shortPwdRes.body.field === 'password' ? 'PASS' : 'FAIL',
      `Status: ${shortPwdRes.status}, Message: "${shortPwdRes.body.message}"`
    );

    // 5. User Login Success
    const loginRes = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password
    });
    const loginPass = loginRes.status === 200 && loginRes.body.token && loginRes.body.tokenType === 'Bearer';
    if (loginPass) {
      issuedToken = loginRes.body.token; // update with login token
    }
    logStep(
      5,
      'POST /api/auth/login - User Login & JWT Issuance',
      loginPass ? 'PASS' : 'FAIL',
      `Status: ${loginRes.status}, Token Type: ${loginRes.body.tokenType}, ExpiresIn: ${loginRes.body.expiresIn}`
    );

    // 6. User Login - Invalid Password
    const badLoginRes = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'WrongPassword999!'
    });
    logStep(
      6,
      'POST /api/auth/login - Credential Verification (Invalid Password)',
      badLoginRes.status === 401 && badLoginRes.body.success === false ? 'PASS' : 'FAIL',
      `Status: ${badLoginRes.status}, Message: "${badLoginRes.body.message}"`
    );

    // 7. Protected Route - Access Profile with Bearer Token
    const profileRes = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${issuedToken}`);
    const profilePass = profileRes.status === 200 && profileRes.body.user?.email === testUser.email.toLowerCase();
    logStep(
      7,
      'GET /api/auth/profile - Access Protected Route with Bearer Token',
      profilePass ? 'PASS' : 'FAIL',
      `Status: ${profileRes.status}, Name: "${profileRes.body.user?.name}", Email: "${profileRes.body.user?.email}"`
    );

    // 8. Protected Route - Token Claims & Expiration Verification
    const verifyRes = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${issuedToken}`);
    const verifyPass = verifyRes.status === 200 && verifyRes.body.remainingSeconds > 0;
    logStep(
      8,
      'GET /api/auth/verify - Verify Token Claims & Expiration Countdown',
      verifyPass ? 'PASS' : 'FAIL',
      `Status: ${verifyRes.status}, Remaining Seconds: ${verifyRes.body.remainingSeconds}s, Expires At: ${verifyRes.body.expiresAt}`
    );

    // 9. Protected Route - Missing Authorization Header
    const missingTokenRes = await request(app).get('/api/auth/profile');
    logStep(
      9,
      'GET /api/auth/profile - Security Middleware (Missing Token)',
      missingTokenRes.status === 401 && missingTokenRes.body.error === 'MissingToken' ? 'PASS' : 'FAIL',
      `Status: ${missingTokenRes.status}, Error: ${missingTokenRes.body.error}, Message: "${missingTokenRes.body.message}"`
    );

    // 10. Protected Route - Malformed / Tampered Token
    const tamperedRes = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer invalid.tampered.token_signature');
    logStep(
      10,
      'GET /api/auth/profile - Security Middleware (Tampered / Invalid Signature)',
      tamperedRes.status === 401 && tamperedRes.body.error === 'JsonWebTokenError' ? 'PASS' : 'FAIL',
      `Status: ${tamperedRes.status}, Error: ${tamperedRes.body.error}`
    );

    // 11. Protected Route - Expired Token Handling
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_replace_in_production_environment_with_strong_entropy';
    const expiredToken = jwt.sign(
      { id: 'usr_test_expired', email: 'expired@test.com' },
      secret,
      { expiresIn: '-5s' }
    );
    const expiredRes = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${expiredToken}`);
    logStep(
      11,
      'GET /api/auth/profile - Security Middleware (Expired Token)',
      expiredRes.status === 401 && expiredRes.body.error === 'TokenExpiredError' ? 'PASS' : 'FAIL',
      `Status: ${expiredRes.status}, Error: ${expiredRes.body.error}, Message: "${expiredRes.body.message}"`
    );

    // 12. User Logout & Token Invalidation
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${issuedToken}`);
    logStep(
      12,
      'POST /api/auth/logout - Token Invalidation & Blacklist Storage',
      logoutRes.status === 200 && logoutRes.body.success === true ? 'PASS' : 'FAIL',
      `Status: ${logoutRes.status}, Message: "${logoutRes.body.message}"`
    );

    // 13. Access Protected Route After Logout (Revoked Token Check)
    const postLogoutRes = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${issuedToken}`);
    logStep(
      13,
      'GET /api/auth/profile - Rejection of Revoked / Logged-out Token',
      postLogoutRes.status === 401 && postLogoutRes.body.error === 'TokenRevoked' ? 'PASS' : 'FAIL',
      `Status: ${postLogoutRes.status}, Error: ${postLogoutRes.body.error}, Message: "${postLogoutRes.body.message}"`
    );

    console.log('\n================================================================');
    const allPassed = evidenceLogs.every((e) => e.status === 'PASS');
    console.log(` Verification Completed: ${evidenceLogs.filter((e) => e.status === 'PASS').length}/${evidenceLogs.length} Tests Passed`);
    console.log(` Overall Result: ${allPassed ? 'ALL TESTS PASSED (SUCCESS)' : 'SOME TESTS FAILED'}`);
    console.log('================================================================');
  } finally {
    await disconnectDB();
  }
}

runVerification().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
