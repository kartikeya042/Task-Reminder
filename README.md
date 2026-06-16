# Yadhwala

A full-stack task management web application with secure authentication, email verification, and a kanban-style dashboard that groups tasks by status.

## Features

- **User signup** with SVG image captcha (`svg-captcha`)
- **Email verification** via 6-digit OTP sent through SMTP (`nodemailer`)
- **Login** with custom math captcha and JWT session tokens
- **Protected dashboard** showing tasks in three columns: New, Upcoming, and Completed
- **Gmail-only email input** — users type only their prefix; `@gmail.com` is appended automatically on signup and login

## Tech Stack

| Layer    | Technologies |
|----------|--------------|
| Frontend | React 18, Vite, React Router DOM, CSS |
| Backend  | Node.js, Express.js |
| Database | MySQL (`mysql2`) |
| Security | bcrypt, jsonwebtoken, server-side captcha tokens |
| Email    | nodemailer (standard SMTP) |

## Project Structure

```
Task-Reminder/
├── backend/
│   ├── server.js          # Express API server
│   ├── package.json
│   ├── .env.example       # Environment variable template
│   └── schema.sql         # MySQL table definitions
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Routes and auth guards
│   │   ├── Signup.jsx
│   │   ├── Login.jsx
│   │   ├── VerifyOTP.jsx
│   │   ├── Dashboard.jsx
│   │   ├── api.js
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MySQL](https://dev.mysql.com/downloads/) running locally
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) for SMTP (optional for local dev)

## Database Setup

1. Start MySQL and create the database:

```bash
mysql -u root -p
```

2. Run the schema (or confirm your existing tables match):

```bash
mysql -u root -p < backend/schema.sql
```

### Expected Tables

**`users`**

| Column         | Type        | Notes                    |
|----------------|-------------|--------------------------|
| `id`           | INT         | Primary key              |
| `name`         | VARCHAR     | Full name                |
| `mobile`       | VARCHAR     | Mobile number            |
| `email`        | VARCHAR     | Unique, full Gmail address |
| `password_hash`| VARCHAR     | bcrypt hash              |
| `otp`          | VARCHAR(6)  | Verification OTP         |
| `is_active`    | TINYINT     | `0` until verified       |

**`tasks`**

| Column        | Type   | Notes                                      |
|---------------|--------|--------------------------------------------|
| `id`          | INT    | Primary key                                |
| `user_id`     | INT    | Foreign key → `users.id`                   |
| `title`       | VARCHAR| Task title                                 |
| `description` | TEXT   | Optional details                           |
| `status`      | ENUM   | `new`, `upcoming`, or `completed`          |
| `due_date`    | DATE   | Optional                                   |

### Sample Tasks (optional)

After creating a user, insert test tasks (replace `1` with the user's `id`):

```sql
INSERT INTO tasks (user_id, title, description, status, due_date) VALUES
(1, 'Review assignment', 'Check web tech homework', 'new', NULL),
(1, 'Team meeting', 'Weekly sync call', 'upcoming', '2026-06-15'),
(1, 'Submit report', 'Final internship report', 'completed', '2026-06-01');
```

## Environment Configuration

From the project root, go to the `backend` directory and create a `.env` file from the example template:

- **macOS / Linux:** `cp .env.example .env`
- **Windows (Command Prompt):** `copy .env.example .env`
- **Windows (PowerShell):** `Copy-Item .env.example .env`

Then fill in your values in `backend/.env`.

| Variable       | Description |
|----------------|-------------|
| `PORT`         | Backend port (default: `3000`) |
| `JWT_SECRET`   | Secret key for signing JWT tokens |
| `DB_HOST`      | MySQL host (`127.0.0.1` or `localhost`) |
| `DB_PORT`      | MySQL port (default: `3306`) |
| `DB_USER`      | MySQL username |
| `DB_PASSWORD`  | MySQL password |
| `DB_NAME`      | Database name (`task_reminder`) |
| `SMTP_*`       | Gmail SMTP credentials |
| `EMAIL_FROM`   | Sender display name and address |
| `FRONTEND_URL` | Frontend origin for verification links |

> **Dev tip:** If SMTP credentials are not set, the backend logs the OTP and verify link to the console instead of sending email.

## Installation & Running

Run these commands from the project root unless noted otherwise.

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Start the backend

```bash
cd backend
npm run dev
```

API available at `http://localhost:3000`

### 3. Start the frontend (separate terminal)

```bash
cd frontend
npm run dev
```

App available at `http://localhost:5173`

## Application Flow

```
Signup → Verify OTP → Login → Dashboard
```

1. **Signup** (`/signup`) — User enters name, mobile, Gmail prefix, password, and image captcha. Backend hashes the password, stores the user as inactive, and emails a 6-digit OTP.
2. **Verify** (`/verify?email=...`) — User enters the OTP. Backend sets `is_active = 1`.
3. **Login** (`/login`) — User enters Gmail prefix, password, and solves the math captcha. Backend returns a JWT.
4. **Dashboard** (`/dashboard`) — Protected route fetches and displays tasks grouped by status.

## API Endpoints

| Method | Endpoint              | Auth | Description |
|--------|-----------------------|------|-------------|
| GET    | `/api/captcha/image`  | No   | Generate SVG captcha + token |
| GET    | `/api/captcha/math`   | No   | Generate math captcha + token |
| POST   | `/api/auth/signup`    | No   | Register user, send OTP email |
| POST   | `/api/auth/verify`    | No   | Verify OTP, activate account |
| POST   | `/api/auth/login`     | No   | Login, return JWT |
| GET    | `/api/tasks`          | JWT  | Fetch user's tasks by status |
| GET    | `/api/health`         | No   | Health check |

### Auth Header (protected routes)

```
Authorization: Bearer <jwt_token>
```

## Frontend Routes

| Route        | Component   | Access    |
|--------------|-------------|-----------|
| `/`          | Redirect    | Public    |
| `/signup`    | Signup      | Public    |
| `/login`     | Login       | Public    |
| `/verify`    | VerifyOTP   | Public    |
| `/dashboard` | Dashboard   | Protected |

## Gmail SMTP Setup

1. Enable 2-Step Verification on your Google account.
2. Generate an App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Set in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_char_app_password
EMAIL_FROM=Yadhwala <your_email@gmail.com>
```

## Scripts

### Backend

| Command       | Description |
|---------------|-------------|
| `npm start`   | Start server |
| `npm run dev` | Start with file watch |

### Frontend

| Command         | Description |
|-----------------|-------------|
| `npm run dev`     | Start Vite dev server |
| `npm run build`   | Production build |
| `npm run preview` | Preview production build |

## Security Notes

- Passwords are hashed with **bcrypt** (10 salt rounds).
- Captcha answers are stored server-side with UUID tokens and expire after 5 minutes (single use).
- JWT tokens expire after 24 hours.
- No third-party APIs are used for captcha or email.

## License

This project was built as a Web Technology Internship assignment.
