# Implement User Authentication with JWT (Week 7 · Task 1)

> A production-grade Node.js & Express authentication backend implementing **JSON Web Tokens (JWT)**, **bcrypt** password hashing, secure token verification middleware, token expiration handling, and stateful token revocation for logout.

---

## 📋 Table of Contents
- [Project Overview](#-project-overview)
- [Key Security Principles](#-key-security-principles)
- [Project Directory Structure](#-project-directory-structure)
- [Installation & Setup](#-installation--setup)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
  - [1. User Registration](#1-user-registration)
  - [2. User Login](#2-user-login)
  - [3. Protected User Profile](#3-protected-user-profile)
  - [4. Token Status Verification](#4-token-status-verification)
  - [5. User Logout (Token Invalidation)](#5-user-logout-token-invalidation)
  - [6. Health Check](#6-health-check)
- [Testing & Verification](#-testing--verification)
  - [Automated Test Suite](#automated-test-suite)
  - [End-to-End Verification Script](#end-to-end-verification-script)
  - [Postman Collection](#postman-collection)
  - [Interactive Web Testbench](#interactive-web-testbench)
- [Submission Checklist](#-submission-checklist)

---

## 🚀 Project Overview

This repository contains the backend implementation for **Week 7 Task 1: Implement User Authentication with JWT**. It provides a modular, clean, and robust authentication mechanism adhering to modern security standards:

- **Salted Password Hashing**: Passwords hashed with `bcrypt` (10 rounds) before being written to persistent storage.
- **Signed JSON Web Tokens**: Signs payloads with HMAC SHA-256, carrying user claims (`id`, `email`, `role`) and strict expiration timestamps (`exp`, `iat`).
- **Reusable Authentication Middleware**: Inspects `Authorization: Bearer <token>` headers, verifies cryptographic signatures, catches expired or tampered tokens, and attaches authenticated user data to `req.user`.
- **Token Invalidation on Logout**: Implements a server-side token blacklist store that rejects previously issued tokens once a user logs out.
- **Zero-Config Resilient Store**: Automatically connects to local or remote MongoDB instances via Mongoose, with an intelligent in-memory fallback adapter allowing instant execution and testing in any environment.

---

## 🔒 Key Security Principles

1. **One-Way Password Salting & Hashing**:
   - Plaintext passwords are never stored in the database.
   - Using `bcryptjs` with salt rounds = 10 defends against rainbow table and collision attacks.
2. **Payload Protection**:
   - Mongoose `toJSON` transform ensures passwords are automatically sanitized and never leaked in API response bodies.
3. **Cryptographic Token Verification**:
   - Verifies tokens using secret keys from environment variables (`JWT_SECRET`).
   - Differentiates errors between expired tokens (`TokenExpiredError` -> `401`) and tampered/forged signatures (`JsonWebTokenError` -> `401`).
4. **Token Blacklisting**:
   - Prevents replay attacks by invalidating tokens upon logout until their natural expiration timestamp has elapsed.

---

## 📁 Project Directory Structure

```
week7-task1/
├── config/
│   ├── db.js                     # Database connection & resilient in-memory store adapter
│   └── tokenBlacklist.js         # In-memory token blacklist store for logout revocation
├── controllers/
│   └── authController.js         # Registration, login, profile, verification & logout logic
├── middleware/
│   └── authMiddleware.js         # JWT extraction, signature verification & expiration checks
├── models/
│   └── User.js                   # Mongoose User schema with bcrypt pre-save hook & methods
├── routes/
│   └── authRoutes.js             # Public & protected route definitions
├── tests/
│   └── auth.test.js              # Comprehensive test suite (18 unit & integration tests)
├── scripts/
│   └── verify-api.js             # Automated E2E verification & test evidence generator
├── postman/
│   └── JWT_Authentication_API.postman_collection.json  # Exportable Postman collection
├── docs/
│   └── test-evidence.md          # Full verified test run output logs
├── public/
│   ├── index.html                # Interactive dark glassmorphism testing dashboard
│   ├── style.css                 # Modern CSS styling with animations
│   └── app.js                    # Client-side JWT testbed & decoder
├── app.js                        # Express application configuration & middleware
├── server.js                     # HTTP server entry point
├── .env.example                  # Environment configuration template
├── .env                          # Local environment settings
├── .gitignore                    # Git ignore file
└── package.json                  # NPM scripts and dependency definitions
```

---

## 🛠 Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ (tested on Node v20/v24)
- NPM v9+
- MongoDB (optional; system includes automatic resilient fallback)

### 1. Clone & Enter Project Directory
```bash
cd "week7-task1"
```

### 2. Install Dependencies
```bash
npm install
# Or on Windows PowerShell:
npm.cmd install
```

### 3. Configure Environment Variables
Copy `.env.example` to create your `.env` file:
```bash
cp .env.example .env
```

### 4. Start the Application
- **Production / Standard Mode**:
  ```bash
  npm start
  ```
- **Development Watch Mode**:
  ```bash
  npm run dev
  ```

The server will start on `http://localhost:5000` (or your configured `PORT`).

---

## ⚙ Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port on which Express server listens |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/jwt_auth_db` | Connection string for MongoDB |
| `JWT_SECRET` | `super_secret_jwt_key_...` | Private key used to sign and verify JWT tokens |
| `JWT_EXPIRES_IN` | `1h` | Expiration window for issued tokens (e.g., `1h`, `15m`, `7d`) |
| `NODE_ENV` | `development` | Runtime environment (`development` / `production`) |

---

## 📖 API Documentation

### Summary Table

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Returns service status and database state |
| `POST` | `/api/auth/register` | Public | Registers a new user & hashes password |
| `POST` | `/api/auth/login` | Public | Validates credentials & issues signed JWT |
| `GET` | `/api/auth/profile` | Protected | Retrieves authenticated user profile |
| `GET` | `/api/auth/me` | Protected | Alias for user profile endpoint |
| `GET` | `/api/auth/verify` | Protected | Validates token claims & returns remaining TTL |
| `POST` | `/api/auth/logout` | Protected | Revokes token and adds it to blacklist |

---

### 1. User Registration
Creates a new user, hashes the password via `bcrypt`, and issues a signed JWT.

- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "name": "Ruthu Admin",
  "email": "ruthu@example.com",
  "password": "SecurePassword123!",
  "role": "admin"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "User registered successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "user": {
    "id": "usr_1793118609318_sy2vg5",
    "name": "Ruthu Admin",
    "email": "ruthu@example.com",
    "role": "admin",
    "createdAt": "2026-10-27T16:30:09.318Z"
  }
}
```

---

### 2. User Login
Validates email and password, checks bcrypt hash match, and generates a signed JWT.

- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "email": "ruthu@example.com",
  "password": "SecurePassword123!"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "user": {
    "id": "usr_1793118609318_sy2vg5",
    "name": "Ruthu Admin",
    "email": "ruthu@example.com",
    "role": "admin"
  }
}
```
- **Error Response (401 Unauthorized)**:
```json
{
  "success": false,
  "message": "Invalid email or password."
}
```

---

### 3. Protected User Profile
Accesses protected profile data. Requires a valid JWT token passed in the `Authorization` header.

- **URL**: `/api/auth/profile` (or `/api/auth/me`)
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <your_jwt_token>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "User profile retrieved successfully.",
  "user": {
    "id": "usr_1793118609318_sy2vg5",
    "name": "Ruthu Admin",
    "email": "ruthu@example.com",
    "role": "admin",
    "createdAt": "2026-10-27T16:30:09.318Z"
  }
}
```

---

### 4. Token Status Verification
Inspects active token status, claims, expiration date, and remaining TTL in seconds.

- **URL**: `/api/auth/verify`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <your_jwt_token>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Token is valid and active.",
  "claims": {
    "id": "usr_1793118609318_sy2vg5",
    "email": "ruthu@example.com",
    "role": "admin"
  },
  "expiresAt": "2026-10-27T17:30:09.000Z",
  "remainingSeconds": 3584
}
```

---

### 5. User Logout (Token Invalidation)
Revokes the current JWT by storing its identifier and expiration in the server blacklist.

- **URL**: `/api/auth/logout`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <your_jwt_token>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Logout successful. Token has been invalidated and cannot be reused."
}
```
- **Subsequent Request with Same Token (401 Unauthorized)**:
```json
{
  "success": false,
  "message": "Token has been revoked or logged out. Please log in again.",
  "error": "TokenRevoked"
}
```

---

## 🧪 Testing & Verification

### Automated Test Suite
Execute the native automated test suite covering all 18 security and logic conditions:
```bash
npm test
```
**Test Coverage Includes:**
- User registration with valid and invalid inputs
- Duplicate email conflict rejection (409)
- Verification that stored passwords in database are bcrypt hashes (never plain text)
- Login validation and credential verification
- Protected route access with valid `Bearer <token>`
- Rejection of missing header, non-Bearer schema, tampered signature, and expired tokens
- Logout token invalidation and subsequent rejection

---

### End-to-End Verification Script
Run the automated end-to-end verification script:
```bash
npm run verify
```
This runs 13 end-to-end HTTP scenarios and prints formatted test evidence directly to the console.

---

### Postman Collection
The exportable Postman collection is located at:
[`postman/JWT_Authentication_API.postman_collection.json`](postman/JWT_Authentication_API.postman_collection.json)

**Features:**
- Pre-configured variables: `{{baseUrl}}` and `{{authToken}}`
- Tests embedded in every request asserting status codes and response structures
- Automatic extraction and storage of `token` into `authToken` upon registration or login

---

### Interactive Web Testbench
Start the server and visit `http://localhost:5000` in any web browser to access the visual testing suite:
- Interactive registration and login forms
- Live JWT Inspector decoding Header, Payload, and Signature
- Real-time token expiration countdown timer
- Protected route execution buttons
- Security attack simulation sandbox (missing token, malformed scheme, tampered signature, expired token)
- Live API response log viewer with status code badges

---

## 🎯 Submission Checklist

- [x] **Project Structure**: Express backend configured with modular controllers, routes, middleware, and models.
- [x] **User Schema & Password Hashing**: Password hashed using `bcrypt` (10 rounds) before persistence; plaintext never stored.
- [x] **Registration Endpoint**: `POST /api/auth/register` with input validation, duplicate handling, and safe user persistence.
- [x] **Login Endpoint**: `POST /api/auth/login` with credential verification and signed JWT token issuance.
- [x] **Authentication Middleware**: `middleware/authMiddleware.js` verifying Bearer tokens, token expiration, and revocation.
- [x] **Logout Functionality**: `POST /api/auth/logout` with server-side token invalidation store.
- [x] **README.md**: Complete documentation with setup instructions, environment variables, and API specs.
- [x] **Environment Template**: `.env.example` highlighting all required secrets and configuration.
- [x] **Test Evidence & Postman**: Automated test suite (`tests/auth.test.js`), verified logs (`docs/test-evidence.md`), and Postman collection (`postman/JWT_Authentication_API.postman_collection.json`).
