# Armour Care — Security Document

**Last updated:** March 2026

---

## Overview

Armour Care is a wellbeing survey platform deployed as a Progressive Web App (PWA) at `armourcare.uk`. This document describes the security measures in place to protect user data, admin access, and the application infrastructure.

---

## 1. Authentication

### 1.1 Password Hashing

All passwords (user and admin) are hashed using **bcrypt** with a cost factor of 12 rounds before storage. Bcrypt is an industry-standard adaptive hashing algorithm specifically designed for passwords — it is intentionally slow, making brute-force and rainbow table attacks impractical.

- **New accounts:** Passwords are hashed with bcrypt at signup/creation time.
- **Legacy accounts:** Any accounts created before the bcrypt migration used SHA-256 hashing. These are **automatically upgraded** to bcrypt on the next successful login — the user does not need to take any action.
- **No plaintext storage:** Passwords are never stored or logged in plaintext. The `passwordHash` field is stripped from all API responses before being sent to the client.

### 1.2 JSON Web Tokens (JWT)

All authenticated API requests use **JWT bearer tokens** for session management.

- **Token issuance:** A signed JWT is returned on successful login or signup.
- **Token lifetime:** Tokens expire after **7 days**, after which the user must log in again.
- **Token signing:** Tokens are signed with a 512-bit random secret generated on first server start and persisted in a restricted file (`.jwt-secret`, mode `0600`).
- **Token verification:** Every admin API endpoint extracts the token from the `Authorization: Bearer <token>` header and verifies it before processing the request.
- **Token payload:** Contains only the user/admin ID and role (`user` or `admin`). No sensitive data is stored in the token.

### 1.3 Rate Limiting

Login endpoints are protected by an **in-memory rate limiter** to prevent brute-force attacks.

- **Window:** 1 minute
- **Max attempts:** 10 per IP address per window
- **Scope:** Separate rate limit buckets for user login (`/api/login`) and admin login (`/api/admin/login`)
- **Response:** Returns HTTP 429 (Too Many Requests) when the limit is exceeded
- **Cleanup:** Stale rate limit entries are automatically purged every 5 minutes

---

## 2. Authorisation

### 2.1 Role-Based Access

The system has three access levels:

| Role             | Access                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User**         | Can submit surveys, view own team stats, manage push notification subscription                                                                          |
| **Sub-Admin**    | Can view dashboard, users, and submissions for assigned teams. Access to Question Builder and Notifications is controlled by per-admin permission flags |
| **Master Admin** | Full access to all features including admin management, question editing, and all teams                                                                 |

### 2.2 Admin Permissions

Master admins can grant or revoke granular permissions for each sub-admin:

- **Question Builder Access** — allows viewing and exporting questions (editing is master-only)
- **Notifications Access** — allows sending notifications and viewing notification history

These permissions are enforced both:

- **Server-side:** API endpoints check the admin's role and permissions before processing
- **Client-side:** The admin UI hides navigation items and sections that the admin does not have access to

### 2.3 Team-Based Data Isolation

Sub-admins are assigned to specific teams and can only view/manage:

- Users belonging to their assigned teams
- Submissions from their assigned teams
- Statistics for their assigned teams

Master admins have access to all teams.

---

## 3. Transport Security

### 3.1 HTTPS / TLS

All traffic to `armourcare.uk` is encrypted using **TLS** (HTTPS), terminated at the Nginx reverse proxy. This ensures:

- Data in transit (passwords, survey responses, tokens) cannot be intercepted
- The server's identity is verified via its SSL certificate

**HTTP access is blocked:**

- Nginx redirects all HTTP (port 80) requests to HTTPS (port 443) with a `301 Moved Permanently` response
- **HSTS (HTTP Strict Transport Security)** is enabled with a 1-year `max-age` and `includeSubDomains`, instructing browsers to always use HTTPS and never attempt an insecure connection
- HSTS is set at both the Nginx and Node.js application level

### 3.2 CORS (Cross-Origin Resource Sharing)

API access is restricted to trusted origins only:

- `https://armourcare.uk` (production)
- `http://localhost:8000` (local development)
- `http://127.0.0.1:8000` (local development)

Requests from any other origin are rejected. The `Authorization` header is explicitly allowed for JWT token transmission.

---

## 4. HTTP Security Headers

Every response includes the following security headers:

| Header                   | Value                                      | Purpose                                                                    |
| ------------------------ | ------------------------------------------ | -------------------------------------------------------------------------- |
| `X-Content-Type-Options` | `nosniff`                                  | Prevents browsers from MIME-type sniffing                                  |
| `X-Frame-Options`        | `DENY`                                     | Prevents the site from being embedded in iframes (clickjacking protection) |
| `X-XSS-Protection`       | `1; mode=block`                            | Enables browser XSS filtering                                              |
| `Referrer-Policy`        | `strict-origin-when-cross-origin`          | Limits referrer information sent to external sites                         |
| `Permissions-Policy`     | `camera=(), microphone=(), geolocation=()` | Disables access to sensitive browser APIs not needed by the app            |

---

## 5. Input Validation & Request Safety

### 5.1 Request Body Size Limit

All POST/PUT request bodies are limited to **1 MB**. Requests exceeding this limit are immediately terminated to prevent memory exhaustion attacks.

### 5.2 Input Validation

- Armour numbers are normalised to uppercase
- Password minimum length is enforced (4 characters)
- Required fields are validated before processing
- JSON parsing errors are caught and return appropriate error responses

### 5.3 Path Traversal Protection

Static file serving validates that the resolved file path stays within the application directory. Requests attempting directory traversal (e.g., `../../etc/passwd`) are blocked with a 403 Forbidden response.

---

## 6. Data Storage

### 6.1 File-Based Storage

Data is stored in JSON files on the server filesystem:

| File                      | Contents                                                           | Sensitivity |
| ------------------------- | ------------------------------------------------------------------ | ----------- |
| `users.json`              | User accounts (armour numbers, teams, bcrypt hashes)               | High        |
| `admins.json`             | Admin accounts (armour numbers, roles, bcrypt hashes, permissions) | High        |
| `submissions.json`        | Monthly survey responses                                           | Medium      |
| `questions.json`          | Survey question definitions                                        | Low         |
| `notifications.json`      | Notification history                                               | Low         |
| `push-subscriptions.json` | Web Push subscription endpoints                                    | Medium      |
| `auto-notif-config.json`  | Automated notification settings                                    | Low         |
| `.jwt-secret`             | JWT signing secret (file mode 0600)                                | Critical    |

### 6.2 Sensitive Data Handling

- Password hashes are **never** included in API responses
- The JWT secret file has restricted file permissions (`0600` — owner read/write only)
- VAPID keys can be provided via environment variables to avoid hardcoding in source

---

## 7. Push Notifications

Push notifications use the **Web Push API** with **VAPID** (Voluntary Application Server Identification) authentication:

- The server identifies itself to push services using a VAPID key pair
- Push subscriptions are stored per-user and deduplicated by endpoint
- Expired or invalid subscriptions (HTTP 410/404) are automatically cleaned up
- VAPID keys can be configured via environment variables (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)

---

## 8. Session Management

### 8.1 Client-Side Sessions

Session data is stored in the browser's `localStorage`:

- **User app:** `armourcare-session` (user profile), `armourcare-token` (JWT)
- **Admin portal:** `armourcare-admin` (admin profile), `armourcare-admin-token` (JWT)

On logout, both the session data and token are cleared from localStorage.

### 8.2 Token Expiry

JWT tokens expire after 7 days. After expiry, the user is effectively logged out and must re-authenticate. There is no refresh token mechanism — a full re-login is required.

---

## 9. Deployment Security

- The application runs as a **systemd service** on the VPS, ensuring automatic restart on failure
- Nginx acts as a **reverse proxy**, handling TLS termination and forwarding to the Node.js app on port 8000
- The Node.js process listens on `0.0.0.0:8000` but is only accessible externally through Nginx (port 443)
- Data files (`users.json`, `admins.json`, etc.) are **not overwritten** during deployment — only application code is updated
- **Pre-deploy backups:** The deploy script automatically backs up `questions.json`, `users.json`, and `admins.json` locally with a timestamp before each deployment
- **Post-deploy sync:** After deployment, the server's copies of these data files are pulled to the local machine (server is the source of truth)

---

## 10. Search Engine Protection

The application is configured to prevent indexing by search engines:

- **Meta tags:** Both `index.html` and `admin.html` include `<meta name="robots" content="noindex, nofollow" />` to instruct compliant crawlers not to index or follow links
- **robots.txt:** A `robots.txt` file at the site root disallows all crawlers from all paths (`Disallow: /`)

This ensures the app and admin portal do not appear in search engine results.

---

## 11. Known Limitations & Future Improvements

| Area                        | Current State         | Potential Improvement                                             |
| --------------------------- | --------------------- | ----------------------------------------------------------------- |
| **Database**                | JSON files on disk    | Migrate to SQLite or PostgreSQL for better concurrency and backup |
| **CSRF protection**         | Not implemented       | Add CSRF tokens for state-changing requests                       |
| **Content Security Policy** | Not implemented       | Add CSP header to prevent XSS via inline scripts                  |
| **Session storage**         | localStorage          | Consider httpOnly cookies for token storage (immune to XSS)       |
| **Password policy**         | 4-character minimum   | Enforce stronger passwords (length, complexity)                   |
| **Audit logging**           | Basic console logging | Add structured audit log for admin actions                        |
| **2FA**                     | Not implemented       | Add TOTP-based two-factor authentication for admin accounts       |
| **Backup**                  | Manual export/restore | Implement automated encrypted backups                             |

---

## Contact

For security concerns, contact the system administrator.
