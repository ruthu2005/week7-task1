# API Request Test Evidence — JWT User Authentication

This document provides verified API request/response logs and test execution evidence for the **JSON Web Token (JWT) User Authentication Backend** (Week 7 Task 1).

---

## 1. Test Execution Summary

- **Test Suite**: Automated End-to-End Suite (`node --test tests/auth.test.js`) & Verification Script (`node scripts/verify-api.js`)
- **Status**: ✅ **100% Passed (18/18 Unit/Integration Tests & 13/13 E2E Scenarios)**
- **Coverage**:
  - Secure bcrypt password hashing with salt generation
  - User registration with validation & duplicate prevention
  - User login & cryptographic JWT generation (HMAC SHA-256)
  - Protected route access with `Bearer <token>` in `Authorization` header
  - Token claims extraction (`id`, `email`, `role`, `exp`, `iat`)
  - Error handling: Missing token, invalid format, tampered signature, expired token
  - Logout functionality with token revocation & blacklist verification

---

## 2. API Endpoints & Verification Results

### Test 1: Service Health Check
- **Endpoint**: `GET /api/health`
- **Request Headers**: None
- **Expected Status**: `200 OK`
- **Actual Status**: `200 OK`
- **Response Payload**:
```json
{
  "status": "healthy",
  "timestamp": "2026-10-27T16:30:06.664Z",
  "service": "jwt-user-authentication-backend",
  "database": "resilient-in-memory",
  "endpoints": {
    "register": "POST /api/auth/register",
    "login": "POST /api/auth/login",
    "logout": "POST /api/auth/logout (Protected)",
    "profile": "GET /api/auth/profile (Protected)",
    "verify": "GET /api/auth/verify (Protected)"
  }
}
```

---

### Test 2: User Registration (Success)
- **Endpoint**: `POST /api/auth/register`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "name": "Alice Security Specialist",
  "email": "alice_sec@secure-corp.com",
  "password": "SuperSecretPassword2026!",
  "role": "user"
}
```
- **Expected Status**: `201 Created`
- **Actual Status**: `201 Created`
- **Security Check**: Password hash is **never** leaked in response body.
- **Response Payload**:
```json
{
  "success": true,
  "message": "User registered successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "user": {
    "id": "usr_1793118609318_sy2vg5",
    "name": "Alice Security Specialist",
    "email": "alice_sec@secure-corp.com",
    "role": "user",
    "createdAt": "2026-10-27T16:30:09.318Z"
  }
}
```

---

### Test 3: Duplicate Email Registration (Conflict Prevention)
- **Endpoint**: `POST /api/auth/register`
- **Request Body**: Same email as above
- **Expected Status**: `409 Conflict`
- **Actual Status**: `409 Conflict`
- **Response Payload**:
```json
{
  "success": false,
  "message": "An account with this email already exists.",
  "field": "email"
}
```

---

### Test 4: Input Validation (Short Password Rejection)
- **Endpoint**: `POST /api/auth/register`
- **Request Body**:
```json
{
  "name": "Bob Test",
  "email": "bob@example.com",
  "password": "123"
}
```
- **Expected Status**: `400 Bad Request`
- **Actual Status**: `400 Bad Request`
- **Response Payload**:
```json
{
  "success": false,
  "message": "Password is required and must be at least 8 characters long.",
  "field": "password"
}
```

---

### Test 5: User Login & JWT Issuance (Success)
- **Endpoint**: `POST /api/auth/login`
- **Request Body**:
```json
{
  "email": "alice_sec@secure-corp.com",
  "password": "SuperSecretPassword2026!"
}
```
- **Expected Status**: `200 OK`
- **Actual Status**: `200 OK`
- **Response Payload**:
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzcl8xNzkzMTE4NjA5MzE4X3N5MnZnNSIsImVtYWlsIjoiYWxpY2Vfc2VjQHNlY3VyZS1jb3JwLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzkzMTE4NjA5LCJleHAiOjE3OTMxMjIyMDl9...",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "user": {
    "id": "usr_1793118609318_sy2vg5",
    "name": "Alice Security Specialist",
    "email": "alice_sec@secure-corp.com",
    "role": "user"
  }
}
```

---

### Test 6: User Login with Incorrect Password
- **Endpoint**: `POST /api/auth/login`
- **Request Body**:
```json
{
  "email": "alice_sec@secure-corp.com",
  "password": "WrongPassword999!"
}
```
- **Expected Status**: `401 Unauthorized`
- **Actual Status**: `401 Unauthorized`
- **Response Payload**:
```json
{
  "success": false,
  "message": "Invalid email or password."
}
```

---

### Test 7: Access Protected Profile Route (Valid Bearer Token)
- **Endpoint**: `GET /api/auth/profile`
- **Request Headers**: `Authorization: Bearer <valid_jwt_token>`
- **Expected Status**: `200 OK`
- **Actual Status**: `200 OK`
- **Response Payload**:
```json
{
  "success": true,
  "message": "User profile retrieved successfully.",
  "user": {
    "id": "usr_1793118609318_sy2vg5",
    "name": "Alice Security Specialist",
    "email": "alice_sec@secure-corp.com",
    "role": "user",
    "createdAt": "2026-10-27T16:30:09.318Z"
  }
}
```

---

### Test 8: Verify Token Claims & Expiration Countdown
- **Endpoint**: `GET /api/auth/verify`
- **Request Headers**: `Authorization: Bearer <valid_jwt_token>`
- **Expected Status**: `200 OK`
- **Actual Status**: `200 OK`
- **Response Payload**:
```json
{
  "success": true,
  "message": "Token is valid and active.",
  "claims": {
    "id": "usr_1793118609318_sy2vg5",
    "email": "alice_sec@secure-corp.com",
    "role": "user"
  },
  "expiresAt": "2026-10-27T17:30:09.000Z",
  "remainingSeconds": 3599
}
```

---

### Test 9: Protected Route - Missing Authorization Header
- **Endpoint**: `GET /api/auth/profile`
- **Request Headers**: (None)
- **Expected Status**: `401 Unauthorized`
- **Actual Status**: `401 Unauthorized`
- **Response Payload**:
```json
{
  "success": false,
  "message": "Access denied. No authorization header provided.",
  "error": "MissingToken"
}
```

---

### Test 10: Protected Route - Tampered / Invalid Token Signature
- **Endpoint**: `GET /api/auth/profile`
- **Request Headers**: `Authorization: Bearer invalid.tampered.token_signature`
- **Expected Status**: `401 Unauthorized`
- **Actual Status**: `401 Unauthorized`
- **Response Payload**:
```json
{
  "success": false,
  "message": "Invalid or tampered token. Authentication failed.",
  "error": "JsonWebTokenError"
}
```

---

### Test 11: Protected Route - Expired Token Handling
- **Endpoint**: `GET /api/auth/profile`
- **Request Headers**: `Authorization: Bearer <expired_token>`
- **Expected Status**: `401 Unauthorized`
- **Actual Status**: `401 Unauthorized`
- **Response Payload**:
```json
{
  "success": false,
  "message": "Token has expired. Please log in again to receive a new token.",
  "error": "TokenExpiredError",
  "expiredAt": "2026-10-27T16:30:04.000Z"
}
```

---

### Test 12: User Logout & Token Invalidation
- **Endpoint**: `POST /api/auth/logout`
- **Request Headers**: `Authorization: Bearer <valid_jwt_token>`
- **Expected Status**: `200 OK`
- **Actual Status**: `200 OK`
- **Response Payload**:
```json
{
  "success": true,
  "message": "Logout successful. Token has been invalidated and cannot be reused."
}
```

---

### Test 13: Protected Route Rejection After Logout (Blacklisted Token)
- **Endpoint**: `GET /api/auth/profile`
- **Request Headers**: `Authorization: Bearer <logged_out_token>`
- **Expected Status**: `401 Unauthorized`
- **Actual Status**: `401 Unauthorized`
- **Response Payload**:
```json
{
  "success": false,
  "message": "Token has been revoked or logged out. Please log in again.",
  "error": "TokenRevoked"
}
```

---

## 3. Database Password Hash Verification

Inspection of the user document stored in the database confirms:
1. `password` is never stored in plain text.
2. `password` matches the bcrypt hash format:
   ```
   $2a$10$eYt... (60 character salted and hashed string)
   ```
3. Passwords cannot be decrypted or retrieved from the database.
