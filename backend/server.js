require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const svgCaptcha = require('svg-captcha');
const cron = require('node-cron');
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

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const [rows] = await pool.query(
      'SELECT id, email, is_active FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'Account not verified. Please verify your email first.' });
    }

    const otp = generateOtp();

    await pool.query('UPDATE users SET otp = ? WHERE id = ?', [otp, user.id]);

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Reset your Task Reminder password',
        html: `
          <h2>Password Reset</h2>
          <p>Your password reset OTP is: <strong>${otp}</strong></p>
          <p>This OTP is valid until you reset your password.</p>
        `,
      });
    } else {
      console.log(`[DEV] Password reset OTP for ${email}: ${otp}`);
    }

    res.json({ message: 'Password reset OTP sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error during password reset request' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const [rows] = await pool.query(
      'SELECT id, otp FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = rows[0];

    if (!user.otp || String(user.otp) !== String(otp).trim()) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password_hash = ?, otp = NULL WHERE id = ?',
      [passwordHash, user.id]
    );

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error during password reset' });
  }
});

// --- Notification helpers ---

function parseMysqlDate(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    return date.includes('T') ? date.split('T')[0] : date.slice(0, 10);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeDueDate(dueDate) {
  if (!dueDate) return null;
  const str = parseMysqlDate(dueDate);
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
}

function formatTaskRow(task) {
  return {
    ...task,
    due_date: task.due_date ? parseMysqlDate(task.due_date) : null,
    has_reminder: Boolean(task.has_reminder),
    reminder_time: task.reminder_time
      ? String(task.reminder_time).slice(0, 8)
      : null,
  };
}

function getLocalDateTimeParts(now = new Date()) {
  const currentLocalDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  const currentLocalTime = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join(':');

  return {
    currentLocalDate,
    currentLocalTime,
    currentLocalMinute: now.getMinutes(),
  };
}

function buildNotificationSlotKey(task, currentLocalDate, currentLocalTime) {
  switch (task.reminder_type) {
    case 'exact_time':
      return `exact_time:${currentLocalDate}:${currentLocalTime}`;
    case '30_min_prior':
      return `30_min_prior:${currentLocalDate}:${currentLocalTime}`;
    case '1_hour_prior':
      return `1_hour_prior:${currentLocalDate}:${currentLocalTime}`;
    case 'every_hour':
      return `every_hour:${currentLocalDate}:${currentLocalTime.split(':')[0]}`;
    default:
      return null;
  }
}

async function wasNotificationSent(taskId, slotKey) {
  const [rows] = await pool.query(
    'SELECT id FROM task_notification_log WHERE task_id = ? AND slot_key = ?',
    [taskId, slotKey]
  );
  return rows.length > 0;
}

async function recordNotificationSent(taskId, slotKey) {
  await pool.query(
    'INSERT INTO task_notification_log (task_id, slot_key) VALUES (?, ?)',
    [taskId, slotKey]
  );
}

async function sendReminderEmail(email, task) {
  const dueDate = parseMysqlDate(task.due_date);
  const message = `Reminder for your task "${task.title}"${task.description ? `: ${task.description}` : ''}. Due date: ${dueDate}.`;

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: `Task Reminder: ${task.title}`,
      html: `<h2>Task Reminder</h2><p>${message}</p>`,
    });
  } else {
    console.log(`[DEV] Reminder email to ${email}: ${message}`);
  }
}

// Stub — replace with Twilio, whatsapp-web.js, or another WhatsApp provider integration.
async function sendWhatsAppNotification(mobile, message) {
  console.log(`[WHATSAPP STUB] Sending message to ${mobile}: ${message}`);
}

async function autoCompleteExpiredTasks(currentLocalDate, currentLocalTime) {
  const [result] = await pool.query(
    `
    UPDATE tasks
    SET status = 'completed'
    WHERE status = 'upcoming'
      AND (
        (has_reminder = TRUE AND reminder_time IS NOT NULL
          AND TIMESTAMP(due_date, reminder_time) < TIMESTAMP(?, ?))
        OR
        ((has_reminder = FALSE OR reminder_time IS NULL)
          AND due_date < ?)
      )
    `,
    [currentLocalDate, `${currentLocalTime}:00`, currentLocalDate]
  );

  if (result.affectedRows > 0) {
    console.log(`[CRON] Auto-completed ${result.affectedRows} expired task(s)`);
  }
}

async function processReminderNotifications() {
  const now = new Date();
  const { currentLocalDate, currentLocalTime, currentLocalMinute } = getLocalDateTimeParts(now);

  console.log(`[CRON TICK] Checking for reminders at Local Time: ${currentLocalTime}`);

  try {
    await autoCompleteExpiredTasks(currentLocalDate, currentLocalTime);

    const [tasks] = await pool.query(
      `
      SELECT t.id, t.title, t.description, t.due_date, t.reminder_time, t.reminder_type,
             t.has_reminder, u.email, u.mobile, u.name
      FROM tasks t
      JOIN users u ON t.user_id = u.id
      WHERE t.has_reminder = TRUE
        AND t.due_date = ?
        AND t.reminder_time IS NOT NULL
        AND t.reminder_type IS NOT NULL
        AND t.status != 'completed'
        AND (
          (t.reminder_type = 'exact_time'
            AND DATE_FORMAT(t.reminder_time, '%H:%i') = ?)
          OR (t.reminder_type = '30_min_prior'
            AND DATE_FORMAT(
              DATE_SUB(CONCAT(t.due_date, ' ', t.reminder_time), INTERVAL 30 MINUTE),
              '%H:%i'
            ) = ?)
          OR (t.reminder_type = '1_hour_prior'
            AND DATE_FORMAT(
              DATE_SUB(CONCAT(t.due_date, ' ', t.reminder_time), INTERVAL 60 MINUTE),
              '%H:%i'
            ) = ?)
          OR (t.reminder_type = 'every_hour' AND ? = 0)
        )
      `,
      [
        currentLocalDate,
        currentLocalTime,
        currentLocalTime,
        currentLocalTime,
        currentLocalMinute,
      ]
    );

    for (const task of tasks) {
      const slotKey = buildNotificationSlotKey(task, currentLocalDate, currentLocalTime);
      if (!slotKey) continue;

      const alreadySent = await wasNotificationSent(task.id, slotKey);
      if (alreadySent) continue;

      const dueDate = parseMysqlDate(task.due_date);
      const message = `Reminder: "${task.title}" is due on ${dueDate}.`;

      await sendReminderEmail(task.email, task);
      await sendWhatsAppNotification(task.mobile, message);
      await recordNotificationSent(task.id, slotKey);

      console.log(`[REMINDER] Sent for task #${task.id} (${slotKey})`);
    }
  } catch (err) {
    console.error('Reminder cron error:', err);
  }
}

cron.schedule('* * * * *', processReminderNotifications);

// --- Tasks endpoints ---

app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const [tasks] = await pool.query(
      `SELECT id, title, description, status,
              DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
              has_reminder, reminder_time, reminder_type, created_at
       FROM tasks WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );

    const grouped = {
      upcoming: [],
      completed: [],
    };

    for (const task of tasks) {
      const formatted = formatTaskRow(task);
      const status = (formatted.status || 'upcoming').toLowerCase();
      if (status === 'completed') {
        grouped.completed.push(formatted);
      } else {
        grouped.upcoming.push(formatted);
      }
    }

    res.json(grouped);
  } catch (err) {
    console.error('Tasks error:', err);
    res.status(500).json({ message: 'Server error fetching tasks' });
  }
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { title, description, due_date, status, has_reminder, reminder_time, reminder_type } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Task name is required' });
    }

    const normalizedDueDate = normalizeDueDate(due_date);
    if (!normalizedDueDate) {
      return res.status(400).json({ message: 'A valid reminder date (YYYY-MM-DD) is required' });
    }

    const validStatuses = ['upcoming', 'completed'];
    const taskStatus = validStatuses.includes(status) ? status : 'upcoming';

    const wantsReminder = Boolean(has_reminder);

    if (wantsReminder) {
      if (!reminder_time) {
        return res.status(400).json({ message: 'Reminder time is required when time reminder is enabled' });
      }
      const validTypes = ['exact_time', 'every_hour', '30_min_prior', '1_hour_prior'];
      if (!reminder_type || !validTypes.includes(reminder_type)) {
        return res.status(400).json({ message: 'A valid reminder type is required' });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO tasks
        (user_id, title, description, status, due_date, has_reminder, reminder_time, reminder_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        title.trim(),
        description?.trim() || null,
        taskStatus,
        normalizedDueDate,
        wantsReminder,
        wantsReminder ? reminder_time : null,
        wantsReminder ? reminder_type : null,
      ]
    );

    const [rows] = await pool.query(
      `SELECT id, title, description, status,
              DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
              has_reminder, reminder_time, reminder_type, created_at
       FROM tasks WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(formatTaskRow(rows[0]));
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ message: 'Server error creating task' });
  }
});

app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const taskId = req.params.id;
    const { title, description, due_date, status, has_reminder, reminder_time, reminder_type } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Task name is required' });
    }

    const normalizedDueDate = normalizeDueDate(due_date);
    if (!normalizedDueDate) {
      return res.status(400).json({ message: 'A valid reminder date (YYYY-MM-DD) is required' });
    }

    const validStatuses = ['upcoming', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'A valid status (upcoming or completed) is required' });
    }

    const wantsReminder = Boolean(has_reminder);

    if (wantsReminder) {
      if (!reminder_time) {
        return res.status(400).json({ message: 'Reminder time is required when time reminder is enabled' });
      }
      const validTypes = ['exact_time', 'every_hour', '30_min_prior', '1_hour_prior'];
      if (!reminder_type || !validTypes.includes(reminder_type)) {
        return res.status(400).json({ message: 'A valid reminder type is required' });
      }
    }

    const [existing] = await pool.query(
      'SELECT id FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await pool.query(
      `UPDATE tasks
       SET title = ?, description = ?, due_date = ?, status = ?,
           has_reminder = ?, reminder_time = ?, reminder_type = ?
       WHERE id = ? AND user_id = ?`,
      [
        title.trim(),
        description?.trim() || null,
        normalizedDueDate,
        status,
        wantsReminder,
        wantsReminder ? reminder_time : null,
        wantsReminder ? reminder_type : null,
        taskId,
        req.user.id,
      ]
    );

    const [rows] = await pool.query(
      `SELECT id, title, description, status,
              DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
              has_reminder, reminder_time, reminder_type, created_at
       FROM tasks WHERE id = ?`,
      [taskId]
    );

    res.json(formatTaskRow(rows[0]));
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ message: 'Server error updating task' });
  }
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ message: 'Server error deleting task' });
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
  console.log('Reminder notification scheduler active (runs every minute)');
});
