require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const svgCaptcha = require('svg-captcha');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// In-memory captcha store: token -> { value, expiresAt }
const captchaStore = new Map();
const CAPTCHA_TTL_MS = 5 * 60 * 1000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'task_reminder',
  waitForConnections: true,
  connectionLimit: 10,
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function storeCaptcha(value) {
  const token = uuidv4();
  captchaStore.set(token, { value: String(value), expiresAt: Date.now() + CAPTCHA_TTL_MS });
  return token;
}

function validateCaptcha(token, answer) {
  if (!token || answer === undefined || answer === null) return false;
  const entry = captchaStore.get(token);
  captchaStore.delete(token);
  if (!entry || Date.now() > entry.expiresAt) return false;
  return entry.value.toLowerCase() === String(answer).trim().toLowerCase();
}

function cleanupExpiredCaptchas() {
  const now = Date.now();
  for (const [token, entry] of captchaStore.entries()) {
    if (now > entry.expiresAt) captchaStore.delete(token);
  }
}

setInterval(cleanupExpiredCaptchas, 60 * 1000);

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateMathCaptcha() {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const operators = ['+', '-'];
  const op = operators[Math.floor(Math.random() * operators.length)];
  const answer = op === '+' ? a + b : a - b;
  const question = `${a} ${op} ${b} = ?`;
  return { question, answer };
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// --- Captcha endpoints ---

app.get('/api/captcha/image', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 5,
    noise: 2,
    color: true,
    background: '#f0f4f8',
  });
  const token = storeCaptcha(captcha.text);
  res.json({ token, svg: captcha.data });
});

app.get('/api/captcha/math', (req, res) => {
  const { question, answer } = generateMathCaptcha();
  const token = storeCaptcha(answer);
  res.json({ token, question });
});

// --- Auth endpoints ---

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, mobile, email, password, captchaToken, captchaAnswer } = req.body;

    if (!name || !mobile || !email || !password || !captchaToken || !captchaAnswer) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!validateCaptcha(captchaToken, captchaAnswer)) {
      return res.status(400).json({ message: 'Invalid or expired captcha' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = generateOtp();

    await pool.query(
      'INSERT INTO users (name, mobile, email, password_hash, otp, is_active) VALUES (?, ?, ?, ?, ?, 0)',
      [name, mobile, email, passwordHash, otp]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verifyLink = `${frontendUrl}/verify?email=${encodeURIComponent(email)}`;

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Verify your Task Reminder account',
        html: `
          <h2>Welcome to Task Reminder!</h2>
          <p>Your verification OTP is: <strong>${otp}</strong></p>
          <p>Or click the link below to verify your account:</p>
          <p><a href="${verifyLink}">${verifyLink}</a></p>
          <p>This OTP expires when you verify your account.</p>
        `,
      });
    } else {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
      console.log(`[DEV] Verify link: ${verifyLink}`);
    }

    res.status(201).json({
      message: 'Signup successful. Please check your email for the verification OTP.',
      email,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error during signup' });
  }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const [rows] = await pool.query(
      'SELECT id, otp, is_active FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = rows[0];

    if (user.is_active) {
      return res.status(400).json({ message: 'Account already verified' });
    }

    if (String(user.otp) !== String(otp).trim()) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    await pool.query('UPDATE users SET is_active = 1, otp = NULL WHERE id = ?', [user.id]);

    res.json({ message: 'Account verified successfully. You can now log in.' });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ message: 'Server error during verification' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, captchaToken, captchaAnswer } = req.body;

    if (!email || !password || !captchaToken || captchaAnswer === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!validateCaptcha(captchaToken, captchaAnswer)) {
      return res.status(400).json({ message: 'Invalid or expired math captcha' });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash, is_active FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Account not verified. Please verify your email first.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// --- Tasks endpoint ---

app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const [tasks] = await pool.query(
      'SELECT id, title, description, status, due_date, created_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    const grouped = {
      new: [],
      upcoming: [],
      completed: [],
    };

    for (const task of tasks) {
      const status = (task.status || 'new').toLowerCase();
      if (grouped[status]) {
        grouped[status].push(task);
      } else {
        grouped.new.push(task);
      }
    }

    res.json(grouped);
  } catch (err) {
    console.error('Tasks error:', err);
    res.status(500).json({ message: 'Server error fetching tasks' });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'database unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`Task Reminder API running on http://localhost:${PORT}`);
});
