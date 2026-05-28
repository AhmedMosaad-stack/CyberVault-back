# Backend Specification — Bank System (Phase 2: Testing & AWS Deployment)
> Version: 2.0.0
> Last updated: 2026-05-26
> Status: **Source of truth for all testing and deployment implementation**
> Depends on: Phase 1 spec (BACKEND_SPEC.md v2.0.0) — all Phase 1 Section 14 checklist items must be checked off before this phase begins.

---

## Table of Contents
1. [Phase Overview](#1-phase-overview)
2. [Test Architecture](#2-test-architecture)
3. [Test Directory Structure](#3-test-directory-structure)
4. [Environment Setup for Tests](#4-environment-setup-for-tests)
5. [Unit Tests](#5-unit-tests)
6. [Integration Tests](#6-integration-tests)
7. [E2E Tests](#7-e2e-tests)
8. [Seed Data Specification](#8-seed-data-specification)
9. [Coverage Requirements](#9-coverage-requirements)
10. [Test Commands](#10-test-commands)
11. [CI Pipeline — GitHub Actions](#11-ci-pipeline--github-actions)
12. [AWS Infrastructure](#12-aws-infrastructure)
13. [Secrets Management](#13-secrets-management)
14. [Networking & Security Groups](#14-networking--security-groups)
15. [Nginx & HTTPS](#15-nginx--https)
16. [Deployment Procedure](#16-deployment-procedure)
17. [Monitoring & Alerting](#17-monitoring--alerting)
18. [Rollback Procedure](#18-rollback-procedure)
19. [Phase 2 Verification Checklist](#19-phase-2-verification-checklist)
20. [Claude Code Implementation Rules](#20-claude-code-implementation-rules)

---

## 1. Phase Overview

Phase 2 covers everything that happens after the core backend (Phase 1) is built and locally verified. It is split into two tracks that run in parallel once Phase 1 is complete:

**Track A — Testing:** unit tests, integration tests, E2E tests, coverage enforcement, seed data, and CI pipeline.

**Track B — Deployment:** AWS infrastructure (EC2 + RDS for MySQL), secrets management, Nginx reverse proxy, HTTPS, GitHub Actions deploy workflow, CloudWatch monitoring, and rollback.

**Entry condition:** All items in Phase 1 Section 14 (Core Verification Checklist) are checked off before any Phase 2 work begins.

**Exit condition:** All items in Section 19 (Phase 2 Verification Checklist) are checked off and the pipeline is green on `main`.

**Database:** MySQL on Amazon RDS. Sequelize ORM. `sequelize.sync({ force: false, alter: false })` — no migration files. All DB access through the repository layer defined in Phase 1 Section 5.

---

## 2. Test Architecture

### 2.1 Three-Layer Test Strategy

| Layer | Tool | Scope | DB | Runs in CI |
|---|---|---|---|---|
| Unit | Jest | Pure logic — utils, validators, service rules | None (Sequelize models mocked via sequelize-mock) | Every push + PR |
| Integration | Jest + Supertest | Full HTTP request → response via real Express app | Dedicated MySQL test database (`bank_test`) | Every push + PR |
| E2E | Playwright | Full user flows against live staging server | Staging RDS MySQL instance | Push to `main` only |

### 2.2 Isolation Rules

- Unit tests must have **zero** real I/O — no DB calls, no file system, no network. All repositories are mocked with `jest.mock()`. Sequelize models are never instantiated in unit tests.
- Integration tests connect to the `bank_test` MySQL database. Each test file calls `sequelize.sync({ force: true })` in `beforeAll` to reset the schema, seeds its own minimal data, and drops all tables in `afterAll`. `force: true` is **only permitted in test files** — never in application code.
- E2E tests rely on the staging environment's persistent seed data (seeded once on first staging deploy — see Section 8.4). E2E tests must not permanently corrupt shared seed data — use dedicated E2E accounts for destructive operations.
- No test file may import a Sequelize model directly — use repository instances or the full Express `app` via Supertest.

### 2.3 Test Execution Order in CI

```
lint → unit tests → integration tests → build check → deploy → E2E tests (staging)
```

E2E tests run after deploy because they require the live staging server. If any earlier stage fails, the pipeline stops.

---

## 3. Test Directory Structure

```
bank-backend/
├── tests/
│   ├── unit/
│   │   ├── utils/
│   │   │   ├── encryption.test.js
│   │   │   ├── tokenHelpers.test.js
│   │   │   ├── bankUserId.test.js
│   │   │   └── accountNumber.test.js
│   │   ├── validators/
│   │   │   ├── auth.validator.test.js
│   │   │   ├── user.validator.test.js
│   │   │   ├── transaction.validator.test.js
│   │   │   └── contact.validator.test.js
│   │   └── services/
│   │       ├── auth.service.test.js
│   │       └── transaction.service.test.js
│   │
│   ├── integration/
│   │   ├── setup/
│   │   │   ├── db.js              # sequelize.sync({ force: true }) + teardown helpers
│   │   │   └── app.js             # imports src/app.js for Supertest
│   │   ├── helpers/
│   │   │   ├── auth.helper.js     # login + return token helper
│   │   │   └── seed.helper.js     # per-test minimal seed functions
│   │   ├── auth.test.js
│   │   ├── profile.test.js
│   │   ├── users.test.js
│   │   ├── transactions.test.js
│   │   └── contact.test.js
│   │
│   └── e2e/
│       ├── setup/
│       │   └── global.setup.js    # Playwright global setup (base URL, admin login)
│       ├── flows/
│       │   ├── auth.spec.js
│       │   ├── userManagement.spec.js
│       │   ├── transactions.spec.js
│       │   └── passwordChange.spec.js
│       └── playwright.config.js
│
├── jest.config.js
├── jest.integration.config.js
└── jest.unit.config.js
```

---

## 4. Environment Setup for Tests

### 4.1 Unit Tests — No DB Required

Unit tests use `jest.mock()` for all repositories. No database connection is opened. No `.env` file is needed for unit tests beyond JWT and encryption keys used in utility tests.

Required in `.env.test`:
```env
NODE_ENV=test
PORT=5001
DB_HOST=localhost
DB_PORT=3306
DB_NAME=bank_test
DB_USER=root
DB_PASSWORD=<test_mysql_password>
DB_NAME_TEST=bank_test
JWT_SECRET=test-jwt-secret-minimum-64-characters-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_REFRESH_SECRET=test-refresh-secret-minimum-64-characters-xxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_ACCESS_EXPIRES_IN=10m
JWT_REFRESH_EXPIRES_IN=30d
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=silent
CONTACT_EMAIL=test@test.com
```

> `LOG_LEVEL=silent` suppresses all pino output during tests to keep Jest output readable.

### 4.2 Integration Test Database Setup

Integration tests connect to a real local MySQL database named `bank_test`. This database must exist before running integration tests:

```sql
CREATE DATABASE IF NOT EXISTS bank_test;
```

`tests/integration/setup/db.js` exports helpers used in each test file:

```js
const { sequelize } = require('../../src/config/db');

// Call in beforeAll — drops and recreates all tables using model definitions
async function resetDatabase() {
  await sequelize.sync({ force: true });
  // force: true is ONLY used here in test setup — never in application code
}

// Call in afterAll — drops all tables and closes connection
async function teardownDatabase() {
  await sequelize.drop();
  await sequelize.close();
}

module.exports = { resetDatabase, teardownDatabase };
```

Each integration test file calls `resetDatabase()` in `beforeAll` and `teardownDatabase()` in `afterAll`. Each test or group seeds only the data it needs via `tests/integration/helpers/seed.helper.js`.

### 4.3 Jest Configuration

**`jest.config.js`** (root — runs unit + integration together):
```js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js'],
  setupFiles: ['dotenv/config'],
  globalSetup: './tests/integration/setup/db.js',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/db.js',       // excluded — DB bootstrapping
    '!src/app.js',             // excluded — Express wiring tested implicitly
    '!src/types/**'            // excluded — JSDoc only, no executable code
  ],
  coverageThresholds: {
    global: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    }
  }
};
```

**`jest.unit.config.js`**:
```js
module.exports = {
  ...require('./jest.config.js'),
  testMatch: ['**/tests/unit/**/*.test.js'],
  collectCoverage: false
};
```

**`jest.integration.config.js`**:
```js
module.exports = {
  ...require('./jest.config.js'),
  testMatch: ['**/tests/integration/**/*.test.js'],
  testTimeout: 20000,   // allow for DB reset on each file
  collectCoverage: false
};
```

### 4.4 E2E — Staging Environment

Playwright tests require:
- `STAGING_BASE_URL` — base URL of the deployed staging backend (e.g. `https://staging-api.yourdomain.com`)
- `STAGING_ADMIN_BANK_USER_ID` — seed admin `bankUserId` on staging (`10000001`)
- `STAGING_ADMIN_PASSWORD` — seed admin password (`Admin@12345`)

All stored as GitHub Actions Secrets (Section 11.3). Never committed to the repository.

**`tests/e2e/playwright.config.js`**:
```js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e/flows',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.STAGING_BASE_URL,
    extraHTTPHeaders: { 'Content-Type': 'application/json' }
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
});
```

---

## 5. Unit Tests

### 5.1 `tests/unit/utils/encryption.test.js`

| Test case | Assertion |
|---|---|
| `encrypt(plaintext)` returns `iv:authTag:ciphertext` format | String contains exactly 2 colons, all segments are non-empty hex |
| `decrypt(encrypt(value))` equals original plaintext | Round-trip identity |
| Two `encrypt()` calls on same value produce different ciphertexts | IV is random per call |
| `hmacHash(value)` is deterministic | Same input always returns same 64-char hex string |
| `hmacHash(value)` output never equals input | Hash is not identity |
| `decrypt()` throws on tampered ciphertext | AES-GCM auth tag mismatch |

### 5.2 `tests/unit/utils/tokenHelpers.test.js`

| Test case | Assertion |
|---|---|
| `generateAccessToken(payload)` returns a valid JWT | `jwt.verify()` succeeds with `JWT_SECRET` |
| `generateRefreshToken(payload)` returns a valid JWT | `jwt.verify()` succeeds with `JWT_REFRESH_SECRET` |
| `verifyAccessToken(token)` returns decoded payload | `sub`, `role`, `bankUserId`, `mustChangePassword` all present |
| `verifyAccessToken(expiredToken)` throws error with code `TOKEN_EXPIRED` | Error code matches |
| `verifyAccessToken(tamperedToken)` throws error with code `TOKEN_INVALID` | Error code matches |
| `hashToken(rawToken)` returns a 64-char hex string | SHA-256 output length |
| `hashToken(rawToken)` is deterministic | Same input → same hash |

### 5.3 `tests/unit/utils/bankUserId.test.js`

| Test case | Assertion |
|---|---|
| `generateBankUserId()` returns an 8-digit numeric string | `/^\d{8}$/` passes |
| 1000 generated IDs have no duplicates | `new Set(ids).size === 1000` |

### 5.4 `tests/unit/utils/accountNumber.test.js`

| Test case | Assertion |
|---|---|
| `generateAccountNumber()` returns a 14-digit numeric string | `/^\d{14}$/` passes |
| 1000 generated numbers have no duplicates | `new Set(nums).size === 1000` |

### 5.5 `tests/unit/validators/`

For every Zod schema in `src/validators/`, test valid and invalid inputs:

| Schema | Valid case | Invalid cases to cover |
|---|---|---|
| `loginSchema` | correct bankUserId + password | missing bankUserId, empty password |
| `createUserSchema` | all required fields valid | missing email, invalid email format, password too short, missing phone |
| `createEmployeeSchema` | all fields including department | missing departmentName, missing departmentRegion, invalid departmentRole |
| `creditSchema` | positive amount + 14-digit accountNumber | amount = 0, amount negative, more than 2 decimal places, missing accountNumber |
| `debitSchema` | same as credit | same as credit |
| `transferSchema` | valid sourceAccountNumber + destinationAccountNumber + amount | same account numbers, missing destinationAccountNumber, amount = 0 |
| `changePasswordSchema` | currentPassword + newPassword valid | new password fails complexity (no uppercase, no number, no special char), too short |
| `contactSchema` | email + subject + message present | missing subject, invalid email, empty message |
| `paginationSchema` | page=1 limit=10 | page=0, limit=0, limit=101 (over max) |

### 5.6 `tests/unit/services/auth.service.test.js`

All repository calls mocked with `jest.mock('../../src/repositories/UserRepository')` etc. No DB, no file I/O.

| Test case | Assertion |
|---|---|
| Login with unknown bankUserId | Returns `INVALID_CREDENTIALS` (401) — does not leak existence |
| Login with inactive user (`isActive: false`) | Returns `ACCOUNT_INACTIVE` (400) |
| Login with locked user (`lockoutUntil` in future) | Returns `ACCOUNT_LOCKED` (401) with `remainingSeconds` |
| Login with wrong password (0 prior failures) | Calls `UserRepository.incrementFailedAttempts()`, returns `INVALID_CREDENTIALS` |
| Login with wrong password (4 prior failures → 5th) | Calls `UserRepository.lockUser()` with `now + 15min`, returns `INVALID_CREDENTIALS` |
| Login with correct password after lockout expired | Calls `UserRepository.resetLoginAttempts()`, returns `{ accessToken, mustChangePassword, user }` |
| Login success with `mustChangePassword: true` | Response includes `mustChangePassword: true` |
| Refresh with valid unrevoked token | Returns new `accessToken`, calls `RefreshTokenRepository.revokeToken()` on old token |
| Refresh with revoked token | Calls `RefreshTokenRepository.revokeFamilyByUserId()`, returns `TOKEN_REUSE_DETECTED` (401) |
| Logout | Calls `RefreshTokenRepository.revokeToken()`, does not throw |

### 5.7 `tests/unit/services/transaction.service.test.js`

All repositories mocked. Verify balance is never mutated when rules are violated.

| Test case | Assertion |
|---|---|
| Credit to non-existent account | Returns `ACCOUNT_NOT_FOUND` (404) |
| Credit to frozen account (`accountStatus !== 'active'`) | Returns `ACCOUNT_FROZEN` (403) |
| Credit valid → calls `AccountRepository.creditBalance()` with correct args | Mock called once with `(accountId, amount, t)` |
| Debit with account owned by different user (`account.userId !== req.user.id`) | Returns `ACCOUNT_NOT_OWNED` (403), `debitBalance` not called |
| Transfer with source account owned by different user | Returns `ACCOUNT_NOT_OWNED` (403), neither balance mutated |
| Transfer where source is owned by logged-in user, destination is not | Succeeds — destination ownership is not checked |
| Debit exact balance (result = 0.00) | Succeeds, `debitBalance` called |
| `debitBalance` SQL guard: 0 rows affected scenario | Service throws `INSUFFICIENT_FUNDS` |
| Transfer: same account (`sourceAccountNumber === destinationAccountNumber`) | Returns `SAME_ACCOUNT` (400) |
| Transfer: currency mismatch | Returns `CURRENCY_MISMATCH` (400) |
| Transfer: frozen source or destination account | Returns `ACCOUNT_FROZEN` (403) |
| Transfer: insufficient funds in source | Returns `INSUFFICIENT_FUNDS` (400) |
| Transfer valid → calls `debitBalance` + `creditBalance` both inside same transaction `t` | Both mocks called with matching `t` argument |
| Transfer valid → calls `TransactionRepository.create()` once with `type: 'transfer'` | Mock called once |
| Transfer valid → calls `NotificationRepository.create()` twice (sender + receiver) | Mock called exactly twice |

---

## 6. Integration Tests

Integration tests use the full Express `app` via Supertest against the real `bank_test` MySQL database. Each test file resets the DB schema and seeds its own minimal data.

### 6.1 `tests/integration/helpers/seed.helper.js`

Exports factory functions used across integration test files. Each function inserts rows directly via repositories (not via HTTP):

```js
createAdmin()         → inserts 1 admin user (no account), returns { user, token }
createEmployee()      → inserts 1 employee user (no account), returns { user, token }
createUser()          → inserts 1 user + account (balance 10000, EGP, saving, active), returns { user, account, token }
createUserWithBalance(amount, currency, accountType) → user + account with given params
loginAs(bankUserId, password) → POST /api/v1/auth/login, returns { accessToken, cookie }
```

All passwords are hashed with argon2 before insert. All sensitive fields encrypted per Phase 1 Section 10.

### 6.2 `tests/integration/auth.test.js`

| Test case | Expected status | Expected code |
|---|---|---|
| POST `/auth/login` valid credentials | 200 | — |
| POST `/auth/login` wrong password | 401 | `INVALID_CREDENTIALS` |
| POST `/auth/login` unknown bankUserId | 401 | `INVALID_CREDENTIALS` |
| POST `/auth/login` 5 wrong attempts → locked → 6th attempt | 401 | `ACCOUNT_LOCKED` — `error.details.remainingSeconds` present and > 0 |
| POST `/auth/login` inactive user (`isActive: false`) | 400 | `ACCOUNT_INACTIVE` |
| POST `/auth/login` success → `Set-Cookie` header contains `refreshToken` | 200 | cookie has `HttpOnly` flag |
| POST `/auth/login` success → response body has `accessToken` + `mustChangePassword` + `user` shape | 200 | — |
| POST `/auth/refresh` valid cookie | 200 | new `accessToken` in body |
| POST `/auth/refresh` no cookie | 401 | `TOKEN_INVALID` |
| POST `/auth/refresh` reuse revoked token (use token after it was already rotated) | 401 | `TOKEN_REUSE_DETECTED` |
| POST `/auth/refresh` expired token | 401 | `TOKEN_EXPIRED` |
| POST `/auth/logout` valid token + cookie | 200 | — |
| POST `/auth/logout` no token | 401 | `TOKEN_INVALID` |
| After logout: refresh with the same cookie | 401 | `TOKEN_INVALID` — token was revoked |

### 6.3 `tests/integration/profile.test.js`

| Test case | Expected |
|---|---|
| GET `/profile` authenticated user | 200 — contains `id, bankUserId, name, email, phone (decrypted), account.accountNumber (decrypted), account.balance as Number` |
| GET `/profile` no token | 401 `TOKEN_INVALID` |
| GET `/profile` employee → `department` object populated, not null | 200 |
| GET `/profile` user → `department` is null | 200 |
| PATCH `/profile` valid fields (`name`, `phone`) | 200 — updated fields reflected in subsequent GET |
| PATCH `/profile` with `bankUserId` in body | 200 — `bankUserId` unchanged in DB (immutable field silently ignored) |
| PATCH `/profile` with `role` in body | 200 — `role` unchanged in DB |
| PATCH `/profile/password` correct current password | 200 |
| PATCH `/profile/password` wrong current password | 401 `INVALID_CURRENT_PASSWORD` |
| PATCH `/profile/password` new password fails complexity | 400 `VALIDATION_ERROR` |
| After password change → login with old password fails | 401 `INVALID_CREDENTIALS` |
| After password change → login with new password succeeds | 200 |
| After password change → `mustChangePassword` = false in DB | DB assertion via repository |
| PATCH `/profile/password` with `mustChangePassword: true` token | 200 — this endpoint is exempt from `MUST_CHANGE_PASSWORD` block |
| Any other endpoint with `mustChangePassword: true` token | 403 `MUST_CHANGE_PASSWORD` |

### 6.4 `tests/integration/users.test.js`

| Test case | Actor | Expected |
|---|---|---|
| GET `/users` | admin | 200 — paginated list with correct `pagination.total`, `pagination.pages`, `data.length` |
| GET `/users?name=Mohamed` | admin | 200 — filtered, only matching names |
| GET `/users?role=user` | admin | 200 — only `role: 'user'` entries |
| GET `/users?bankUserId=30000001` | admin | 200 — single match |
| GET `/users` | regular user | 403 `FORBIDDEN` |
| GET `/users/:id` valid id | admin | 200 — `phone` decrypted, `accountNumber` decrypted, `balance` is Number |
| GET `/users/:id` non-existent id | admin | 404 `USER_NOT_FOUND` |
| POST `/users` valid body | admin | 201 — `bankUserId` auto-generated 8-digit string, `temporaryPassword` = `Bank@<bankUserId>`, `mustChangePassword: true` in DB |
| POST `/users` duplicate email | admin | 409 `EMAIL_EXISTS` |
| POST `/users` duplicate nationalId | admin | 409 `NATIONAL_ID_EXISTS` |
| POST `/users` missing required field | admin | 400 `VALIDATION_ERROR` |
| POST `/users` by employee | employee | 201 — employees can create users |
| POST `/employees` valid body | admin | 201 — `role: 'employee'`, `departmentStatus: 'active'`, `departmentSince` populated |
| POST `/employees` by employee | employee | 403 `FORBIDDEN` |
| PATCH `/users/:id` update `name` | admin | 200 — name updated in DB |
| PATCH `/users/:id` update `isActive: false` | admin | 200 — user can no longer log in (400 `ACCOUNT_INACTIVE`) |
| DELETE `/users/:id` | admin | 200 — user row deleted, account row deleted |
| DELETE `/users/:id` by employee | employee | 403 `FORBIDDEN` |
| DELETE last admin | admin | 409 `CANNOT_DELETE_ADMIN` |
| PATCH `/users/:id/unlock` locked user | admin | 200 — `failedLoginAttempts: 0`, `lockoutUntil: null` in DB |
| PATCH `/users/:id/unlock` by employee | employee | 403 `FORBIDDEN` |
| Pagination: 5 users, `?page=2&limit=2` | admin | `data.length: 2`, `pagination.total: 5`, `pagination.pages: 3` |

### 6.5 `tests/integration/transactions.test.js`

| Test case | Expected |
|---|---|
| GET `/accounts/lookup?accountNumber=<valid>` | 200 — `{ id, accountNumber (decrypted), currency, accountStatus, owner: { name, bankUserId } }` |
| GET `/accounts/lookup?accountNumber=<invalid>` | 404 `ACCOUNT_NOT_FOUND` |
| POST `/transactions/credit` valid | 200 — `balanceAfter = previousBalance + amount`, verified in DB |
| POST `/transactions/credit` frozen account | 403 `ACCOUNT_FROZEN` |
| POST `/transactions/debit` valid (sufficient funds) | 200 — `balanceAfter = previousBalance - amount`, verified in DB |
| POST `/transactions/debit` with another user's accountNumber | 403 `ACCOUNT_NOT_OWNED` — balance unchanged in DB |
| POST `/transactions/debit` admin calling with another user's account | 403 `ACCOUNT_NOT_OWNED` — ownership applies to all roles |
| POST `/transactions/transfer` with another user's sourceAccountNumber | 403 `ACCOUNT_NOT_OWNED` — both balances unchanged |
| POST `/transactions/transfer` where logged-in user owns source, not destination | 200 — destination has no ownership check |
| POST `/transactions/debit` exact balance (result = 0.00) | 200 — `balanceAfter: 0.00` |
| POST `/transactions/transfer` valid same-currency | 200 — sender balance decreased, receiver balance increased (both verified in DB) |
| POST `/transactions/transfer` currency mismatch | 400 `CURRENCY_MISMATCH` — both balances unchanged |
| POST `/transactions/transfer` same account | 400 `SAME_ACCOUNT` |
| POST `/transactions/transfer` insufficient funds | 400 `INSUFFICIENT_FUNDS` — sender balance unchanged |
| POST `/transactions/transfer` frozen source account | 403 `ACCOUNT_FROZEN` |
| POST `/transactions/transfer` frozen destination account | 403 `ACCOUNT_FROZEN` |
| GET `/transactions/history` — `amount` field | `typeof amount === 'number'` (not string) — DECIMAL returns as JS Number |
| GET `/transactions/history` transfer record — `destinationAccount` | Decrypted 14-digit account number string |
| GET `/transactions/history` credit/debit record — `destinationAccount` | `null` |
| GET `/transactions/history?type=credit` | All records have `type: 'credit'` |
| GET `/transactions/history?startDate=X&endDate=Y` | All records have `createdAt` within range |
| GET `/transactions/history?minAmount=100&maxAmount=500` | All records have `amount` between 100 and 500 |
| GET `/transactions/history?page=2&limit=2` with 5 records | `data.length: 2`, `pagination.total: 5`, `pagination.pages: 3` |
| GET `/transactions/history/:userId` by admin | 200 |
| GET `/transactions/history/:userId` by regular user | 403 `FORBIDDEN` |
| Notification row created after credit | DB assertion: 1 row in `notifications` table with `type: 'credit'` |
| Notification rows created after transfer | DB assertion: 2 rows in `notifications` table with `type: 'transfer'` (sender + receiver) |
| AuditEvent row created after transfer | DB assertion: 1 row in `audit_events` with `action: 'TRANSFER'` |
| Any endpoint called with `mustChangePassword: true` token (except password change) | 403 `MUST_CHANGE_PASSWORD` |

### 6.6 `tests/integration/contact.test.js`

| Test case | Expected |
|---|---|
| POST `/contact` valid body | 201 — row exists in `contact_messages` table |
| POST `/contact` missing subject | 400 `VALIDATION_ERROR` with `details` array containing `field: 'subject'` |
| POST `/contact` invalid email | 400 `VALIDATION_ERROR` with `details` array containing `field: 'email'` |
| POST `/contact` empty message | 400 `VALIDATION_ERROR` |

---

## 7. E2E Tests

### 7.1 Scope and Approach

Playwright E2E tests run against the live staging server after every successful deploy to `main`. They test complete user flows over real HTTP, including cookie handling for refresh tokens. All tests use Playwright's `request` fixture (API mode — no browser UI). They assert only on HTTP response shapes, not on DB state.

### 7.2 Global Setup (`tests/e2e/setup/global.setup.js`)

Before all E2E specs run:
1. Call `GET <STAGING_BASE_URL>/` and assert `{ status: 'ok' }` — abort with a clear error if staging is down
2. Login as staging admin using `STAGING_ADMIN_BANK_USER_ID` + `STAGING_ADMIN_PASSWORD`
3. Store the access token in Playwright storage state for reuse across specs

### 7.3 E2E Flows

**`auth.spec.js`**
1. Login with valid admin credentials → 200, `accessToken` in body, `refreshToken` cookie set with `HttpOnly` flag
2. Call `GET /api/v1/profile` with access token → 200
3. Call `POST /api/v1/auth/refresh` → 200, new `accessToken` returned
4. Reuse old refresh token after rotation → 401 `TOKEN_REUSE_DETECTED`
5. Login wrong password 5 times → 401 `ACCOUNT_LOCKED`, `error.details.remainingSeconds` present
6. Logout → 200, cookie cleared → refresh with cleared cookie → 401

**`userManagement.spec.js`**
1. Admin creates a new user → 201, `bankUserId` auto-generated, `temporaryPassword = Bank@<bankUserId>`
2. New user logs in with `Bank@<bankUserId>` → 200, `mustChangePassword: true`
3. New user calls `GET /api/v1/profile` → 403 `MUST_CHANGE_PASSWORD`
4. New user calls `PATCH /api/v1/profile/password` with temporaryPassword as `currentPassword` → 200
5. New user calls `GET /api/v1/profile` after password change → 200
6. Employee creates a new user → 201
7. Employee attempts to create an employee → 403 `FORBIDDEN`
8. Admin deletes the user created in step 1 → 200 → that user login → 401 `INVALID_CREDENTIALS`
9. Admin unlocks a locked E2E test account → 200 → locked user can log in again

**`transactions.spec.js`**
1. Credit E2E account 1 → 200, `balanceAfter` in response = known previous balance + amount
2. Debit E2E account 1 → 200, `balanceAfter` in response = previous balance - amount
3. Debit more than current balance → 400 `INSUFFICIENT_FUNDS`
5. E2E User One attempts to debit from E2E User Two's account → 403 `ACCOUNT_NOT_OWNED`
6. E2E User One attempts to transfer from E2E User Two's account → 403 `ACCOUNT_NOT_OWNED`
7. Transfer from E2E account 1 (EGP) to E2E account 2 (EGP) → 200
5. Transfer from E2E account 1 (EGP) to E2E account 3 (USD) → 400 `CURRENCY_MISMATCH`
6. GET `/transactions/history` → 200, paginated, `amount` is `Number`, correct shape
7. GET `/transactions/history?type=credit` → all records in response have `type: 'credit'`

**`passwordChange.spec.js`**
1. E2E user changes password with correct current password → 200
2. E2E user logs in with old password → 401 `INVALID_CREDENTIALS`
3. E2E user logs in with new password → 200
4. E2E user attempts password change with wrong current password → 401 `INVALID_CURRENT_PASSWORD`
5. Reset: change E2E user password back to original so the account is reusable on next run

### 7.4 E2E Isolation Rules

- Use E2E-dedicated accounts (Section 8.3) for all transaction and password tests
- Any user created during `userManagement.spec.js` must be deleted in `test.afterEach`
- The admin seed account (`bankUserId: 10000001`) must never be deleted or have its password permanently changed
- If staging data is corrupted, re-running `npm run seed:staging` resets it (see Section 8.4)

---

## 8. Seed Data Specification

### 8.1 Seed Script

- File: `scripts/seed.js`
- Command: `npm run seed`
- **Must refuse to run if `NODE_ENV=production`** — exit immediately with: `"ERROR: Seed script must not run in production."`
- Execution order:
  1. Delete all rows from: `contact_messages`, `audit_events`, `notifications`, `refresh_tokens`, `transactions`, `accounts`, `users` (in this order to respect FK constraints)
  2. Insert users, accounts, and transactions as specified below
- All passwords hashed with argon2 before insert
- All sensitive fields (`phone`, `nationalId`, `accountNumber`) encrypted with AES-GCM and their HMAC hashes stored per Phase 1 Section 10

### 8.2 Seeded Users

| # | Role | bankUserId | Password | Name | Currency | accountType | Starting Balance |
|---|---|---|---|---|---|---|---|
| 1 | admin | `10000001` | `Admin@12345` | Ahmed Hassan | EGP | saving | 10,000.00 |
| 2 | employee | `20000001` | `Employee@12345` | Sara Ali | — | — | — |
| 3 | employee | `20000002` | `Employee@12345` | Omar Khaled | — | — | — |
| 4 | user | `30000001` | `User@12345` | Mohamed Ibrahim | EGP | saving | 10,000.00 |
| 5 | user | `30000002` | `User@12345` | Nour Mahmoud | EGP | saving | 10,000.00 |
| 6 | user | `30000003` | `User@12345` | Yasmine Samir | USD | saving | 10,000.00 |
| 7 | user | `30000004` | `User@12345` | Karim Adel | EUR | saving | 10,000.00 |
| 8 | user | `30000005` | `User@12345` | Layla Fathy | EUR | saving | 10,000.00 |

- Employees have no accounts (Phase 1 Section 8.3 specifies: "No account is created for employees")
- All seeded users have `mustChangePassword: false` — pre-activated accounts
- `createdBy` for all seed users is `null` — system-created

### 8.3 E2E-Dedicated Staging Accounts

These accounts are created by the seed script alongside the main seed users. Used exclusively by Playwright E2E tests:

| # | Role | bankUserId | Password | Name | Currency | accountType | Balance |
|---|---|---|---|---|---|---|---|
| E1 | user | `39900001` | `E2eUser@12345` | E2E User One | EGP | saving | 50,000.00 |
| E2 | user | `39900002` | `E2eUser@12345` | E2E User Two | EGP | saving | 50,000.00 |
| E3 | user | `39900003` | `E2eUser@12345` | E2E User Three | USD | saving | 50,000.00 |

High starting balance (50,000) ensures E2E transaction tests never hit `INSUFFICIENT_FUNDS` unexpectedly. `mustChangePassword: false` for all E2E accounts.

### 8.4 Seeded Transactions (20 total)

Distributed across user accounts only (employees have no accounts):

| Count | Type | Pairs | Amount range | Currency |
|---|---|---|---|---|
| 7 | credit | Various user accounts | 500–2,000 | Matching account currency |
| 7 | debit | Various user accounts | 200–1,000 | Matching account currency |
| 6 | transfer | Same-currency pairs only | 100–800 | EGP↔EGP, USD↔USD, EUR↔EUR |

After all transactions, the seed script must:
1. Compute the correct final balance for each account
2. Update each account's `balance` column in MySQL to reflect the final state
3. Store the correct `balanceAfter` on every transaction row at the time of insert

### 8.5 Staging Seed Command

```bash
NODE_ENV=staging npm run seed
```

The seed script treats `NODE_ENV=staging` the same as `NODE_ENV=development` — it runs normally. Only `NODE_ENV=production` is blocked.

---

## 9. Coverage Requirements

### 9.1 Enforced Thresholds (CI fails if below)

| Metric | Threshold |
|---|---|
| Statements | 90% |
| Branches | 85% |
| Functions | 90% |
| Lines | 90% |

### 9.2 Coverage Scope

Collected from `src/**/*.js` with these exclusions (defined in `jest.config.js`):

| Excluded path | Reason |
|---|---|
| `src/config/db.js` | Sequelize bootstrapping — tested implicitly via integration tests |
| `src/app.js` | Express wiring — tested implicitly via Supertest |
| `src/types/**` | JSDoc only — no executable code |

### 9.3 Coverage Report Formats

- Generated on every `npm run test:coverage` run
- Output directory: `coverage/` (gitignored)
- Formats: `text` (terminal output), `lcov` (for CI artifact upload), `html` (for local inspection)
- In CI: uploaded as a workflow artifact after every run on `main`, retained for 14 days
- Pipeline fails immediately if any threshold is not met — does not proceed to build or deploy

---

## 10. Test Commands

```bash
# Run all tests (unit + integration) with coverage enforcement
npm test

# Run unit tests only (no coverage)
npm run test:unit

# Run integration tests only (no coverage)
npm run test:int

# Run all tests with coverage report
npm run test:coverage

# Run E2E tests against staging (requires STAGING_BASE_URL env var)
npm run test:e2e

# Run E2E tests with Playwright UI for local debugging
npm run test:e2e:ui

# Watch mode for unit tests during development
npm run test:watch
```

**`package.json` scripts:**
```json
{
  "scripts": {
    "test": "jest --config jest.config.js",
    "test:unit": "jest --config jest.unit.config.js",
    "test:int": "jest --config jest.integration.config.js",
    "test:coverage": "jest --config jest.config.js --coverage",
    "test:e2e": "playwright test --config tests/e2e/playwright.config.js",
    "test:e2e:ui": "playwright test --config tests/e2e/playwright.config.js --ui",
    "test:watch": "jest --config jest.unit.config.js --watch",
    "seed": "node scripts/seed.js",
    "seed:staging": "NODE_ENV=staging node scripts/seed.js"
  }
}
```

---

## 11. CI Pipeline — GitHub Actions

### 11.1 Trigger Conditions

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

Deploy and E2E stages only run on push to `main`. PR builds run only lint + unit + integration + build check.

### 11.2 Full Pipeline Definition

File: `.github/workflows/ci-cd.yml`

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # ── Stage 1: Lint ────────────────────────────────────────────────
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check

  # ── Stage 2: Unit Tests ──────────────────────────────────────────
  unit-tests:
    name: Unit Tests
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit
        env:
          NODE_ENV: test
          JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}
          JWT_REFRESH_SECRET: ${{ secrets.TEST_JWT_REFRESH_SECRET }}
          ENCRYPTION_KEY: ${{ secrets.TEST_ENCRYPTION_KEY }}
          LOG_LEVEL: silent

  # ── Stage 3: Integration Tests ───────────────────────────────────
  integration-tests:
    name: Integration Tests
    needs: unit-tests
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: ${{ secrets.TEST_DB_PASSWORD }}
          MYSQL_DATABASE: bank_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping -h localhost"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'npm'
      - run: npm ci
      - name: Run integration tests with coverage
        run: npm run test:coverage
        env:
          NODE_ENV: test
          DB_HOST: 127.0.0.1
          DB_PORT: 3306
          DB_NAME: bank_test
          DB_USER: root
          DB_PASSWORD: ${{ secrets.TEST_DB_PASSWORD }}
          DB_NAME_TEST: bank_test
          JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}
          JWT_REFRESH_SECRET: ${{ secrets.TEST_JWT_REFRESH_SECRET }}
          ENCRYPTION_KEY: ${{ secrets.TEST_ENCRYPTION_KEY }}
          LOG_LEVEL: silent
          CORS_ORIGINS: http://localhost:3000
          CONTACT_EMAIL: test@test.com
      - name: Upload coverage report
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 14

  # ── Stage 4: Build Check ─────────────────────────────────────────
  build:
    name: Build Check
    needs: integration-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'npm'
      - run: npm ci --omit=dev
      - name: Verify entry point loads
        run: node -e "require('./src/app.js')" && echo "App loaded successfully"

  # ── Stage 5: Deploy to EC2 (main only) ───────────────────────────
  deploy:
    name: Deploy to EC2
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/bank-backend
            git pull origin main
            npm ci --omit=dev
            pm2 reload bank-backend --update-env
            pm2 save

  # ── Stage 6: E2E Tests against Staging (main only) ───────────────
  e2e-tests:
    name: E2E Tests (Staging)
    needs: deploy
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Wait for staging to be healthy
        run: |
          for i in {1..12}; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" $STAGING_BASE_URL/)
            if [ "$STATUS" = "200" ]; then echo "Staging is up"; break; fi
            echo "Attempt $i — waiting for staging..."
            sleep 5
          done
        env:
          STAGING_BASE_URL: ${{ secrets.STAGING_BASE_URL }}
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          STAGING_BASE_URL: ${{ secrets.STAGING_BASE_URL }}
          STAGING_ADMIN_BANK_USER_ID: ${{ secrets.STAGING_ADMIN_BANK_USER_ID }}
          STAGING_ADMIN_PASSWORD: ${{ secrets.STAGING_ADMIN_PASSWORD }}
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### 11.3 GitHub Actions Secrets Required

| Secret name | Used by | Description |
|---|---|---|
| `TEST_JWT_SECRET` | unit + integration jobs | Min 64-char string for test JWT signing |
| `TEST_JWT_REFRESH_SECRET` | unit + integration jobs | Min 64-char string for test refresh signing |
| `TEST_ENCRYPTION_KEY` | unit + integration jobs | 64 hex chars for test AES encryption |
| `TEST_DB_PASSWORD` | integration job | MySQL root password for the CI MySQL service container |
| `EC2_HOST` | deploy job | Public IP or DNS of the EC2 instance |
| `EC2_USER` | deploy job | SSH username (e.g. `ubuntu`) |
| `EC2_SSH_PRIVATE_KEY` | deploy job | PEM private key for SSH access to EC2 |
| `STAGING_BASE_URL` | E2E job | Full base URL of staging backend (e.g. `https://staging-api.yourdomain.com`) |
| `STAGING_ADMIN_BANK_USER_ID` | E2E job | Staging seed admin bankUserId (`10000001`) |
| `STAGING_ADMIN_PASSWORD` | E2E job | Staging seed admin password (`Admin@12345`) |

### 11.4 Branch Protection Rules (GitHub Settings)

Configure under **Settings → Branches → main**:
- Required status checks before merging: `lint`, `unit-tests`, `integration-tests`, `build`
- Require branches to be up to date before merging
- Do not allow bypassing above settings (applies to admins too)

---

## 12. AWS Infrastructure

### 12.1 Architecture Overview

```
Internet
    │
    ▼
[Route 53 / DNS] ──→ A record → EC2 Elastic IP
                                    │
                                [Nginx]
                                port 80 → redirect 301 to 443
                                port 443 → proxy_pass → localhost:5000
                                    │
                                [PM2 cluster]
                                Node.js app on port 5000
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
           [Amazon RDS for MySQL]          [AWS Secrets Manager]
           (private subnet, TLS)           (secrets injected at startup)
                    │
           [CloudWatch Logs Agent]
           (pino JSON logs → CloudWatch log group /bank-backend/production)
```

### 12.2 EC2 Instance Specification

| Property | Value |
|---|---|
| Instance type | t3.small (2 vCPU, 2GB RAM) |
| AMI | Ubuntu 22.04 LTS (latest) |
| Root volume | 20 GB gp3 SSD |
| Elastic IP | Yes — attach immediately after launch; never changes |
| Key pair | Dedicated key pair for this project; private key stored only in GitHub Secrets (`EC2_SSH_PRIVATE_KEY`) |
| IAM Instance Profile | Attach a role with `secretsmanager:GetSecretValue` on the production secret ARN only (see Section 13.3) |
| Region | Same region as the RDS instance to minimize latency |

### 12.3 Amazon RDS for MySQL Specification

| Property | Value |
|---|---|
| Engine | MySQL 8.0 |
| Instance class | db.t3.micro (sufficient for MVP) |
| Storage | 20 GB gp2 SSD, storage autoscaling enabled |
| Multi-AZ | Disabled for MVP — enable when moving to production at scale |
| Automated backups | Enabled — 7-day retention |
| Subnet group | Private subnet — no public accessibility |
| Security group | Allow inbound port 3306 from EC2 security group only |
| Parameter group | Set `require_secure_transport=ON` to enforce TLS connections |
| Database name | `bank` |

> The application connects to RDS using `DB_HOST` (the RDS endpoint), `DB_PORT: 3306`, `DB_NAME: bank`, `DB_USER`, and `DB_PASSWORD` — all injected from AWS Secrets Manager at startup.

### 12.4 Required AWS Services

| Service | Purpose |
|---|---|
| EC2 (t3.small) | Runs Node.js backend via PM2 |
| Elastic IP | Static IP for EC2 |
| Amazon RDS (MySQL 8.0) | Production MySQL database |
| AWS Secrets Manager | Stores all production secrets |
| CloudWatch Logs | Receives pino JSON logs |
| CloudWatch Alarms | CPU, error rate, auth failure alerts |
| Route 53 (optional) | DNS if you own a domain |

### 12.5 Software Stack on EC2

Install once on first provision via `scripts/provision.sh`:

```bash
#!/bin/bash
# Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm install --lts
nvm alias default lts/*

# PM2
npm install -g pm2
pm2 startup systemd   # run the printed command to enable auto-start on reboot

# Nginx
apt-get install -y nginx

# Certbot (Let's Encrypt)
apt-get install -y certbot python3-certbot-nginx

# CloudWatch Agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb

# Git
apt-get install -y git
```

Application is cloned to `/var/www/bank-backend`.

---

## 13. Secrets Management

### 13.1 Strategy

All production secrets are stored in a single AWS Secrets Manager secret named `bank-backend/production`. The application fetches them at startup via the AWS SDK. No `.env` file exists on the production EC2 instance.

### 13.2 Secret JSON (stored in AWS Secrets Manager)

```json
{
  "NODE_ENV": "production",
  "PORT": "5000",
  "DB_HOST": "<rds-endpoint>.rds.amazonaws.com",
  "DB_PORT": "3306",
  "DB_NAME": "bank",
  "DB_USER": "<db_username>",
  "DB_PASSWORD": "<db_password>",
  "JWT_SECRET": "<min 64 char string>",
  "JWT_REFRESH_SECRET": "<min 64 char string>",
  "JWT_ACCESS_EXPIRES_IN": "10m",
  "JWT_REFRESH_EXPIRES_IN": "30d",
  "ENCRYPTION_KEY": "<64 hex chars>",
  "CORS_ORIGINS": "https://<your-vercel-domain>.vercel.app",
  "LOG_LEVEL": "info",
  "CONTACT_EMAIL": "mbadwy480@gmail.com"
}
```

### 13.3 IAM Policy for EC2 Instance Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:<region>:<account-id>:secret:bank-backend/production*"
    }
  ]
}
```

No other permissions. Least-privilege principle.

### 13.4 Secret Injection at Startup (`src/config/index.js`)

```js
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function loadConfig() {
  if (process.env.NODE_ENV === 'production') {
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: 'bank-backend/production' })
    );
    const secrets = JSON.parse(response.SecretString);
    Object.assign(process.env, secrets);
  } else {
    require('dotenv').config({
      path: `.env.${process.env.NODE_ENV || 'development'}`
    });
  }
  return validateAndFreeze(process.env); // Zod validation + Object.freeze
}
```

`AWS_REGION` and `NODE_ENV=production` are the only values set directly on the EC2 instance via `/etc/environment` — all other secrets come from Secrets Manager.

> **Note:** `@aws-sdk/client-secrets-manager` must be added to `package.json` dependencies when implementing production config loading. This is the only library addition permitted beyond Phase 1 Section 2 — it is required for production secrets injection.

---

## 14. Networking & Security Groups

### 14.1 EC2 Security Group Rules

| Direction | Protocol | Port | Source | Purpose |
|---|---|---|---|---|
| Inbound | TCP | 80 | 0.0.0.0/0 | Nginx HTTP (redirects to HTTPS) |
| Inbound | TCP | 443 | 0.0.0.0/0 | Nginx HTTPS |
| Inbound | TCP | 22 | Your static IP only | SSH for admin + CI deploy |
| Outbound | All | All | 0.0.0.0/0 | RDS, AWS APIs, npm |

**Port 5000 must NOT be open to the internet.** Only Nginx (localhost) proxies to it.

### 14.2 RDS Security Group Rules

| Direction | Protocol | Port | Source | Purpose |
|---|---|---|---|---|
| Inbound | TCP | 3306 | EC2 security group ID | MySQL access from EC2 only |
| Outbound | All | All | 0.0.0.0/0 | Standard outbound |

RDS must have **no public accessibility** enabled. It is only reachable from the EC2 instance within the same VPC.

### 14.3 SSH Hardening on EC2

Add to `/etc/ssh/sshd_config`:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AllowUsers ubuntu
```

Reload: `systemctl reload sshd`

---

## 15. Nginx & HTTPS

### 15.1 Nginx Configuration

File: `/etc/nginx/sites-available/bank-backend`

```nginx
server {
    listen 80;
    server_name <your-domain>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name <your-domain>;

    ssl_certificate     /etc/letsencrypt/live/<your-domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<your-domain>/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable: `ln -s /etc/nginx/sites-available/bank-backend /etc/nginx/sites-enabled/`
Test: `nginx -t`
Reload: `systemctl reload nginx`

### 15.2 Let's Encrypt SSL Certificate

```bash
# Issue certificate (run once after DNS propagates to EC2 Elastic IP)
certbot --nginx -d <your-domain> --non-interactive --agree-tos -m <your-email>

# Verify auto-renewal timer is active
systemctl status certbot.timer
```

### 15.3 Express Trust Proxy

Required in `src/app.js` because Nginx sits in front of Express. Without this, `req.ip` returns the wrong IP and secure cookie flags may not work:

```js
app.set('trust proxy', 1);
```

---

## 16. Deployment Procedure

### 16.1 First-Time Server Provisioning (one-time, manual)

```bash
# 1. SSH into fresh EC2 instance
ssh -i <key.pem> ubuntu@<ec2-elastic-ip>

# 2. Run provision script
bash scripts/provision.sh

# 3. Clone repository
cd /var/www
git clone https://github.com/<org>/bank-backend.git
cd bank-backend

# 4. Install production dependencies
npm ci --omit=dev

# 5. Set the two non-secret env vars required before Secrets Manager loads
echo 'AWS_REGION=<your-region>' | sudo tee -a /etc/environment
echo 'NODE_ENV=production' | sudo tee -a /etc/environment
source /etc/environment

# 6. Start with PM2
pm2 start pm2.config.js --env production
pm2 save
pm2 startup systemd  # run the printed command

# 7. Configure Nginx (paste config from Section 15.1, replace <your-domain>)
nginx -t && systemctl reload nginx

# 8. Issue SSL certificate (Section 15.2)

# 9. Seed staging data ONCE (staging only — never run in production)
NODE_ENV=staging npm run seed
```

### 16.2 Routine Deploy (automated via GitHub Actions)

Every push to `main` that passes all CI stages triggers the deploy job, which SSHs into EC2 and runs:

```bash
cd /var/www/bank-backend
git pull origin main
npm ci --omit=dev
pm2 reload bank-backend --update-env
pm2 save
```

`pm2 reload` performs zero-downtime restart: starts new workers, waits for ready, stops old workers.

### 16.3 PM2 Configuration (`pm2.config.js`)

```js
module.exports = {
  apps: [{
    name: 'bank-backend',
    script: 'server.js',
    instances: 2,              // 2 workers = 2 vCPUs on t3.small
    exec_mode: 'cluster',
    max_memory_restart: '400M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      AWS_REGION: '<your-region>'
    }
  }]
};
```

---

## 17. Monitoring & Alerting

### 17.1 CloudWatch Logs Agent Config

File: `/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json`

```json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/www/bank-backend/logs/app.log",
            "log_group_name": "/bank-backend/production",
            "log_stream_name": "{instance_id}/app",
            "timezone": "UTC"
          }
        ]
      }
    }
  }
}
```

Start agent:
```bash
amazon-cloudwatch-agent-ctl -a start \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
```

### 17.2 CloudWatch Metric Filters

Create on the `/bank-backend/production` log group. Pino logs JSON — filter on JSON fields:

| Filter name | Pattern | Metric namespace/name |
|---|---|---|
| `ErrorCount` | `{ $.level = 50 }` | `BankBackend/ErrorCount` |
| `AuthFailures` | `{ $.err.code = "INVALID_CREDENTIALS" }` | `BankBackend/AuthFailures` |
| `TokenReuse` | `{ $.err.code = "TOKEN_REUSE_DETECTED" }` | `BankBackend/TokenReuseDetected` |
| `InsufficientFunds` | `{ $.err.code = "INSUFFICIENT_FUNDS" }` | `BankBackend/InsufficientFunds` |

> Pino error level is numeric `50`. Filter uses `$.level = 50` not `$.level = "error"`.

### 17.3 CloudWatch Alarms

Create an SNS topic `bank-backend-alerts` and subscribe your email address. All alarms publish to this topic:

| Alarm name | Metric | Condition | Period |
|---|---|---|---|
| `HighCPU` | `AWS/EC2 CPUUtilization` | > 80% | 5 minutes |
| `HighErrorRate` | `BankBackend/ErrorCount` | > 10 | 5 minutes |
| `AuthFailureSpike` | `BankBackend/AuthFailures` | > 20 | 5 minutes |
| `TokenReuseAlert` | `BankBackend/TokenReuseDetected` | >= 1 | 5 minutes |
| `EC2StatusCheck` | `AWS/EC2 StatusCheckFailed` | >= 1 | 1 minute |

### 17.4 Health Check Monitoring

Set up an external uptime monitor (UptimeRobot free tier or AWS CloudWatch Synthetics) to poll `GET <domain>/` every 5 minutes. Alert if response is non-200 or latency exceeds 10 seconds.

---

## 18. Rollback Procedure

### 18.1 Standard Rollback (bad deploy on main)

1. Identify the last known-good commit: `git log --oneline main | head -10`
2. Create a revert commit on a local branch: `git revert <bad-commit-hash> --no-edit`
3. Push to main: `git push origin main`
4. The full CI/CD pipeline re-runs automatically — if lint + unit + integration + build pass, the revert deploys to EC2
5. Verify: `GET <domain>/` returns `{ status: 'ok' }` and CloudWatch error rate drops

### 18.2 Emergency Manual Rollback (pipeline is broken)

```bash
# SSH into EC2
ssh -i <key.pem> ubuntu@<ec2-elastic-ip>

cd /var/www/bank-backend

# Find last good commit
git log --oneline | head -10

# Check out last good commit (detached HEAD)
git checkout <last-good-commit-hash>

# Reinstall deps in case package.json changed
npm ci --omit=dev

# Zero-downtime reload
pm2 reload bank-backend --update-env

# Verify
curl http://localhost:5000/
```

After stabilizing, fix the pipeline issue on a feature branch and merge a proper fix to `main`.

### 18.3 Database Rollback Policy

There is no automated database rollback. Rules to prevent needing one:

- Schema changes are additive only — new optional columns, never drop or rename existing columns
- `sequelize.sync({ force: false, alter: false })` never modifies existing tables automatically
- If a deploy introduces a data corruption bug: revert code first (Section 18.1), then use RDS point-in-time recovery to restore the database to the state before the bad deploy
- RDS automated backups are retained for 7 days — point-in-time recovery is available for any moment within that window

---

## 19. Phase 2 Verification Checklist

### Testing

- [ ] `npm run test:unit` passes — 0 failures, no DB connections opened
- [ ] `npm run test:int` passes — 0 failures against `bank_test` MySQL database
- [ ] `npm run test:coverage` meets all 4 thresholds: statements 90%, branches 85%, functions 90%, lines 90%
- [ ] Integration test DB setup: `sequelize.sync({ force: true })` in `beforeAll` creates all 7 tables correctly
- [ ] Integration test teardown: all tables dropped in `afterAll` — no orphaned data between test files
- [ ] Running test files in any order produces the same result (no test ordering dependency)
- [ ] Refresh token reuse test: use old token after rotation → 401 `TOKEN_REUSE_DETECTED`
- [ ] Lockout test: 5 failed logins → 401 `ACCOUNT_LOCKED` with `remainingSeconds` in `error.details`
- [ ] Ownership tests pass: debit/transfer with another user's source account → 403 `ACCOUNT_NOT_OWNED` for all roles including admin
- [ ] Transfer atomicity: verified via forced mid-transfer failure — both balances roll back
- [ ] `amount` in transaction history response is `typeof 'number'` (not string)
- [ ] `destinationAccount` in transfer history is decrypted 14-digit string; `null` for credit/debit
- [ ] `mustChangePassword` tests pass: blocked endpoints return 403, password change endpoint exempt
- [ ] Pagination test: `total`, `pages`, `data.length` all correct for a known dataset
- [ ] `npm run test:e2e` passes — all 4 Playwright spec files green against staging
- [ ] Playwright report artifact uploaded to GitHub Actions after E2E run
- [ ] Coverage report artifact uploaded to GitHub Actions after integration run on `main`

### CI Pipeline

- [ ] Pipeline triggers on push to `main` and PR to `main`
- [ ] Stage order enforced: lint → unit → integration → build → deploy → E2E
- [ ] Deploy and E2E jobs are skipped on PRs — run only on push to `main`
- [ ] Integration job spins up MySQL 8.0 service container successfully
- [ ] All 10 GitHub Actions secrets are set in repository settings
- [ ] Branch protection on `main` requires `lint`, `unit-tests`, `integration-tests`, `build` to pass
- [ ] A test PR with a failing unit test correctly blocks merge

### AWS & Deployment

- [ ] EC2 instance is running and reachable at its Elastic IP
- [ ] RDS MySQL instance is running in a private subnet — not publicly accessible
- [ ] EC2 can connect to RDS: `mysql -h <rds-endpoint> -u <user> -p bank` succeeds from EC2
- [ ] `GET /` returns `{ status: 'ok', uptime, version }` over HTTPS
- [ ] HTTP (port 80) redirects to HTTPS (301)
- [ ] Port 5000 is not accessible from outside EC2 (curl from external IP times out)
- [ ] Port 3306 (RDS) is not accessible from outside the VPC
- [ ] SSH password authentication disabled on EC2
- [ ] AWS Secrets Manager secret `bank-backend/production` exists with all required keys
- [ ] EC2 IAM role has only `secretsmanager:GetSecretValue` on the production secret ARN
- [ ] `GET /api/v1/docs` returns 404 in production
- [ ] PM2 restarts automatically after EC2 reboot (tested by rebooting the instance)
- [ ] CloudWatch Logs agent is running: `systemctl status amazon-cloudwatch-agent`
- [ ] Pino logs appear in CloudWatch log group `/bank-backend/production` after a real request
- [ ] All 5 CloudWatch Alarms are in `OK` state after a clean deploy
- [ ] SNS email subscription confirmed — test alarm notification received
- [ ] Routine deploy: `git push origin main` → pipeline green → `pm2 reload` executed → zero downtime verified
- [ ] SSL certificate valid and auto-renewal timer active: `systemctl status certbot.timer`
- [ ] Seed data present on staging: 8 users, 3 E2E accounts, 20 transactions verified in RDS
- [ ] Seed script returns error and exits when `NODE_ENV=production`

---

## 20. Claude Code Implementation Rules

These rules are non-negotiable. Claude Code must follow every rule below without exception.

### 20.1 Source of Truth

- Phase 2 spec and Phase 1 spec together are the **only** sources of truth
- Do not add test cases, seed records, CI steps, or infrastructure components not explicitly specified here
- If a genuine ambiguity is found, stop and ask — do not resolve by assumption

### 20.2 Build Order — Strict, No Skipping

Build in this exact order. Do not start a step until the previous step is confirmed:

1. Install test dependencies: `jest`, `supertest`, `sequelize-mock`, `@playwright/test` (and `@aws-sdk/client-secrets-manager` for production config)
2. Create `.env.test` file (Section 4.1)
3. Create `tests/integration/setup/db.js` with `resetDatabase()` and `teardownDatabase()` (Section 4.2)
4. Create `tests/integration/helpers/seed.helper.js` (Section 6.1)
5. Create `tests/integration/helpers/auth.helper.js`
6. Write all unit tests — `tests/unit/` (Sections 5.1–5.7)
7. Write all integration tests — `tests/integration/` (Sections 6.2–6.6)
8. Run `npm run test:coverage` — fix all failures until all 4 thresholds pass
9. Write seed script `scripts/seed.js` (Section 8)
10. Write all E2E tests — `tests/e2e/` (Section 7)
11. Create `jest.config.js`, `jest.unit.config.js`, `jest.integration.config.js` (Section 4.3)
12. Create `.github/workflows/ci-cd.yml` (Section 11.2)
13. Set all 10 GitHub Actions secrets (Section 11.3)
14. Provision EC2 instance via `scripts/provision.sh` (Section 12.5)
15. Provision RDS MySQL instance per Section 12.3 specifications
16. Configure AWS Secrets Manager secret `bank-backend/production` (Section 13.2)
17. Configure EC2 IAM role with least-privilege policy (Section 13.3)
18. Configure EC2 security group and RDS security group (Section 14)
19. Configure Nginx and issue SSL certificate (Section 15)
20. First-time server provisioning and staging seed (Section 16.1)
21. Run every item in Section 19 checklist — fix all failures before stopping

### 20.3 Testing Rules

- `sequelize.sync({ force: true })` is permitted **only** inside `tests/integration/setup/db.js` — never in any other file
- Unit tests must have zero real I/O — mock all repositories with `jest.mock()`
- Never import a Sequelize model in a test file — use repository instances or Supertest
- Integration tests must clean up after themselves — no shared mutable state between test files
- Never hardcode a real `bankUserId`, email, or account number in test assertions — use values from seed helpers
- E2E tests must use dedicated E2E accounts (Section 8.3) for destructive operations — never use the shared seed admin

### 20.4 Infrastructure Rules

- Never open port 5000 to the internet on the EC2 security group
- Never enable public accessibility on the RDS instance
- Never store secrets in `.env` files on the EC2 server
- Never run `npm run seed` with `NODE_ENV=production`
- The RDS security group must only allow inbound port 3306 from the EC2 security group ID — not from `0.0.0.0/0`
- `pm2 reload` (zero-downtime) must be used for all deploys — never `pm2 restart`

### 20.5 Step Completion Protocol

After completing each step in Section 20.2, Claude Code must:
1. State: "Step N complete — [list files created/modified]"
2. List any spec ambiguity encountered and how it was resolved (or flag it for review)
3. Ask: "Confirm to proceed to Step N+1?"
4. Wait for explicit confirmation before proceeding

Do not batch multiple steps. Do not proceed without confirmation.
