# Yadhwala — Technical Architecture & Developer Documentation

> **Yadhwala** (formerly Task Reminder) is a full-stack task management and reminder platform. Users create tasks with optional email and WhatsApp reminders, manage them on a kanban-style dashboard, and authenticate via Gmail-only accounts with OTP verification. The system is designed for a split deployment: the main API and React frontend on **cPanel (Phusion Passenger)**, and a persistent WhatsApp connection on **Render** as a separate microservice.

---

## 1. High-Level Architecture Overview

### 1.1 Primary Purpose

Yadhwala enables users to:

- Register and authenticate securely (captcha, OTP email verification, JWT sessions)
- Create, edit, delete, and complete tasks with due dates
- Configure multi-channel reminders (email via SMTP, WhatsApp via Baileys microservice)
- Receive automated notifications at configured times
- Access a public marketing site (Home, About, Testimonials, Contact, Privacy)
- Allow admins/superadmins to view platform statistics and manage user roles

### 1.2 System Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                                │
│  React SPA (Vite) — static build on cPanel or localhost:5173            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS / JSON REST
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              MAIN API — Node.js + Express (server.js)                   │
│              cPanel / Phusion Passenger (multi-worker)                  │
│              Production: https://api.yadhwala.com                       │
├─────────────────────────────────────────────────────────────────────────┤
│  • Auth (JWT, bcrypt, captcha)                                          │
│  • Task CRUD                                                              │
│  • Admin panel API                                                        │
│  • Email (nodemailer → Gmail SMTP)                                      │
│  • Reminder orchestration (HTTP-triggered, not internal cron)           │
└───────┬─────────────────────────────┬───────────────────────────────────┘
        │ MySQL (mysql2 pool)           │ HTTP
        ▼                               ▼
┌───────────────────┐         ┌─────────────────────────────────────────┐
│  task_reminder DB │         │  WhatsApp Microservice (Baileys)         │
│  (users, tasks,   │         │  Render free tier — persistent WA socket  │
│   logs, analytics)│         │  GET /health, POST /send-message, GET /qr │
└───────────────────┘         └─────────────────────────────────────────┘
                                        ▲
                                        │ Heartbeat ping every reminder tick
┌───────────────────────────────────────┴─────────────────────────────────┐
│  EXTERNAL CRON (cPanel Cron / cron-job.org)                             │
│  GET /api/trigger-reminders?secret=CRON_SECRET  (every minute)          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Tech Stack

| Layer | Technology | Role |
|-------|------------|------|
| **Frontend** | React 18, Vite 6, React Router DOM 6 | SPA, routing, auth guards, dashboard UI |
| **Styling** | Custom CSS (`index.css`) | No Tailwind; dark-themed UI |
| **Backend API** | Node.js, Express 4 | Monolithic REST API in a single `server.js` |
| **Database** | MySQL 8+ via `mysql2/promise` | Connection pooling, raw SQL queries |
| **Auth** | `bcrypt`, `jsonwebtoken` | Password hashing, 24h JWT sessions |
| **Captcha** | `svg-captcha`, in-memory Map | Image captcha (signup), math captcha (login) |
| **Email** | `nodemailer` | OTP, password reset, reminders, contact form |
| **IDs** | `uuid` v4 | Captcha session tokens |
| **WhatsApp** | `@whiskeysockets/baileys` (separate service) | Persistent WhatsApp Web connection |
| **Deployment** | cPanel + Phusion Passenger | Main API; multiple worker processes |
| **WhatsApp host** | Render | Keeps Baileys socket alive; subject to cold-start |

### 1.4 Architectural Style

This is a **pragmatic monolith**:

- **No MVC separation** — all backend logic lives in `backend/server.js` (~980 lines)
- **No ORM** — parameterized raw SQL throughout
- **Microservice boundary** — only WhatsApp is extracted (git submodule: `whatsapp-service`)
- **Event-driven reminders** — external HTTP cron replaces in-process `node-cron` to avoid duplicate execution across Passenger workers

### 1.5 Why External Cron (Design Decision)

Phusion Passenger can spawn **multiple Node.js worker processes**. When `node-cron` ran inside each worker, every worker scheduled its own `* * * * *` job, causing **duplicate reminder sends** against the same MySQL database.

The fix:

1. Remove internal `node-cron` scheduling entirely
2. Expose `GET /api/trigger-reminders` secured by `CRON_SECRET`
3. Configure **one external cron job** to hit that endpoint once per minute
4. Rely on in-process locking + database deduplication as secondary guards

---

## 2. Directory Structure & Core Files

### 2.1 Repository Tree

```
Task-Reminder/
├── backend/
│   ├── server.js                 # Entire Express API (auth, tasks, admin, reminders)
│   ├── package.json              # Backend dependencies
│   ├── package-lock.json
│   ├── .env.example              # Environment variable template
│   ├── schema.sql                # Full database bootstrap script
│   └── migrations/
│       ├── add_is_admin.sql
│       ├── add_user_role.sql
│       ├── add_site_analytics.sql
│       └── alter_tasks_reminders.sql
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── main.jsx              # React entry point
│       ├── App.jsx               # Route definitions + auth guards
│       ├── api.js                # API base URL resolution + apiFetch helper
│       ├── index.css             # Global styles
│       ├── Login.jsx
│       ├── Signup.jsx
│       ├── VerifyOTP.jsx
│       ├── ForgotPassword.jsx
│       ├── ResetPassword.jsx
│       ├── Dashboard.jsx         # Task board (Upcoming / Completed)
│       ├── AdminPanel.jsx        # Admin/superadmin statistics + role management
│       ├── AddTaskModal.jsx
│       ├── EditTaskModal.jsx
│       ├── LogoutConfirmModal.jsx
│       ├── PasswordInput.jsx
│       ├── layouts/
│       │   └── PublicLayout.jsx  # Navbar + Footer wrapper for marketing pages
│       ├── components/
│       │   ├── Navbar.jsx
│       │   └── Footer.jsx
│       └── pages/
│           ├── Home.jsx
│           ├── About.jsx
│           ├── Testimonials.jsx
│           ├── Contact.jsx
│           └── PrivacyPolicy.jsx
│
├── whatsapp-service/             # Git submodule (may not be checked out locally)
│   └── (see https://github.com/kartikeya042/whatsapp-service)
│
├── .gitmodules                   # Submodule pointer for whatsapp-service
├── .gitignore
├── package-lock.json             # Root lockfile (minimal; not used by apps)
├── README.md                     # Quick-start guide
└── architecture.md               # This document
```

> **Note:** `whatsapp-service` is registered as a **git submodule** at `whatsapp-service/`. Clone with `git submodule update --init --recursive` to get it locally.

### 2.2 Core File Responsibilities

#### `backend/server.js` (Central API)

Single-file backend containing:

| Section | Responsibility |
|---------|----------------|
| **Bootstrap** | `dotenv`, Express app, CORS, JSON middleware, MySQL pool, nodemailer transporter |
| **Captcha** | In-memory store with 5-minute TTL; image + math captcha endpoints |
| **Auth middleware** | `authenticateToken`, `verifyAdmin`, `verifySuperAdmin`, `resolveUserRole` |
| **Auth routes** | Signup, OTP verify, login, forgot/reset password |
| **Contact** | Public contact form → email to `SMTP_USER` |
| **Notification helpers** | Email/WhatsApp senders, slot-key builder, deduplication log |
| **Reminder processor** | `processReminderNotifications()` — core scheduled logic |
| **Trigger endpoint** | `GET /api/trigger-reminders` — external cron entry point |
| **Admin routes** | Stats, user list, role promotion/revocation |
| **Task routes** | CRUD with reminder fields |
| **Public utilities** | Visitor counter, health check |

There are **no separate** `controllers/`, `routes/`, `models/`, or `services/` directories.

#### `frontend/src/api.js`

- Resolves API URLs for both local dev (`http://localhost:5000`) and production (`https://api.yadhwala.com/api`)
- Handles the `/api` prefix correctly when the base URL already includes `/api`
- `apiFetch()` attaches JWT `Authorization: Bearer` header automatically

#### `frontend/src/App.jsx`

- Defines all routes with `ProtectedRoute` and `PublicRoute` guards
- JWT stored in `localStorage` as `token`; user object as `user`

#### `whatsapp-service/server.js` (Submodule)

Standalone Express server that:

- Maintains a Baileys WebSocket connection to WhatsApp
- Exposes `/health`, `/qr`, `/send-message`
- Persists session in `auth_info_baileys/` directory

---

## 3. Database Schema & Data Flow

### 3.1 Database Engine

**MySQL** database named `task_reminder`, accessed via a connection pool (`connectionLimit: 10`).

Bootstrap: `backend/schema.sql`  
Incremental changes: `backend/migrations/*.sql`

### 3.2 Primary Tables

#### `users`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | INT PK AUTO_INCREMENT | User identifier |
| `name` | VARCHAR(100) | Display name |
| `mobile` | VARCHAR(20) | Used for WhatsApp reminders |
| `email` | VARCHAR(150) UNIQUE | Gmail address (full `user@gmail.com`) |
| `password_hash` | VARCHAR(255) | bcrypt hash (10 rounds) |
| `otp` | VARCHAR(6) NULL | Signup verification or password reset OTP |
| `is_active` | TINYINT(1) | `0` until email verified |
| `is_admin` | BOOLEAN | Legacy flag; synced with `role` |
| `role` | ENUM(`user`,`admin`,`superadmin`) | RBAC role |
| `created_at` | TIMESTAMP | Registration time |

#### `tasks`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | INT PK | Task identifier |
| `user_id` | INT FK → `users.id` | Owner (CASCADE delete) |
| `title` | VARCHAR(200) | Task name |
| `description` | TEXT NULL | Optional details |
| `status` | ENUM(`new`,`upcoming`,`completed`) | Task lifecycle (UI uses `upcoming`/`completed`) |
| `due_date` | DATE NULL | Required for new tasks via API |
| `has_reminder` | BOOLEAN | Whether reminders are enabled |
| `reminder_time` | TIME NULL | Target time on `due_date` |
| `reminder_type` | ENUM | See reminder types below |
| `created_at` | TIMESTAMP | Creation time |

**Reminder types (`reminder_type`):**

| Value | Behavior |
|-------|----------|
| `exact_time` | Notify when `reminder_time` matches current `HH:MM` on `due_date` |
| `30_min_prior` | Notify 30 minutes before `due_date + reminder_time` |
| `1_hour_prior` | Notify 60 minutes before `due_date + reminder_time` |
| `every_hour` | Notify at minute `00` of every hour on `due_date` |

#### `task_notification_log`

Deduplication table preventing duplicate sends for the same reminder slot.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | INT PK | Log entry ID |
| `task_id` | INT FK | Task reference |
| `slot_key` | VARCHAR(100) | Unique slot identifier (see below) |
| `sent_at` | TIMESTAMP | When notification was sent |

**Unique constraint:** `(task_id, slot_key)` — inserts use `INSERT IGNORE` to avoid race-condition crashes.

**Slot key format examples:**

- `exact_time:2026-06-16:14:30`
- `30_min_prior:2026-06-16:14:00`
- `every_hour:2026-06-16:14` (hour only)

#### `site_analytics`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | INT PK | Fixed row `id = 1` |
| `visitor_count` | INT | Incremented on each `GET /api/visitor-count` |

### 3.3 Entity Relationships

```
users (1) ──────< (N) tasks
tasks (1) ──────< (N) task_notification_log
```

### 3.4 User Management Data Flow

```
Signup Flow:
─────────────
Browser → POST /api/auth/signup
  → Validate image captcha (server-side token)
  → bcrypt.hash(password)
  → INSERT users (is_active=0, otp=6-digit)
  → nodemailer: OTP + verify link → user email
Browser → /verify?email=...
  → POST /api/auth/verify { email, otp }
  → UPDATE users SET is_active=1, otp=NULL

Login Flow:
───────────
Browser → GET /api/captcha/math → { token, question }
Browser → POST /api/auth/login { email, password, captchaToken, captchaAnswer }
  → Validate math captcha
  → bcrypt.compare(password)
  → jwt.sign({ id, email, name, role, is_admin }, expiresIn: 24h)
  → Store token + user in localStorage
  → Redirect to /dashboard

Password Reset:
───────────────
POST /api/auth/forgot-password → generates OTP, emails user
POST /api/auth/reset-password → validates OTP, bcrypt.hash new password
```

### 3.5 Task Creation & Reminder Data Flow

```
Task Creation:
──────────────
Dashboard → AddTaskModal
  → Client validates not scheduling in the past
  → POST /api/tasks (JWT required)
    Body: { title, description, due_date, status, has_reminder,
            reminder_time, reminder_type }
  → Server validates due_date (YYYY-MM-DD), reminder fields if enabled
  → INSERT INTO tasks
  → Return formatted task JSON

Reminder Delivery (async, triggered externally):
──────────────────────────────────────────────
External Cron → GET /api/trigger-reminders?secret=...
  → 200 OK immediately
  → processReminderNotifications() in background
    → autoCompleteExpiredTasks()
    → SQL: find tasks matching current local date/time + reminder_type rules
    → For each match:
        → wasNotificationSent(task_id, slot_key)? skip if yes
        → sendReminderEmail(user.email, task)
        → sendWhatsAppNotification(user.mobile, message)
        → recordNotificationSent() via INSERT IGNORE
```

### 3.6 Auto-Complete Logic

`autoCompleteExpiredTasks()` runs on every reminder tick and marks `upcoming` tasks as `completed` when:

- **With reminder:** `TIMESTAMP(due_date, reminder_time) < now`
- **Without reminder:** `due_date < today`

---

## 4. External Services & Integrations

### 4.1 Email (Nodemailer + SMTP)

**Implementation:** `nodemailer.createTransport()` initialized at server startup using `SMTP_*` env vars.

**Email use cases:**

| Trigger | Endpoint / Function | Recipient | Subject |
|---------|---------------------|-----------|---------|
| Signup OTP | `POST /api/auth/signup` | User | `Verify your Yadhwala account` |
| Password reset | `POST /api/auth/forgot-password` | User | `Reset your Yadhwala password` |
| Task reminder | `sendReminderEmail()` | User | `Task Reminder: {title}` |
| Contact form | `POST /api/contact` | `SMTP_USER` (admin inbox) | User-provided subject |

**Dev fallback:** If `SMTP_USER` or `SMTP_PASS` is unset, OTPs and reminders are **logged to console** instead of sent.

**Reminder email format:**

- `from`: `{ name: 'Yadhwala', address: SMTP_USER }`
- HTML body with task title, description, due date

**Contact form:**

- `replyTo` set to submitter's email
- Requires SMTP configured (returns 503 otherwise)

### 4.2 WhatsApp Integration (Baileys Microservice)

The main API does **not** connect to WhatsApp directly. It delegates to a separate service configured via `WHATSAPP_SERVICE_URL`.

#### 4.2.1 Service Overview

| Property | Value |
|----------|-------|
| **Repo** | `https://github.com/kartikeya042/whatsapp-service` (git submodule) |
| **Library** | `@whiskeysockets/baileys` v6.7.x |
| **Runtime** | Node 20.x on Render |
| **Default port** | `5001` |
| **Session storage** | `auth_info_baileys/` (multi-file auth state) |

#### 4.2.2 Connection Establishment

```javascript
// Simplified flow from whatsapp-service/server.js

1. useMultiFileAuthState('auth_info_baileys')
   → Loads saved credentials from disk (persists across restarts)

2. fetchLatestBaileysVersion()
   → Fetches current WhatsApp Web version to avoid protocol mismatch (405 errors)

3. makeWASocket({ version, auth, browser, ... })
   → Creates WebSocket to WhatsApp servers
   → Render-optimized flags: syncFullHistory=false, fireInitQueries=false, etc.

4. sock.ev.on('creds.update', saveCreds)
   → Persists updated credentials on each auth event

5. sock.ev.on('connection.update', ...)
   → qr event → generate QR as data URL → served at GET /qr
   → connection === 'open' → isClientReady = true
   → connection === 'close' → auto-reconnect unless logged out
```

#### 4.2.3 Connection Maintenance

| Mechanism | Purpose |
|-----------|---------|
| `keepAliveIntervalMs: 30000` | Sends keep-alive pings every 30s |
| Auto-reconnect on disconnect | 5-second delay unless `DisconnectReason.loggedOut` |
| `GET /health` heartbeat from main API | Wakes Render instance before sending messages (15-min inactivity limit) |
| `ignoreAllBroadcasts: true` | Prevents crashes from heavy status broadcasts |
| `fireInitQueries: false` | Skips blocklist/privacy sync that times out on Render |

#### 4.2.4 Messaging API

**`POST /send-message`**

```json
{ "mobile": "9876543210", "message": "Reminder: ..." }
```

- Returns `503` if client not ready (QR not scanned)
- `formatWhatsAppNumber()`: strips non-digits, prepends `91` for 10-digit Indian numbers, appends `@s.whatsapp.net`
- Uses `sock.sendMessage(jid, { text: message })`

#### 4.2.5 Main API → WhatsApp Client

`sendWhatsAppNotification(mobile, message)` in `server.js`:

- `POST {WHATSAPP_SERVICE_URL}/send-message`
- **3 retries** with **10-second delay** on HTTP 503 (client waking up)
- **15-second timeout** per attempt via `AbortSignal.timeout(15000)`
- Logs error after final failure; does not throw (reminder loop continues)

#### 4.2.6 Initial Setup (Production)

1. Deploy `whatsapp-service` to Render
2. Visit `{WHATSAPP_SERVICE_URL}/qr`
3. Scan QR with WhatsApp → Linked Devices
4. Confirm `GET /health` returns `{ status: 'ok', whatsappReady: true }`
5. Set `WHATSAPP_SERVICE_URL` in main API `.env`

---

## 5. Scheduled Tasks & Event-Driven Logic

### 5.1 Previous Architecture (Removed)

```javascript
// REMOVED — caused duplicate execution in Passenger multi-worker mode
const cron = require('node-cron');
cron.schedule('* * * * *', processReminderNotifications);
```

Each Passenger worker independently scheduled this cron → **N workers = N executions per minute**.

### 5.2 Current Architecture (HTTP-Triggered)

```
┌──────────────┐    every minute     ┌─────────────────────────────┐
│ External Cron│ ──────────────────► │ GET /api/trigger-reminders  │
│ (cPanel etc.)│   ?secret=CRON_SECRET │                             │
└──────────────┘                     └──────────────┬──────────────┘
                                                    │
                              ┌─────────────────────┴─────────────────────┐
                              │ 1. Validate secret (401 if mismatch)     │
                              │ 2. res.status(200).json({ message: ... }) │
                              │ 3. processReminderNotifications() async   │
                              └───────────────────────────────────────────┘
```

### 5.3 `/api/trigger-reminders` Endpoint

**Method:** `GET`  
**Auth:** Query parameter `secret` must match `process.env.CRON_SECRET`

```javascript
app.get('/api/trigger-reminders', (req, res) => {
  const { secret } = req.query;

  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  res.status(200).json({ message: 'Reminder check triggered' });

  processReminderNotifications().catch((err) => {
    console.error('[CRON] Background processing error:', err);
  });
});
```

**Response-first pattern:** The HTTP response is sent **before** reminder processing begins, so external cron callers (curl, cron-job.org) never hang waiting for email/WhatsApp delivery.

### 5.4 Security Mechanism

| Aspect | Detail |
|--------|--------|
| **Mechanism** | Shared secret via query string: `?secret=<CRON_SECRET>` |
| **Comparison** | Strict equality: `secret !== process.env.CRON_SECRET` |
| **Failure response** | `401 Unauthorized` |
| **Deployment requirement** | **Must set `CRON_SECRET` in production.** If unset and caller omits `secret`, both are `undefined` and comparison passes — endpoint would be open |

**Recommended external cron command:**

```bash
curl -fsS "https://api.yadhwala.com/api/trigger-reminders?secret=YOUR_CRON_SECRET"
```

**cPanel cron entry:** `* * * * *` (every minute)

### 5.5 Locking & Deduplication (Multi-Layer)

#### Layer 1: In-Process Lock (`isProcessingReminders`)

```javascript
let isProcessingReminders = false;

async function processReminderNotifications() {
  if (isProcessingReminders) {
    console.log('[CRON TICK] Previous job still running, skipping...');
    return;
  }
  isProcessingReminders = true;
  try { /* ... */ }
  finally { isProcessingReminders = false; }
}
```

- Prevents **overlapping runs within the same Node.js process**
- If a previous tick is still sending emails/WhatsApp messages, the next tick is skipped
- **Limitation:** This lock is **per-worker**, not global across Passenger workers

#### Layer 2: Database Deduplication (`task_notification_log`)

```javascript
async function wasNotificationSent(taskId, slotKey) {
  // SELECT check before sending
}

async function recordNotificationSent(taskId, slotKey) {
  await pool.query(
    'INSERT IGNORE INTO task_notification_log (task_id, slot_key) VALUES (?, ?)',
    [taskId, slotKey]
  );
}
```

- **Unique key** `(task_id, slot_key)` prevents duplicate log entries
- `INSERT IGNORE` silently handles race conditions if two workers process the same task simultaneously
- Combined with pre-send `wasNotificationSent()` check, this is the **authoritative cross-worker deduplication**

> There is **no MySQL advisory lock** (`GET_LOCK`). Deduplication is application-level via the notification log table.

#### Layer 3: Single External Trigger

Only one external cron fires per minute → dramatically reduces multi-worker collision vs. internal per-worker cron.

### 5.6 `processReminderNotifications()` Pipeline

Each invocation (unchanged internal logic):

1. **Render heartbeat:** `GET {WHATSAPP_SERVICE_URL}/health` (fire-and-forget)
2. **In-process lock check** → skip if busy
3. **Acquire lock** (`isProcessingReminders = true`)
4. **Compute local time parts** (`getLocalDateTimeParts()` — server local timezone)
5. **`autoCompleteExpiredTasks()`** — mark overdue tasks completed
6. **SQL query** — find tasks where reminder conditions match current minute
7. **For each task:**
   - Build `slotKey` via `buildNotificationSlotKey()`
   - Skip if `wasNotificationSent()`
   - `sendReminderEmail()`
   - `sendWhatsAppNotification()` (with retries)
   - `recordNotificationSent()`
8. **Release lock** in `finally` block

### 5.7 Reminder Matching SQL (Conceptual)

Tasks are selected when:

- `has_reminder = TRUE`
- `due_date = today` (local server date)
- `status != 'completed'`
- AND one of:
  - `exact_time`: `reminder_time` HH:MM equals now
  - `30_min_prior`: 30 min before due datetime equals now
  - `1_hour_prior`: 60 min before due datetime equals now
  - `every_hour`: current minute is `00`

---

## 6. Environment Variables

### 6.1 Backend (`backend/.env`)

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `PORT` | No | HTTP listen port (Passenger sets automatically on cPanel) | `5000` |
| `JWT_SECRET` | **Yes** | Secret for signing/verifying JWT tokens | Strong random string |
| `DB_HOST` | **Yes** | MySQL hostname | `127.0.0.1` |
| `DB_PORT` | No | MySQL port | `3306` |
| `DB_USER` | **Yes** | MySQL username | `task_user` |
| `DB_PASSWORD` | **Yes** | MySQL password | *(secret)* |
| `DB_NAME` | **Yes** | Database name | `task_reminder` |
| `SMTP_HOST` | No* | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | No | SMTP port | `587` |
| `SMTP_SECURE` | No | TLS mode (`true`/`false`) | `false` |
| `SMTP_USER` | No* | SMTP login / sender email | `your@gmail.com` |
| `SMTP_PASS` | No* | SMTP password (Gmail App Password) | *(secret)* |
| `EMAIL_FROM` | No | Display name + address for outgoing mail | `Yadhwala <your@gmail.com>` |
| `FRONTEND_URL` | **Yes** | CORS origin + links in verification emails | `https://yadhwala.com` |
| `WHATSAPP_SERVICE_URL` | No** | Base URL of Baileys microservice | `https://your-app.onrender.com` |
| `CRON_SECRET` | **Yes*** | Secret for `/api/trigger-reminders` | Strong random string |

\* SMTP vars required for production email; without them, OTPs/reminders log to console.  
\** Required for WhatsApp reminders; email-only mode works without it.  
\*** Required in production to prevent unauthorized reminder triggers.

### 6.2 Frontend (`frontend/.env`)

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `VITE_API_URL` | No | Backend API base URL (no trailing slash) | `http://localhost:5000` (dev) or `https://api.yadhwala.com/api` (prod) |

Defaults to `http://localhost:5000` if unset.

### 6.3 WhatsApp Service (`whatsapp-service/.env`)

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `PORT` | No | HTTP listen port (Render sets automatically) | `5001` |

Baileys session is file-based (`auth_info_baileys/`); no API keys required.

---

## 7. API Reference (Complete)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/captcha/image` | No | SVG image captcha + token |
| GET | `/api/captcha/math` | No | Math captcha question + token |
| POST | `/api/auth/signup` | No | Register user, send OTP |
| POST | `/api/auth/verify` | No | Verify OTP, activate account |
| POST | `/api/auth/login` | No | Login, return JWT |
| POST | `/api/auth/forgot-password` | No | Send password reset OTP |
| POST | `/api/auth/reset-password` | No | Reset password with OTP |
| POST | `/api/contact` | No | Public contact form email |
| GET | `/api/trigger-reminders` | `?secret=` | Trigger reminder processing (external cron) |
| GET | `/api/admin/stats` | JWT + admin | Per-user task statistics |
| GET | `/api/admin/users` | JWT + superadmin | Full user list |
| PUT | `/api/admin/users/:id/role` | JWT + superadmin | Promote/revoke admin |
| GET | `/api/tasks` | JWT | User's tasks grouped by status |
| POST | `/api/tasks` | JWT | Create task with optional reminder |
| PUT | `/api/tasks/:id` | JWT | Update task |
| DELETE | `/api/tasks/:id` | JWT | Delete task |
| GET | `/api/visitor-count` | No | Increment + return visitor count |
| GET | `/api/health` | No | DB connectivity check |

**Protected route header:**

```
Authorization: Bearer <jwt_token>
```

---

## 8. Frontend Routes

| Route | Component | Access |
|-------|-----------|--------|
| `/` | Home | Public |
| `/about` | About | Public |
| `/testimonials` | Testimonials | Public |
| `/contact` | Contact | Public |
| `/privacy` | PrivacyPolicy | Public |
| `/signup` | Signup | Public (redirect if logged in) |
| `/login` | Login | Public (redirect if logged in) |
| `/verify` | VerifyOTP | Public |
| `/forgot-password` | ForgotPassword | Public |
| `/reset-password` | ResetPassword | Public |
| `/dashboard` | Dashboard | JWT required |
| `/admin` | AdminPanel | JWT required (admin/superadmin) |

---

## 9. Role-Based Access Control

| Role | Capabilities |
|------|-------------|
| `user` | Own tasks CRUD |
| `admin` | View `/api/admin/stats` (all users' task counts) |
| `superadmin` | Admin stats + `/api/admin/users` + promote/revoke admin roles |

**Promote superadmin (SQL):**

```sql
UPDATE users SET role = 'superadmin', is_admin = 1 WHERE email = 'your@gmail.com';
```

Superadmin accounts cannot have their role changed via the API.

---

## 10. Local Development Setup

### Prerequisites

- Node.js 18+ (20+ recommended; `fetch` is used natively)
- MySQL 8+
- Gmail App Password (optional for email)

### Steps

```bash
# 1. Database
mysql -u root -p < backend/schema.sql

# 2. Backend
cd backend
cp .env.example .env   # fill in values
npm install
npm run dev            # http://localhost:5000

# 3. Frontend (separate terminal)
cd frontend
cp .env.example .env.development  # VITE_API_URL=http://localhost:5000
npm install
npm run dev            # http://localhost:5173

# 4. WhatsApp service (optional, separate terminal)
git submodule update --init --recursive
cd whatsapp-service
npm install
npm run dev            # http://localhost:5001 — scan QR at /qr

# 5. Simulate external cron locally
curl "http://localhost:5000/api/trigger-reminders?secret=YOUR_CRON_SECRET"
```

### Production Build (Frontend)

```bash
cd frontend
npm run build    # outputs to frontend/dist/
```

Deploy `dist/` to cPanel static hosting; point `VITE_API_URL` at production API during build.

---

## 11. Security Considerations

| Area | Implementation |
|------|----------------|
| Passwords | bcrypt, 10 salt rounds |
| Sessions | JWT, 24-hour expiry |
| Captcha | Server-side tokens, 5-min TTL, single-use |
| CORS | Restricted to `FRONTEND_URL` |
| Cron endpoint | `CRON_SECRET` query parameter |
| SQL injection | Parameterized queries throughout |
| Admin actions | Middleware-enforced role checks |
| WhatsApp | Isolated microservice; no credentials in main API |

**Known considerations:**

- JWT in `localStorage` (XSS risk — standard SPA tradeoff)
- Captcha store is in-memory (resets on server restart; not shared across Passenger workers)
- `CRON_SECRET` must be set in production
- Reminder timezone follows **server local time** (cPanel server timezone matters)

---

## 12. Dependencies Summary

### Backend (`backend/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.21.2 | HTTP server |
| `mysql2` | ^3.12.0 | MySQL driver + pool |
| `bcrypt` | ^5.1.1 | Password hashing |
| `jsonwebtoken` | ^9.0.2 | JWT auth |
| `nodemailer` | ^6.9.16 | Email delivery |
| `svg-captcha` | ^1.4.0 | Image captcha generation |
| `uuid` | ^11.0.5 | Captcha tokens |
| `cors` | ^2.8.5 | Cross-origin requests |
| `dotenv` | ^16.4.7 | Environment variables |

> `node-cron` has been **removed** — reminders are externally triggered.

### Frontend (`frontend/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | DOM rendering |
| `react-router-dom` | ^6.28.0 | Client-side routing |
| `vite` | ^6.0.3 | Build tool (dev) |
| `@vitejs/plugin-react` | ^4.3.4 | React HMR (dev) |

### WhatsApp Service (`whatsapp-service/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `@whiskeysockets/baileys` | ^6.7.5 | WhatsApp Web protocol |
| `express` | ^4.19.2 | HTTP API |
| `pino` | ^8.21.0 | Baileys logger |
| `qrcode` | ^1.5.3 | QR code rendering for `/qr` |
| `cors` | ^2.8.5 | CORS |
| `dotenv` | ^16.4.5 | Environment variables |

---

## 13. Operational Checklist (Production)

- [ ] MySQL `task_reminder` database created from `schema.sql`
- [ ] All backend `.env` variables set (especially `CRON_SECRET`, `JWT_SECRET`)
- [ ] Frontend built with `VITE_API_URL=https://api.yadhwala.com/api`
- [ ] WhatsApp service deployed on Render; QR scanned; `/health` shows `whatsappReady: true`
- [ ] `WHATSAPP_SERVICE_URL` points to Render service in main API `.env`
- [ ] External cron configured: `* * * * *` → `curl` trigger endpoint with secret
- [ ] Superadmin promoted via SQL
- [ ] `GET /api/health` returns `{ status: 'ok' }`
- [ ] Only **one** environment (production) runs reminders against production DB (avoid local dev + prod both triggering)

---

*This document reflects the codebase as of June 2026. Built as a Web Technology Internship assignment — **Yadhwala**.*
