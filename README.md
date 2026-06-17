# Yadhwala

**Yadhwala** is a full-stack task management and reminder platform. Users create tasks with due dates, configure email and WhatsApp reminders, and manage them on a dashboard. The app includes secure Gmail-only authentication, a public marketing site, admin tooling, and a split production deployment: main API on **cPanel (Phusion Passenger)** and a persistent WhatsApp connection on **Render**.

**Live stack (production):**

| Component | URL / host |
|-----------|------------|
| Frontend | `https://yadhwala.com` |
| API | `https://api.yadhwala.com` |
| WhatsApp service | Render (Baileys microservice) |

For deep architectural documentation, see [`architecture.md`](./architecture.md).

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Reminder System](#reminder-system)
- [WhatsApp Microservice](#whatsapp-microservice)
- [Production Deployment](#production-deployment)
- [API Reference](#api-reference)
- [Frontend Routes](#frontend-routes)
- [Admin & Roles](#admin--roles)
- [Application Flows](#application-flows)
- [Scripts](#scripts)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

### Authentication & Security

- **Signup** with server-generated SVG image captcha (`svg-captcha`)
- **Email verification** via 6-digit OTP (nodemailer / Gmail SMTP)
- **Login** with custom math captcha and JWT sessions (24-hour expiry)
- **Forgot / reset password** flow with OTP email
- **Gmail-only accounts** — users enter only their email prefix; `@gmail.com` is appended automatically
- Passwords hashed with **bcrypt** (10 salt rounds)
- Captcha tokens stored server-side (UUID, 5-minute TTL, single-use)

### Task Management

- Kanban-style dashboard: **Upcoming** and **Completed** columns
- Create, edit, and delete tasks via modal UI
- Due dates displayed as `dd-mm-yyyy`
- Optional time-based reminders with four reminder types (see [Reminder System](#reminder-system))
- Automatic task completion when the deadline passes

### Notifications

- **Email reminders** via SMTP (nodemailer)
- **WhatsApp reminders** via a separate Baileys microservice on Render
- Deduplication via `task_notification_log` (no duplicate sends for the same slot)
- HTTP-triggered reminder processing (external cron — no in-process `node-cron`)

### Public Site

- Marketing pages: Home, About, Testimonials, Contact, Privacy Policy
- Shared layout with navbar and footer
- Public contact form (emails admin inbox with `replyTo` set to user)
- Visitor counter on login/signup pages

### Admin

- **Admin** role: view per-user task statistics
- **Superadmin** role: promote/revoke admin roles, view full user list
- Protected `/admin` panel in the frontend

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18, Vite 6, React Router DOM 6, custom CSS |
| **Backend** | Node.js, Express 4, `mysql2` (connection pool) |
| **Database** | MySQL 8+ |
| **Auth** | bcrypt, jsonwebtoken |
| **Email** | nodemailer (Gmail SMTP) |
| **Captcha** | svg-captcha + custom math logic |
| **WhatsApp** | `@whiskeysockets/baileys` (separate microservice) |
| **Deployment** | cPanel + Phusion Passenger (API & frontend), Render (WhatsApp) |

---

## Architecture Overview

```
Browser (React SPA)
        │
        ▼ HTTPS
Main API (Express — server.js)  ──►  MySQL (task_reminder)
        │
        ├──► Gmail SMTP (OTP, reminders, contact)
        │
        └──► WhatsApp microservice on Render
                    POST /send-message

External cron (every minute)
        │
        └──► GET /api/trigger-reminders?secret=...
                    └──► processReminderNotifications() [background]
```

**Key design decisions:**

- **Monolithic API** — all backend logic in `backend/server.js` (no MVC folders)
- **External cron** — reminders are triggered by an HTTP endpoint instead of `node-cron`, fixing duplicate execution when Phusion Passenger runs multiple workers
- **WhatsApp isolated** — persistent WebSocket connection lives on Render; main API calls it over HTTP

---

## Project Structure

```
Task-Reminder/
├── backend/
│   ├── server.js              # Complete Express API
│   ├── package.json
│   ├── .env.example
│   ├── schema.sql             # Full database bootstrap
│   └── migrations/            # Incremental SQL migrations
│       ├── add_is_admin.sql
│       ├── add_user_role.sql
│       ├── add_site_analytics.sql
│       └── alter_tasks_reminders.sql
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Routes + auth guards
│   │   ├── api.js             # API URL helper + apiFetch
│   │   ├── Dashboard.jsx      # Task board
│   │   ├── AdminPanel.jsx
│   │   ├── AddTaskModal.jsx
│   │   ├── EditTaskModal.jsx
│   │   ├── Login.jsx / Signup.jsx / VerifyOTP.jsx
│   │   ├── ForgotPassword.jsx / ResetPassword.jsx
│   │   ├── layouts/PublicLayout.jsx
│   │   ├── components/Navbar.jsx, Footer.jsx
│   │   └── pages/Home.jsx, About.jsx, Testimonials.jsx, Contact.jsx, PrivacyPolicy.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
│
├── whatsapp-service/          # Git submodule — Baileys WhatsApp service
│   └── server.js
│
├── architecture.md              # Detailed technical documentation
├── .gitmodules
└── README.md
```

**Clone with WhatsApp submodule:**

```bash
git clone --recurse-submodules <repo-url>
# or after clone:
git submodule update --init --recursive
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) **18+** (20+ recommended; native `fetch` is used)
- [MySQL](https://dev.mysql.com/downloads/) 8+
- Gmail account with [App Password](https://myaccount.google.com/apppasswords) for SMTP
- (Optional) Render account for WhatsApp microservice in production

---

## Local Development Setup

### 1. Database

```bash
mysql -u root -p < backend/schema.sql
```

For an existing database, apply migrations in `backend/migrations/` as needed.

### 2. Backend

```bash
cd backend
cp .env.example .env    # Windows: copy .env.example .env
# Edit .env with your MySQL and SMTP credentials
npm install
npm run dev
```

API runs at **http://localhost:5000**

### 3. Frontend

```bash
cd frontend
# Create .env.development with:
# VITE_API_URL=http://localhost:5000
npm install
npm run dev
```

App runs at **http://localhost:5173**

### 4. WhatsApp service (optional)

```bash
cd whatsapp-service
npm install
npm run dev
```

Service runs at **http://localhost:5001**. Open **http://localhost:5001/qr** and scan with WhatsApp → Linked Devices.

Set in `backend/.env`:

```env
WHATSAPP_SERVICE_URL=http://localhost:5001
```

### 5. Simulate reminder cron locally

```bash
curl "http://localhost:5000/api/trigger-reminders?secret=YOUR_CRON_SECRET"
```

> **Dev tip:** If SMTP is not configured, OTPs and reminder content are logged to the backend console instead of being emailed.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port (default `5000`; Passenger sets this on cPanel) |
| `JWT_SECRET` | **Yes** | Secret for signing JWT tokens |
| `DB_HOST` | **Yes** | MySQL host |
| `DB_PORT` | No | MySQL port (default `3306`) |
| `DB_USER` | **Yes** | MySQL username |
| `DB_PASSWORD` | **Yes** | MySQL password |
| `DB_NAME` | **Yes** | Database name (`task_reminder`) |
| `SMTP_HOST` | No* | SMTP host (default `smtp.gmail.com`) |
| `SMTP_PORT` | No | SMTP port (default `587`) |
| `SMTP_SECURE` | No | `true` or `false` |
| `SMTP_USER` | No* | Gmail address for SMTP |
| `SMTP_PASS` | No* | Gmail App Password |
| `EMAIL_FROM` | No | Sender display for auth emails, e.g. `Yadhwala <you@gmail.com>` |
| `FRONTEND_URL` | **Yes** | CORS origin + links in verification emails |
| `WHATSAPP_SERVICE_URL` | No** | Render/local WhatsApp service base URL (no trailing slash) |
| `CRON_SECRET` | **Yes*** | Secret for `GET /api/trigger-reminders?secret=...` |

\* Required for real email in production. Without SMTP, OTPs log to console.  
\** Required for WhatsApp reminders.  
\*** Must be set in production or the trigger endpoint is effectively open.

### Frontend (build-time)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | API base URL. Default: `http://localhost:5000`. Production: `https://api.yadhwala.com/api` |

`VITE_API_URL` is embedded at **build time**. Rebuild after changing it:

```bash
cd frontend
VITE_API_URL=https://api.yadhwala.com/api npm run build
```

### WhatsApp service

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port (default `5001`; Render sets automatically) |

Session is stored in `auth_info_baileys/` (gitignored).

---

## Database Setup

### Tables

#### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | Auto-increment |
| `name` | VARCHAR(100) | Full name |
| `mobile` | VARCHAR(20) | Used for WhatsApp (10-digit Indian numbers work best) |
| `email` | VARCHAR(150) UNIQUE | Full Gmail address |
| `password_hash` | VARCHAR(255) | bcrypt hash |
| `otp` | VARCHAR(6) | Verification / reset OTP |
| `is_active` | TINYINT(1) | `0` until email verified |
| `is_admin` | BOOLEAN | Legacy flag; kept in sync with `role` |
| `role` | ENUM | `user`, `admin`, `superadmin` |
| `created_at` | TIMESTAMP | Registration time |

#### `tasks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | Auto-increment |
| `user_id` | INT FK | → `users.id` (CASCADE delete) |
| `title` | VARCHAR(200) | Task name |
| `description` | TEXT | Optional purpose/details |
| `status` | ENUM | `new`, `upcoming`, `completed` |
| `due_date` | DATE | Reminder day (required when creating via API) |
| `has_reminder` | BOOLEAN | Enable time-based reminders |
| `reminder_time` | TIME | Meaning depends on reminder type |
| `reminder_type` | ENUM | `exact_time`, `every_hour`, `30_min_prior`, `1_hour_prior` |
| `created_at` | TIMESTAMP | Creation time |

#### `task_notification_log`

Prevents duplicate reminder sends. Unique key on `(task_id, slot_key)`.

#### `site_analytics`

Single row (`id = 1`) with `visitor_count`, incremented on each `GET /api/visitor-count`.

### Promote superadmin

```sql
UPDATE users SET role = 'superadmin', is_admin = 1 WHERE email = 'your@gmail.com';
```

---

## Reminder System

Reminders are **not** sent by the frontend. An **external cron job** calls the backend every minute; the server finds matching tasks and sends email + WhatsApp.

### How scheduling works

1. External cron → `GET /api/trigger-reminders?secret=CRON_SECRET`
2. Server responds `200` immediately
3. `processReminderNotifications()` runs in the background
4. Tasks are matched using the **server's local date and time** (cPanel server timezone)
5. Each sent reminder is logged in `task_notification_log` to prevent duplicates

### Reminder types (all fully implemented)

| Type | What `reminder_time` means | When you are notified |
|------|---------------------------|------------------------|
| **Exact Time** | The notification time | Once, at that `HH:MM` on `due_date` |
| **30 min prior** | The event/deadline time | Once, 30 minutes before `due_date + reminder_time` |
| **1 hour prior** | The event/deadline time | Once, 60 minutes before `due_date + reminder_time` |
| **Every hour in a day** | The **deadline** (when reminders stop) | Every hour at `:00` on `due_date` until the deadline |

### Every hour — detailed behavior

- Fires at **1:00, 2:00, 3:00, …** (minute = 0) on the **due date only**
- `reminder_time` is **not** used to pick which hours fire; it defines when the task **auto-completes** and reminders stop
- Example: due date today, time `17:00`, type **Every hour** → reminders at each hour until ~5 PM, then task marked completed

### Auto-completion

Tasks with `status = upcoming` are automatically set to `completed` when:

- **With reminder:** `due_date + reminder_time` is in the past
- **Without reminder:** `due_date` is before today

### External cron setup (production)

**cPanel → Cron Jobs** — run every minute:

```bash
curl -fsS "https://api.yadhwala.com/api/trigger-reminders?secret=YOUR_CRON_SECRET"
```

**Important:**

- Use **only one** cron job (duplicate crons = duplicate emails)
- Do **not** run local dev backend against the production database while cron is active
- Ensure deployed `server.js` has **no** `node-cron` / `cron.schedule`

---

## WhatsApp Microservice

The main API does not connect to WhatsApp directly. It calls a separate service over HTTP.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{ status, whatsappReady }` |
| GET | `/qr` | QR code page for linking WhatsApp |
| POST | `/send-message` | Body: `{ mobile, message }` |

### Setup (Render)

1. Deploy `whatsapp-service` to Render (Node 20.x)
2. Visit `https://your-app.onrender.com/qr` and scan with WhatsApp
3. Confirm `GET /health` returns `whatsappReady: true`
4. Set `WHATSAPP_SERVICE_URL=https://your-app.onrender.com` in backend `.env`
5. Restart the main API

The main API pings `/health` on each reminder tick to keep Render awake and retries WhatsApp sends up to 3 times on HTTP 503.

### Mobile number format

10-digit Indian numbers (e.g. `9876543210`) are auto-prefixed with `91`. Store the number you used at signup in the `users.mobile` column.

---

## Production Deployment

### Frontend (cPanel static hosting)

```bash
cd frontend
# Set VITE_API_URL for production build
npm run build
# Upload contents of frontend/dist/ to public_html (or subdomain docroot)
```

### Backend (cPanel Node.js / Phusion Passenger)

1. Upload `backend/` (excluding `node_modules`)
2. Run `npm install --production` on the server
3. Configure environment variables in cPanel (all `backend/.env` keys)
4. Set application root to `backend/server.js`
5. Restart the Node application after env or code changes

### Checklist

- [ ] MySQL database created from `schema.sql`
- [ ] `JWT_SECRET`, `CRON_SECRET`, and DB credentials set
- [ ] `FRONTEND_URL` matches your live frontend origin (CORS)
- [ ] `WHATSAPP_SERVICE_URL` points to Render; QR scanned
- [ ] External cron configured (one job only)
- [ ] Frontend built with correct `VITE_API_URL`
- [ ] Superadmin promoted via SQL
- [ ] `GET /api/health` returns `{ "status": "ok" }`
- [ ] Local dev backend **not** connected to production DB

---

## API Reference

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/captcha/image` | SVG captcha + token (signup) |
| GET | `/api/captcha/math` | Math captcha + token (login) |
| POST | `/api/auth/signup` | Register; sends OTP email |
| POST | `/api/auth/verify` | Verify OTP; activate account |
| POST | `/api/auth/login` | Login; returns JWT |
| POST | `/api/auth/forgot-password` | Send password reset OTP |
| POST | `/api/auth/reset-password` | Reset password with OTP |
| POST | `/api/contact` | Public contact form |
| GET | `/api/visitor-count` | Increment and return visitor count |
| GET | `/api/health` | Database connectivity check |
| GET | `/api/trigger-reminders?secret=` | Trigger reminder processing (cron only) |

### Protected (JWT)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/tasks` | User | Tasks grouped by status |
| POST | `/api/tasks` | User | Create task |
| PUT | `/api/tasks/:id` | User | Update task |
| DELETE | `/api/tasks/:id` | User | Delete task |
| GET | `/api/admin/stats` | Admin+ | Per-user task statistics |
| GET | `/api/admin/users` | Superadmin | Full user list |
| PUT | `/api/admin/users/:id/role` | Superadmin | Promote/revoke admin |

**Auth header for protected routes:**

```
Authorization: Bearer <jwt_token>
```

---

## Frontend Routes

| Route | Page | Access |
|-------|------|--------|
| `/` | Home | Public |
| `/about` | About | Public |
| `/testimonials` | Testimonials | Public |
| `/contact` | Contact | Public |
| `/privacy` | Privacy Policy | Public |
| `/signup` | Signup | Public (redirect if logged in) |
| `/login` | Login | Public (redirect if logged in) |
| `/verify` | Verify OTP | Public |
| `/forgot-password` | Forgot Password | Public |
| `/reset-password` | Reset Password | Public |
| `/dashboard` | Task dashboard | JWT required |
| `/admin` | Admin panel | JWT required (admin/superadmin) |

---

## Admin & Roles

| Role | Capabilities |
|------|-------------|
| `user` | Own tasks only |
| `admin` | View admin stats (all users' task counts) |
| `superadmin` | Admin stats + user list + promote/revoke admin |

Superadmin accounts cannot be demoted via the API. The admin panel shows extra columns (role, actions) only for superadmins.

---

## Application Flows

### Signup → Dashboard

```
/signup → email OTP → /verify → /login → /dashboard
```

1. **Signup** — name, mobile, Gmail prefix, password, image captcha → inactive user + OTP email
2. **Verify** — enter OTP → `is_active = 1`
3. **Login** — Gmail prefix, password, math captcha → JWT stored in `localStorage`
4. **Dashboard** — create/edit/delete tasks; reminders fire server-side on schedule

### Password reset

```
/forgot-password → OTP email → /reset-password → /login
```

### Task reminder (server-side)

```
User creates task with reminder → stored in MySQL
External cron (every minute) → /api/trigger-reminders
  → match tasks for current date/time
  → email + WhatsApp → log slot in task_notification_log
```

---

## Scripts

### Backend (`backend/`)

| Command | Description |
|---------|-------------|
| `npm start` | Start API server |
| `npm run dev` | Start with file watch (`node --watch`) |

### Frontend (`frontend/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |

### WhatsApp service (`whatsapp-service/`)

| Command | Description |
|---------|-------------|
| `npm start` | Start WhatsApp service |
| `npm run dev` | Start with file watch |

---

## Security

- Passwords: **bcrypt** (10 rounds)
- Sessions: **JWT**, 24-hour expiry
- Captcha: server-side tokens, 5-minute TTL, single-use
- CORS: restricted to `FRONTEND_URL`
- Cron endpoint: protected by `CRON_SECRET` query parameter
- SQL: parameterized queries throughout
- Admin routes: middleware role checks
- WhatsApp credentials: isolated in microservice; main API has no WA secrets

**Production requirements:**

- Set strong `JWT_SECRET` and `CRON_SECRET`
- Never commit `.env` files
- Run only one reminder trigger source against production DB

---

## Troubleshooting

### No WhatsApp messages

1. Check `WHATSAPP_SERVICE_URL` in cPanel backend env (not `localhost`)
2. Visit Render `/health` — `whatsappReady` must be `true`
3. Re-scan QR at `/qr` if session expired
4. Check cPanel error logs for `[WHATSAPP-SERVICE ERROR]`
5. Test directly: `curl -X POST https://your-render-app.onrender.com/send-message -H "Content-Type: application/json" -d '{"mobile":"9876543210","message":"test"}'`
6. Confirm `users.mobile` is a valid 10-digit number

### Duplicate reminder emails

Usually means **two backends** both processing reminders:

- Old code with `node-cron` still deployed **and** external cron active
- Local dev backend using production database
- Two cPanel cron jobs hitting the trigger URL

Fix: one cron job, one production backend, stop local dev against prod DB, redeploy latest `server.js`.

### Reminders not firing at exact minute

- External cron must run **every minute**
- Reminder times use **server local timezone** (cPanel server clock)
- Missed minute = missed exact-time reminder (no catch-up)

### Frontend can't reach API

- Rebuild frontend with correct `VITE_API_URL`
- Ensure `FRONTEND_URL` in backend matches your frontend origin (CORS)
- Check browser Network tab — requests should go to `api.yadhwala.com`, not `localhost`

### Gmail SMTP errors

- Use an [App Password](https://myaccount.google.com/apppasswords), not your account password
- Enable 2-Step Verification on Google account
- Do not wrap `DB_PASSWORD` in quotes in `.env` if it causes parse issues

---

## Gmail SMTP Setup

1. Enable **2-Step Verification** on your Google account.
2. Create an **App Password** at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Add to `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_char_app_password
EMAIL_FROM=Yadhwala <your_email@gmail.com>
```

---

## License

This project was built as a **Web Technology Internship** assignment.

---

## Further Reading

- [`architecture.md`](./architecture.md) — exhaustive technical documentation (schema, data flows, Baileys deep dive, deployment topology)
