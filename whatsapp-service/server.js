require('dotenv').config();

const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 5001;

let isClientReady = false;

app.use(cors());
app.use(express.json());

function resolveChromeExecutablePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];

  return candidates.find((path) => fs.existsSync(path)) || null;
}

function formatWhatsAppNumber(mobile) {
  const digits = String(mobile).replace(/\D/g, '');
  let number = digits;

  if (number.length === 10) {
    number = `91${number}`;
  }

  return `${number}@c.us`;
}

const chromeExecutablePath = resolveChromeExecutablePath();
const puppeteerOptions = {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
};

if (chromeExecutablePath) {
  puppeteerOptions.executablePath = chromeExecutablePath;
  console.log(`[WHATSAPP] Using Chrome at: ${chromeExecutablePath}`);
} else {
  console.warn('[WHATSAPP] Chrome not found. Set CHROME_PATH in .env if needed.');
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: puppeteerOptions,
});

client.on('qr', (qr) => {
  console.log('[WHATSAPP] Scan the QR code below to authenticate:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  isClientReady = true;
  console.log('[WHATSAPP] Client is ready!');
});

client.on('auth_failure', (msg) => {
  isClientReady = false;
  console.error('[WHATSAPP] Authentication failure:', msg);
});

client.on('disconnected', (reason) => {
  isClientReady = false;
  console.warn('[WHATSAPP] Client disconnected:', reason);
});

client.initialize().catch((err) => {
  isClientReady = false;
  console.error('[WHATSAPP] Failed to initialize:', err.message);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', whatsappReady: isClientReady });
});

app.post('/send-message', async (req, res) => {
  const { mobile, message } = req.body;

  if (!isClientReady) {
    return res.status(503).json({ message: 'WhatsApp client is not ready' });
  }

  if (!mobile || !message) {
    return res.status(400).json({ message: 'mobile and message are required' });
  }

  try {
    const formattedNumber = formatWhatsAppNumber(mobile);
    await client.sendMessage(formattedNumber, message);
    return res.status(200).json({
      message: 'Message sent successfully',
      to: formattedNumber,
    });
  } catch (err) {
    console.error('[WHATSAPP] Send failed:', err.message);
    return res.status(500).json({ message: 'Failed to send WhatsApp message' });
  }
});

app.listen(PORT, () => {
  console.log(`WhatsApp microservice running on http://localhost:${PORT}`);
});
