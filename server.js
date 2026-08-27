const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const webpush = require('web-push');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = 8000;
const DB_FILE = path.join(__dirname, 'users.json');
const SUBMISSIONS_FILE = path.join(__dirname, 'submissions.json');
const ADMINS_FILE = path.join(__dirname, 'admins.json');
const QUESTIONS_FILE = path.join(__dirname, 'questions.json');
const NOTIFICATIONS_FILE = path.join(__dirname, 'notifications.json');
const SUBSCRIPTIONS_FILE = path.join(__dirname, 'push-subscriptions.json');
const AUTO_NOTIF_CONFIG_FILE = path.join(__dirname, 'auto-notif-config.json');
const SECURITY_LOG_FILE = path.join(__dirname, 'security-log.json');

// JWT secret (generate once and persist)
const JWT_SECRET_FILE = path.join(__dirname, '.jwt-secret');
function getJwtSecret() {
  try {
    if (fs.existsSync(JWT_SECRET_FILE)) return fs.readFileSync(JWT_SECRET_FILE, 'utf8').trim();
  } catch {}
  const secret = crypto.randomBytes(64).toString('hex');
  fs.writeFileSync(JWT_SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}
const JWT_SECRET = getJwtSecret();

// VAPID keys for Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BML4-WePeQ-oZ6Cuo_Y15a5jFma0x3yJCb0avv0rVmrh4MhOj1qm5rg5M9-EWRqyzKoH2PG12qEevFoipmD1JFY';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'wcq8S1w0-ggmVjLV7yZW4pbskwZwBpo_CHSXkoOcu9M';

webpush.setVapidDetails(
  'mailto:admin@armourcare.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Master admin credentials
const MASTER_ADMIN = {
  armourNumber: 'C0610-3661',
  passwordHash: null, // Will be set on first load
  isMaster: true,
  teams: ['all']
};

// Initialize users database
function loadUsers() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
  return {};
}

function saveUsers(users) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

// Submissions database
function loadSubmissions() {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading submissions:', err);
  }
  return {};
}

function saveSubmissions(submissions) {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));
  } catch (err) {
    console.error('Error saving submissions:', err);
  }
}

// Admins database
function loadAdmins() {
  try {
    if (fs.existsSync(ADMINS_FILE)) {
      return JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading admins:', err);
  }
  // Initialize with master admin
  const defaultAdmins = {
    'C0610-3661': {
      armourNumber: 'C0610-3661',
      passwordHash: hashPasswordSync('paddy'),
      isMaster: true,
      teams: ['all'],
      createdAt: Date.now()
    }
  };
  saveAdmins(defaultAdmins);
  return defaultAdmins;
}

function saveAdmins(admins) {
  try {
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
  } catch (err) {
    console.error('Error saving admins:', err);
  }
}

// Questions database
function loadQuestions() {
  try {
    if (fs.existsSync(QUESTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading questions:', err);
  }
  return {};
}

function saveQuestions(questions) {
  try {
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questions, null, 2));
  } catch (err) {
    console.error('Error saving questions:', err);
  }
}

// Build a map of questionId -> { polarity, maxValue, section } from questions.json
// Used for scientifically correct scoring with per-question polarity
function buildQuestionMap(questionsData) {
  const map = {};
  if (!questionsData || !questionsData.categories) return map;
  
  const presets = questionsData.responsePresets || {};
  
  function getMaxValue(responseType) {
    const preset = presets[responseType];
    if (!preset) return 3;
    if (preset.type === 'buttons' && preset.options?.length) {
      return Math.max(...preset.options.map(o => Number(o.value)));
    }
    return 3;
  }
  
  function getMinValue(responseType) {
    const preset = presets[responseType];
    if (!preset) return 1;
    if (preset.type === 'buttons' && preset.options?.length) {
      return Math.min(...preset.options.map(o => Number(o.value)));
    }
    return 1;
  }
  
  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  
  // Map category titles to section keys for radar chart grouping
  function getSectionKey(catTitle) {
    const t = catTitle.toLowerCase();
    if (t.includes('burnout')) return 'burnout';
    if (t.includes('mental')) return 'mental';
    if (t.includes('sleep')) return 'sleep';
    return 'lifestyle';
  }
  
  function processQuestions(questions, catTitle, subTitle) {
    const slug = subTitle ? slugify(subTitle) : slugify(catTitle);
    const section = getSectionKey(catTitle);
    questions.forEach((q, i) => {
      const id = `${slug}-${i}`;
      const maxVal = getMaxValue(q.responseType);
      const minVal = getMinValue(q.responseType);
      map[id] = {
        polarity: q.polarity || 'positive',
        maxValue: maxVal,
        minValue: minVal,
        section,
        responseType: q.responseType,
        text: q.text
      };
    });
  }
  
  Object.values(questionsData.categories).forEach(cat => {
    if (cat.questions) {
      processQuestions(cat.questions, cat.title, null);
    }
    if (cat.subcategories) {
      Object.values(cat.subcategories).forEach(sub => {
        if (sub.questions) {
          processQuestions(sub.questions, cat.title, sub.title);
        }
      });
    }
  });
  
  return map;
}

// Calculate wellbeing score (0-100%) for a single response, accounting for polarity
// positive polarity: higher value = better wellbeing
// negative polarity: higher value = worse wellbeing
function calcWellbeingScore(value, minValue, maxValue, polarity) {
  if (maxValue === minValue) return 50;
  const normalised = (value - minValue) / (maxValue - minValue);
  if (polarity === 'negative') return Math.round((1 - normalised) * 100);
  return Math.round(normalised * 100);
}

// Notifications database
function loadNotifications() {
  try {
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading notifications:', err);
  }
  return [];
}

function saveNotifications(notifications) {
  try {
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
  } catch (err) {
    console.error('Error saving notifications:', err);
  }
}

// Push subscriptions database  { armourNumber: subscription }
function loadSubscriptions() {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading subscriptions:', err);
  }
  return {};
}

function saveSubscriptions(subs) {
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2));
  } catch (err) {
    console.error('Error saving subscriptions:', err);
  }
}

// Auto-notification config
const DEFAULT_AUTO_NOTIF_CONFIG = {
  enabled: true,
  surveyAvailable: {
    enabled: true,
    title: 'New Survey Available',
    message: 'Your monthly wellbeing survey is ready to complete. Take a few minutes to check in.',
    dayOfMonth: 1,
    hour: 9
  },
  reminder: {
    enabled: true,
    title: 'Survey Reminder',
    message: 'You haven\'t completed this month\'s wellbeing survey yet. Please take a moment to fill it in.',
    daysBeforeEnd: [7, 3, 1],
    hour: 10
  },
  lastRun: {}
};

function loadAutoNotifConfig() {
  try {
    if (fs.existsSync(AUTO_NOTIF_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(AUTO_NOTIF_CONFIG_FILE, 'utf8'));
      return { ...DEFAULT_AUTO_NOTIF_CONFIG, ...data };
    }
  } catch (err) {
    console.error('Error loading auto-notif config:', err);
  }
  return { ...DEFAULT_AUTO_NOTIF_CONFIG };
}

function saveAutoNotifConfig(config) {
  try {
    fs.writeFileSync(AUTO_NOTIF_CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Error saving auto-notif config:', err);
  }
}

// Security audit log
function loadSecurityLog() {
  try {
    if (fs.existsSync(SECURITY_LOG_FILE)) {
      return JSON.parse(fs.readFileSync(SECURITY_LOG_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading security log:', err);
  }
  return [];
}

function saveSecurityLog(logs) {
  try {
    fs.writeFileSync(SECURITY_LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('Error saving security log:', err);
  }
}

function logSecurity(event, details = {}, req = null) {
  const logs = loadSecurityLog();
  const entry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    event,
    ip: req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown') : 'system',
    ...details
  };
  logs.unshift(entry);
  // Keep last 5000 entries
  if (logs.length > 5000) logs.length = 5000;
  saveSecurityLog(logs);
}

// Send push to a list of armour numbers
async function sendPushToUsers(targetUsers, title, message, type) {
  const subs = loadSubscriptions();
  const payload = JSON.stringify({ title, body: message, icon: '/logo.png' });
  let delivered = 0;
  let failed = 0;
  
  for (const armour of targetUsers) {
    const userSubs = subs[armour];
    if (!userSubs || userSubs.length === 0) continue;
    
    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(sub, payload);
        delivered++;
      } catch (err) {
        failed++;
        if (err.statusCode === 410 || err.statusCode === 404) {
          subs[armour] = subs[armour].filter(s => s.endpoint !== sub.endpoint);
        }
      }
    }
  }
  
  saveSubscriptions(subs);
  
  // Log to notification history
  const notifications = loadNotifications();
  notifications.unshift({
    id: crypto.randomUUID(),
    title,
    message,
    recipients: targetUsers.length === Object.keys(loadUsers()).length ? 'all' : targetUsers,
    sentBy: `Auto (${type})`,
    sentAt: Date.now(),
    delivered,
    failed,
    auto: true
  });
  saveNotifications(notifications);
  
  console.log(`[Auto-Notif] ${type}: delivered=${delivered}, failed=${failed}, targets=${targetUsers.length}`);
  return { delivered, failed };
}

// Auto-notification scheduler - runs every hour
function runAutoNotifCheck() {
  const config = loadAutoNotifConfig();
  if (!config.enabled) return;
  
  const now = new Date();
  const dayOfMonth = now.getDate();
  const hour = now.getHours();
  const monthKey = getCurrentMonthKey();
  const todayKey = `${monthKey}-${String(dayOfMonth).padStart(2, '0')}`;
  
  // Ensure lastRun tracking
  if (!config.lastRun) config.lastRun = {};
  
  // 1. Survey available notification on configured day
  if (config.surveyAvailable?.enabled) {
    const surveyDay = config.surveyAvailable.dayOfMonth || 1;
    const surveyHour = config.surveyAvailable.hour ?? 9;
    const runKey = `survey-${todayKey}`;
    
    if (dayOfMonth === surveyDay && hour >= surveyHour && !config.lastRun[runKey]) {
      const users = loadUsers();
      const allUsers = Object.keys(users);
      
      if (allUsers.length > 0) {
        sendPushToUsers(
          allUsers,
          config.surveyAvailable.title,
          config.surveyAvailable.message,
          'Survey Available'
        );
        config.lastRun[runKey] = Date.now();
        saveAutoNotifConfig(config);
      }
    }
  }
  
  // 2. Reminder notifications for users who haven't submitted
  if (config.reminder?.enabled) {
    const daysBeforeEnd = config.reminder.daysBeforeEnd || [7, 3, 1];
    const reminderHour = config.reminder.hour ?? 10;
    const daysRemaining = getDaysRemaining();
    
    if (hour >= reminderHour && daysBeforeEnd.includes(daysRemaining)) {
      const runKey = `reminder-${todayKey}`;
      
      if (!config.lastRun[runKey]) {
        const users = loadUsers();
        const submissions = loadSubmissions();
        const monthSubmissions = submissions[monthKey] || {};
        
        // Find users who haven't submitted this month
        const pendingUsers = Object.keys(users).filter(armour => !monthSubmissions[armour]);
        
        if (pendingUsers.length > 0) {
          sendPushToUsers(
            pendingUsers,
            config.reminder.title,
            config.reminder.message,
            'Reminder'
          );
          config.lastRun[runKey] = Date.now();
          saveAutoNotifConfig(config);
        }
      }
    }
  }
  
  // Clean up old lastRun entries (keep only current month)
  const oldKeys = Object.keys(config.lastRun).filter(k => !k.startsWith(monthKey));
  if (oldKeys.length > 0) {
    oldKeys.forEach(k => delete config.lastRun[k]);
    saveAutoNotifConfig(config);
  }
}

// Start scheduler - check every hour
setInterval(runAutoNotifCheck, 60 * 60 * 1000);
// Also run on startup after a short delay
setTimeout(runAutoNotifCheck, 10000);

// Get current month key (YYYY-MM)
function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Get days remaining in month
function getDaysRemaining() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

// Password hashing with bcrypt
const BCRYPT_ROUNDS = 12;

function hashPasswordSync(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

async function hashPasswordAsync(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Legacy SHA-256 for migration
function legacyHash(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Compare password: supports both bcrypt and legacy SHA-256 hashes
async function verifyPassword(password, storedHash) {
  // Bcrypt hashes start with $2a$ or $2b$
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(password, storedHash);
  }
  // Legacy SHA-256 hash (64 hex chars)
  return storedHash === legacyHash(password);
}

// Migrate a legacy hash to bcrypt if needed, returns new hash or null
async function migrateHash(password, storedHash) {
  if (!storedHash.startsWith('$2')) {
    // Legacy hash, upgrade to bcrypt
    return hashPasswordAsync(password);
  }
  return null;
}

// JWT helpers
function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Rate limiter (in-memory)
const rateLimits = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max attempts per window

function checkRateLimit(key) {
  const now = Date.now();
  if (!rateLimits[key]) rateLimits[key] = [];
  // Remove old entries
  rateLimits[key] = rateLimits[key].filter(t => now - t < RATE_LIMIT_WINDOW);
  if (rateLimits[key].length >= RATE_LIMIT_MAX) return false;
  rateLimits[key].push(now);
  return true;
}

// Clean up rate limits every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const key of Object.keys(rateLimits)) {
    rateLimits[key] = rateLimits[key].filter(t => now - t < RATE_LIMIT_WINDOW);
    if (rateLimits[key].length === 0) delete rateLimits[key];
  }
}, 5 * 60 * 1000);

// Generate Armour Number
function generateArmourNumber() {
  const prefix = 'C';
  const part1 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const part2 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `${prefix}${part1}-${part2}`;
}

// Generate unique Armour Number
function generateUniqueArmourNumber(users) {
  let armourNumber;
  do {
    armourNumber = generateArmourNumber();
  } while (users[armourNumber]);
  return armourNumber;
}

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain'
};

// Parse JSON body (with size limit)
const MAX_BODY_SIZE = 1024 * 1024; // 1MB

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Extract JWT token from Authorization header
function getTokenFromReq(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

// Verify admin from JWT token, returns admin object or null
function getAdminFromToken(req) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') return null;
  const admins = loadAdmins();
  return admins[payload.id?.toUpperCase()] || null;
}

// Verify user from JWT token, returns user object or null
function getUserFromToken(req) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'user') return null;
  const users = loadUsers();
  return users[payload.id?.toUpperCase()] || null;
}

// Sub-teams (team 2 only)
const SUBTEAM_PARENT = '2';
const SUB_TEAMS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

// Check whether an admin's teams list grants access to a given team/sub-team.
// Entries: 'all' = everything, '2' = all of team 2, '2:a' = only sub-team a of team 2.
function adminTeamMatch(adminTeams, team, subTeam) {
  if (!adminTeams) return false;
  if (adminTeams.includes('all')) return true;
  if (adminTeams.includes(team)) return true;
  if (team === SUBTEAM_PARENT && subTeam && adminTeams.includes(`${team}:${subTeam}`)) return true;
  return false;
}

function adminCanAccess(admin, entity) {
  if (!admin) return false;
  if (admin.isMaster) return true;
  return adminTeamMatch(admin.teams, entity.team, entity.subTeam);
}

// Whether an admin can see any part of a team (for stats rows)
function adminHasTeamVisibility(admin, team) {
  if (admin.isMaster || admin.teams?.includes('all') || admin.teams?.includes(team)) return true;
  if (team === SUBTEAM_PARENT) {
    return admin.teams?.some(t => t.startsWith(`${SUBTEAM_PARENT}:`)) || false;
  }
  return false;
}

// Allowed origins for CORS
const ALLOWED_ORIGINS = ['https://armourcare.uk', 'http://localhost:8000', 'http://127.0.0.1:8000'];

function getCorsOrigin(req) {
  const origin = req.headers['origin'];
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

// Security headers
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

// Send JSON response
function sendJSON(res, statusCode, data, req) {
  const origin = req ? getCorsOrigin(req) : ALLOWED_ORIGINS[0];
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...SECURITY_HEADERS
  });
  res.end(JSON.stringify(data));
}

// Serve static files
function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mimeType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, SECURITY_HEADERS);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType, ...SECURITY_HEADERS });
    res.end(data);
  });
}

// Create server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    const origin = getCorsOrigin(req);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...SECURITY_HEADERS
    });
    res.end();
    return;
  }
  
  // API Routes
  if (pathname === '/api/signup' && req.method === 'POST') {
    try {
      const { armourNumber, team, subTeam, password } = await parseBody(req);
      
      if (!armourNumber || armourNumber.trim() === '') {
        return sendJSON(res, 400, { error: 'Armour number is required' }, req);
      }
      if (!team) {
        return sendJSON(res, 400, { error: 'Team is required' }, req);
      }
      if (team === SUBTEAM_PARENT) {
        if (!subTeam || !SUB_TEAMS.includes(subTeam)) {
          return sendJSON(res, 400, { error: 'Sub-team is required for team 2' }, req);
        }
      }
      if (!password || password.length < 4) {
        return sendJSON(res, 400, { error: 'Password must be at least 4 characters' }, req);
      }
      
      const normalizedArmour = armourNumber.trim().toUpperCase();
      const users = loadUsers();
      
      // Check if armour number already exists
      if (users[normalizedArmour]) {
        return sendJSON(res, 400, { error: 'This Armour number is already registered' }, req);
      }
      
      const hashedPw = await hashPasswordAsync(password);
      const newUser = {
        armourNumber: normalizedArmour,
        team,
        ...(team === SUBTEAM_PARENT ? { subTeam } : {}),
        passwordHash: hashedPw,
        createdAt: Date.now()
      };
      
      users[normalizedArmour] = newUser;
      saveUsers(users);
      logSecurity('user_registered', { user: normalizedArmour, team }, req);
      
      // Return user without password hash + JWT token
      const { passwordHash, ...safeUser } = newUser;
      const token = signToken({ id: normalizedArmour, role: 'user' });
      sendJSON(res, 201, { success: true, user: safeUser, token }, req);
      
    } catch (err) {
      console.error('Signup error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  if (pathname === '/api/login' && req.method === 'POST') {
    try {
      const { armourNumber, password } = await parseBody(req);
      
      if (!armourNumber || !password) {
        return sendJSON(res, 400, { error: 'Armour Number and password are required' }, req);
      }
      
      // Rate limit by IP + armour number
      const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
      if (!checkRateLimit(`login:${clientIP}`)) {
        return sendJSON(res, 429, { error: 'Too many login attempts. Please try again in a minute.' }, req);
      }
      
      const users = loadUsers();
      const user = users[armourNumber.toUpperCase()];
      
      if (!user) {
        logSecurity('login_failed', { user: armourNumber.toUpperCase(), reason: 'unknown_user' }, req);
        return sendJSON(res, 401, { error: 'Invalid Armour Number or password' }, req);
      }
      
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        logSecurity('login_failed', { user: armourNumber.toUpperCase(), reason: 'wrong_password' }, req);
        return sendJSON(res, 401, { error: 'Invalid Armour Number or password' }, req);
      }
      
      // Migrate legacy hash to bcrypt on successful login
      const newHash = await migrateHash(password, user.passwordHash);
      if (newHash) {
        user.passwordHash = newHash;
        saveUsers(users);
      }
      
      logSecurity('user_login', { user: user.armourNumber }, req);
      // Return user without password hash + JWT token
      const { passwordHash, ...safeUser } = user;
      const token = signToken({ id: user.armourNumber, role: 'user' });
      sendJSON(res, 200, { success: true, user: safeUser, token }, req);
      
    } catch (err) {
      console.error('Login error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  if (pathname === '/api/generate-armour' && req.method === 'GET') {
    const users = loadUsers();
    const armourNumber = generateUniqueArmourNumber(users);
    sendJSON(res, 200, { armourNumber }, req);
    return;
  }
  
  // Submit questionnaire
  if (pathname === '/api/submit' && req.method === 'POST') {
    try {
      const { armourNumber, responses } = await parseBody(req);
      
      if (!armourNumber) {
        return sendJSON(res, 400, { error: 'Armour number is required' }, req);
      }
      if (!responses || typeof responses !== 'object') {
        return sendJSON(res, 400, { error: 'Responses are required' }, req);
      }
      
      const users = loadUsers();
      const user = users[armourNumber.toUpperCase()];
      
      if (!user) {
        return sendJSON(res, 401, { error: 'User not found' }, req);
      }
      
      const monthKey = getCurrentMonthKey();
      const submissions = loadSubmissions();
      
      if (!submissions[monthKey]) {
        submissions[monthKey] = {};
      }
      
      submissions[monthKey][armourNumber.toUpperCase()] = {
        armourNumber: armourNumber.toUpperCase(),
        team: user.team,
        ...(user.subTeam ? { subTeam: user.subTeam } : {}),
        responses,
        submittedAt: Date.now()
      };
      
      saveSubmissions(submissions);
      
      sendJSON(res, 200, { 
        success: true, 
        message: 'Survey submitted successfully',
        monthKey
      }, req);
      
    } catch (err) {
      console.error('Submit error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Get team stats
  if (pathname === '/api/team-stats' && req.method === 'GET') {
    try {
      const team = url.searchParams.get('team');
      
      if (!team) {
        return sendJSON(res, 400, { error: 'Team is required' }, req);
      }
      
      const users = loadUsers();
      const submissions = loadSubmissions();
      const monthKey = getCurrentMonthKey();
      const monthSubmissions = submissions[monthKey] || {};
      
      // Count team members
      const teamMembers = Object.values(users).filter(u => u.team === team);
      const totalMembers = teamMembers.length;
      
      // Get submissions for this team this month
      const teamSubmissions = Object.values(monthSubmissions).filter(s => s.team === team);
      const submittedCount = teamSubmissions.length;
      
      // Build question map from questions.json for correct per-question scoring
      const questionsData = loadQuestions();
      const questionMap = buildQuestionMap(questionsData);
      
      // Accumulate wellbeing scores per section (0-100% where 100 = best)
      const sections = {
        burnout: { total: 0, count: 0 },
        mental: { total: 0, count: 0 },
        sleep: { total: 0, count: 0 },
        lifestyle: { total: 0, count: 0 }
      };
      
      let overallTotal = 0;
      let overallCount = 0;
      
      teamSubmissions.forEach(submission => {
        if (submission.responses) {
          Object.entries(submission.responses).forEach(([key, value]) => {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return;
            
            const qInfo = questionMap[key];
            if (!qInfo) return;
            
            const wellbeing = calcWellbeingScore(numValue, qInfo.minValue, qInfo.maxValue, qInfo.polarity);
            
            overallTotal += wellbeing;
            overallCount++;
            
            if (sections[qInfo.section]) {
              sections[qInfo.section].total += wellbeing;
              sections[qInfo.section].count++;
            }
          });
        }
      });
      
      const avgWellbeing = overallCount > 0 ? Math.round(overallTotal / overallCount) : 0;
      
      const sectionScores = {
        burnout: sections.burnout.count > 0 ? Math.round(sections.burnout.total / sections.burnout.count) : 0,
        mental: sections.mental.count > 0 ? Math.round(sections.mental.total / sections.mental.count) : 0,
        sleep: sections.sleep.count > 0 ? Math.round(sections.sleep.total / sections.sleep.count) : 0,
        lifestyle: sections.lifestyle.count > 0 ? Math.round(sections.lifestyle.total / sections.lifestyle.count) : 0
      };
      
      sendJSON(res, 200, {
        team,
        totalMembers,
        submittedCount,
        wellbeingScore: avgWellbeing,
        sectionScores,
        monthKey,
        daysRemaining: getDaysRemaining()
      }, req);
      
    } catch (err) {
      console.error('Team stats error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Check user submission status
  if (pathname === '/api/submission-status' && req.method === 'GET') {
    try {
      const armourNumber = url.searchParams.get('armourNumber');
      
      if (!armourNumber) {
        return sendJSON(res, 400, { error: 'Armour number is required' }, req);
      }
      
      const submissions = loadSubmissions();
      const monthKey = getCurrentMonthKey();
      const monthSubmissions = submissions[monthKey] || {};
      
      const hasSubmitted = !!monthSubmissions[armourNumber.toUpperCase()];
      const submission = monthSubmissions[armourNumber.toUpperCase()];
      
      sendJSON(res, 200, {
        hasSubmitted,
        monthKey,
        daysRemaining: getDaysRemaining(),
        submittedAt: submission?.submittedAt || null,
        responses: submission?.responses || null
      }, req);
      
    } catch (err) {
      console.error('Submission status error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // ============ ADMIN API ENDPOINTS ============
  
  // Admin login
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    try {
      const { armourNumber, password } = await parseBody(req);
      
      if (!armourNumber || !password) {
        return sendJSON(res, 400, { error: 'Armour number and password required' }, req);
      }
      
      // Rate limit by IP
      const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
      if (!checkRateLimit(`admin-login:${clientIP}`)) {
        return sendJSON(res, 429, { error: 'Too many login attempts. Please try again in a minute.' }, req);
      }
      
      const admins = loadAdmins();
      const admin = admins[armourNumber.toUpperCase()];
      
      if (!admin) {
        logSecurity('admin_login_failed', { user: armourNumber.toUpperCase(), reason: 'unknown_admin' }, req);
        return sendJSON(res, 401, { error: 'Invalid credentials' }, req);
      }
      
      const valid = await verifyPassword(password, admin.passwordHash);
      if (!valid) {
        logSecurity('admin_login_failed', { user: armourNumber.toUpperCase(), reason: 'wrong_password' }, req);
        return sendJSON(res, 401, { error: 'Invalid credentials' }, req);
      }
      
      // Migrate legacy hash to bcrypt on successful login
      const newHash = await migrateHash(password, admin.passwordHash);
      if (newHash) {
        admin.passwordHash = newHash;
        saveAdmins(admins);
      }
      
      logSecurity('admin_login', { user: admin.armourNumber }, req);
      const { passwordHash, ...safeAdmin } = admin;
      const token = signToken({ id: admin.armourNumber, role: 'admin' });
      sendJSON(res, 200, { success: true, admin: safeAdmin, token }, req);
      
    } catch (err) {
      console.error('Admin login error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Get all admins (master only)
  if (pathname === '/api/admin/admins' && req.method === 'GET') {
    try {
      const admin = getAdminFromToken(req);
      
      if (!admin || !admin.isMaster) {
        return sendJSON(res, 403, { error: 'Master admin access required' }, req);
      }
      const admins = loadAdmins();
      
      const safeAdmins = Object.values(admins).map(a => {
        const { passwordHash, ...safe } = a;
        return safe;
      });
      
      sendJSON(res, 200, { admins: safeAdmins }, req);
      
    } catch (err) {
      console.error('Get admins error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Add admin (master only)
  if (pathname === '/api/admin/admins' && req.method === 'POST') {
    try {
      const requestingAdmin = getAdminFromToken(req);
      if (!requestingAdmin || !requestingAdmin.isMaster) {
        return sendJSON(res, 403, { error: 'Master admin access required' }, req);
      }
      
      const { armourNumber, password, teams, nickname, permissions } = await parseBody(req);
      
      if (!armourNumber || !password) {
        return sendJSON(res, 400, { error: 'Armour number and password required' }, req);
      }
      
      const admins = loadAdmins();
      const normalizedArmour = armourNumber.toUpperCase();
      
      if (admins[normalizedArmour]) {
        return sendJSON(res, 400, { error: 'Admin already exists' }, req);
      }
      
      const hashedPw = await hashPasswordAsync(password);
      admins[normalizedArmour] = {
        armourNumber: normalizedArmour,
        passwordHash: hashedPw,
        isMaster: false,
        teams: teams || [],
        nickname: nickname || '',
        permissions: permissions || { questions: false, notifications: false },
        createdAt: Date.now()
      };
      
      saveAdmins(admins);
      logSecurity('admin_created', { user: normalizedArmour, by: requestingAdmin.armourNumber }, req);
      
      const { passwordHash, ...safeAdmin } = admins[normalizedArmour];
      sendJSON(res, 201, { success: true, admin: safeAdmin }, req);
      
    } catch (err) {
      console.error('Add admin error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Update admin (master only)
  if (pathname === '/api/admin/admins' && req.method === 'PUT') {
    try {
      const requestingAdmin = getAdminFromToken(req);
      if (!requestingAdmin || !requestingAdmin.isMaster) {
        return sendJSON(res, 403, { error: 'Master admin access required' }, req);
      }
      
      const { targetArmour, teams, password, nickname, permissions } = await parseBody(req);
      
      const admins = loadAdmins();
      const target = admins[targetArmour?.toUpperCase()];
      if (!target) {
        return sendJSON(res, 404, { error: 'Admin not found' }, req);
      }
      
      if (teams) target.teams = teams;
      if (password) target.passwordHash = await hashPasswordAsync(password);
      if (nickname !== undefined) target.nickname = nickname;
      if (permissions !== undefined) target.permissions = permissions;
      
      saveAdmins(admins);
      logSecurity('admin_updated', { target: targetArmour.toUpperCase(), by: requestingAdmin.armourNumber, changes: { teams: !!teams, password: !!password, nickname: nickname !== undefined, permissions: permissions !== undefined } }, req);
      
      const { passwordHash, ...safeAdmin } = target;
      sendJSON(res, 200, { success: true, admin: safeAdmin }, req);
      
    } catch (err) {
      console.error('Update admin error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Change admin password
  if (pathname === '/api/admin/change-password' && req.method === 'POST') {
    try {
      const requestingAdmin = getAdminFromToken(req);
      if (!requestingAdmin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      
      const { targetArmour, newPassword } = await parseBody(req);
      
      const admins = loadAdmins();
      const target = admins[targetArmour?.toUpperCase()];
      if (!target) {
        return sendJSON(res, 404, { error: 'Admin not found' }, req);
      }
      
      // Master can change any password, others can only change their own
      const isSelf = requestingAdmin.armourNumber === targetArmour?.toUpperCase();
      
      if (!requestingAdmin.isMaster && !isSelf) {
        return sendJSON(res, 403, { error: 'Cannot change other admin passwords' }, req);
      }
      
      if (!newPassword || newPassword.length < 4) {
        return sendJSON(res, 400, { error: 'New password must be at least 4 characters' }, req);
      }
      
      target.passwordHash = await hashPasswordAsync(newPassword);
      saveAdmins(admins);
      logSecurity('password_changed', { target: targetArmour.toUpperCase(), by: requestingAdmin.armourNumber, selfChange: isSelf }, req);
      
      sendJSON(res, 200, { success: true }, req);
      
    } catch (err) {
      console.error('Change password error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Delete admin (master only)
  if (pathname === '/api/admin/admins' && req.method === 'DELETE') {
    try {
      const requestingAdmin = getAdminFromToken(req);
      if (!requestingAdmin || !requestingAdmin.isMaster) {
        return sendJSON(res, 403, { error: 'Master admin access required' }, req);
      }
      
      const { targetArmour } = await parseBody(req);
      
      const admins = loadAdmins();
      const target = admins[targetArmour?.toUpperCase()];
      if (!target) {
        return sendJSON(res, 404, { error: 'Admin not found' }, req);
      }
      
      if (target.isMaster) {
        return sendJSON(res, 400, { error: 'Cannot delete master admin' }, req);
      }
      
      delete admins[targetArmour.toUpperCase()];
      saveAdmins(admins);
      logSecurity('admin_deleted', { target: targetArmour.toUpperCase(), by: requestingAdmin.armourNumber }, req);
      
      sendJSON(res, 200, { success: true }, req);
      
    } catch (err) {
      console.error('Delete admin error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Get all users (admin)
  if (pathname === '/api/admin/users' && req.method === 'GET') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      
      const users = loadUsers();
      const subs = loadSubscriptions();
      let userList = Object.values(users).map(u => {
        const { passwordHash, ...safe } = u;
        safe.hasSubscription = !!(subs[u.armourNumber] && subs[u.armourNumber].length > 0);
        return safe;
      });
      
      // Filter by team if not master
      if (!admin.isMaster && admin.teams && !admin.teams.includes('all')) {
        userList = userList.filter(u => adminTeamMatch(admin.teams, u.team, u.subTeam));
      }
      
      sendJSON(res, 200, { users: userList }, req);
      
    } catch (err) {
      console.error('Get users error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Update user nickname (admin)
  if (pathname === '/api/admin/users' && req.method === 'PUT') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      
      const { targetArmour, nickname, subTeam } = await parseBody(req);
      
      const users = loadUsers();
      const target = users[targetArmour?.toUpperCase()];
      
      if (!target) {
        return sendJSON(res, 404, { error: 'User not found' }, req);
      }
      
      // Check team access
      if (!adminCanAccess(admin, target)) {
        return sendJSON(res, 403, { error: 'No access to this user' }, req);
      }
      
      if (nickname !== undefined) {
        target.nickname = nickname || '';
      }
      if (subTeam !== undefined) {
        if (target.team !== SUBTEAM_PARENT) {
          return sendJSON(res, 400, { error: 'Sub-teams only apply to team 2' }, req);
        }
        if (subTeam !== '' && !SUB_TEAMS.includes(subTeam)) {
          return sendJSON(res, 400, { error: 'Invalid sub-team' }, req);
        }
        if (subTeam === '') {
          delete target.subTeam;
        } else {
          target.subTeam = subTeam;
        }
      }
      saveUsers(users);
      
      sendJSON(res, 200, { success: true, user: { armourNumber: target.armourNumber, team: target.team, subTeam: target.subTeam, nickname: target.nickname } }, req);
      
    } catch (err) {
      console.error('Update user error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Delete user (admin)
  if (pathname === '/api/admin/users' && req.method === 'DELETE') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      
      const { targetArmour } = await parseBody(req);
      
      const users = loadUsers();
      const target = users[targetArmour?.toUpperCase()];
      
      if (!target) {
        return sendJSON(res, 404, { error: 'User not found' }, req);
      }
      
      // Check team access
      if (!adminCanAccess(admin, target)) {
        return sendJSON(res, 403, { error: 'No access to this user' }, req);
      }
      
      delete users[targetArmour.toUpperCase()];
      saveUsers(users);
      logSecurity('user_deleted', { target: targetArmour.toUpperCase(), by: admin.armourNumber }, req);
      
      sendJSON(res, 200, { success: true }, req);
      
    } catch (err) {
      console.error('Delete user error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Reset user submission (admin)
  if (pathname === '/api/admin/submissions' && req.method === 'DELETE') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      
      const { targetArmour, month } = await parseBody(req);
      
      const submissions = loadSubmissions();
      const monthKey = month || getCurrentMonthKey();
      
      if (!submissions[monthKey] || !submissions[monthKey][targetArmour?.toUpperCase()]) {
        return sendJSON(res, 404, { error: 'Submission not found' }, req);
      }
      
      const submission = submissions[monthKey][targetArmour.toUpperCase()];
      
      // Check team access
      if (!adminCanAccess(admin, submission)) {
        return sendJSON(res, 403, { error: 'No access to this submission' }, req);
      }
      
      delete submissions[monthKey][targetArmour.toUpperCase()];
      saveSubmissions(submissions);
      logSecurity('submission_reset', { target: targetArmour.toUpperCase(), month: monthKey, by: admin.armourNumber }, req);
      
      sendJSON(res, 200, { success: true }, req);
      
    } catch (err) {
      console.error('Reset submission error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Get all submissions (admin)
  if (pathname === '/api/admin/submissions' && req.method === 'GET') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      const month = url.searchParams.get('month');
      
      const submissions = loadSubmissions();
      const users = loadUsers();
      const monthKey = month || getCurrentMonthKey();
      const monthSubmissions = submissions[monthKey] || {};
      
      let submissionList = Object.values(monthSubmissions);
      
      // Filter by team if not master
      if (!admin.isMaster && admin.teams && !admin.teams.includes('all')) {
        submissionList = submissionList.filter(s => adminTeamMatch(admin.teams, s.team, s.subTeam));
      }
      
      // Add nickname from users data
      submissionList = submissionList.map(s => {
        const user = users[s.armourNumber];
        return { ...s, nickname: user?.nickname || '' };
      });
      
      sendJSON(res, 200, { 
        submissions: submissionList,
        monthKey,
        availableMonths: Object.keys(submissions).sort().reverse()
      }, req);
      
    } catch (err) {
      console.error('Get submissions error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Get stats (admin)
  if (pathname === '/api/admin/stats' && req.method === 'GET') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      
      const users = loadUsers();
      const submissions = loadSubmissions();
      const requestedMonth = url.searchParams.get('month');
      const monthKey = requestedMonth || getCurrentMonthKey();
      const monthSubmissions = submissions[monthKey] || {};
      const availableMonths = Object.keys(submissions).sort().reverse();
      
      let userList = Object.values(users);
      let submissionList = Object.values(monthSubmissions);
      
      // Filter by team if not master
      if (!admin.isMaster && admin.teams && !admin.teams.includes('all')) {
        userList = userList.filter(u => adminTeamMatch(admin.teams, u.team, u.subTeam));
        submissionList = submissionList.filter(s => adminTeamMatch(admin.teams, s.team, s.subTeam));
      }
      
      // Build question map for correct scoring
      const questionsData = loadQuestions();
      const questionMap = buildQuestionMap(questionsData);
      
      // Team breakdown
      const teamStats = {};
      const teams = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'];
      
      // Compute members/submitted/completion + section scores for a group
      function computeGroupStats(groupUsers, groupSubs) {
        const sectionTotals = { burnout: 0, mental: 0, sleep: 0, lifestyle: 0 };
        const sectionCounts = { burnout: 0, mental: 0, sleep: 0, lifestyle: 0 };
        
        groupSubs.forEach(sub => {
          if (sub.responses) {
            Object.entries(sub.responses).forEach(([key, value]) => {
              const numValue = parseFloat(value);
              if (isNaN(numValue)) return;
              
              const qInfo = questionMap[key];
              if (!qInfo) return;
              
              const wellbeing = calcWellbeingScore(numValue, qInfo.minValue, qInfo.maxValue, qInfo.polarity);
              
              if (sectionTotals[qInfo.section] !== undefined) {
                sectionTotals[qInfo.section] += wellbeing;
                sectionCounts[qInfo.section]++;
              }
            });
          }
        });
        
        const sectionScores = {};
        Object.keys(sectionTotals).forEach(section => {
          sectionScores[section] = sectionCounts[section] > 0
            ? Math.round(sectionTotals[section] / sectionCounts[section])
            : 0;
        });
        
        return {
          members: groupUsers.length,
          submitted: groupSubs.length,
          completion: groupUsers.length > 0 ? Math.round((groupSubs.length / groupUsers.length) * 100) : 0,
          sectionScores
        };
      }
      
      teams.forEach(team => {
        if (adminHasTeamVisibility(admin, team)) {
          const teamUsers = userList.filter(u => u.team === team);
          const teamSubs = submissionList.filter(s => s.team === team);
          teamStats[team] = computeGroupStats(teamUsers, teamSubs);
        }
      });
      
      // Sub-team breakdown for team 2
      const subTeamStats = {};
      if (adminHasTeamVisibility(admin, SUBTEAM_PARENT)) {
        const parentUsers = userList.filter(u => u.team === SUBTEAM_PARENT);
        const parentSubs = submissionList.filter(s => s.team === SUBTEAM_PARENT);
        
        SUB_TEAMS.forEach(st => {
          const stUsers = parentUsers.filter(u => u.subTeam === st);
          const stSubs = parentSubs.filter(s => s.subTeam === st);
          if (stUsers.length > 0 || stSubs.length > 0) {
            subTeamStats[st] = computeGroupStats(stUsers, stSubs);
          }
        });
        
        // Users in team 2 without a sub-team assigned
        const unassignedUsers = parentUsers.filter(u => !u.subTeam);
        const unassignedSubs = parentSubs.filter(s => !s.subTeam);
        if (unassignedUsers.length > 0 || unassignedSubs.length > 0) {
          subTeamStats.unassigned = computeGroupStats(unassignedUsers, unassignedSubs);
        }
      }
      
      sendJSON(res, 200, {
        totalUsers: userList.length,
        totalSubmissions: submissionList.length,
        completionRate: userList.length > 0 ? Math.round((submissionList.length / userList.length) * 100) : 0,
        teamStats,
        subTeamStats,
        monthKey,
        availableMonths
      }, req);
      
    } catch (err) {
      console.error('Get stats error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Get security logs (master or security permission)
  if (pathname === '/api/admin/security-logs' && req.method === 'GET') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      if (!admin.isMaster && !admin.permissions?.security) {
        return sendJSON(res, 403, { error: 'Security access required' }, req);
      }
      
      const logs = loadSecurityLog();
      const limit = parseInt(url.searchParams.get('limit')) || 200;
      const eventFilter = url.searchParams.get('event') || '';
      const userFilter = (url.searchParams.get('user') || '').toUpperCase();
      const periodParam = url.searchParams.get('period');
      const periodHours = periodParam !== null ? parseInt(periodParam) : 24;
      
      // Filter by time period first
      const now = Date.now();
      const periodMs = periodHours > 0 ? periodHours * 3600000 : Infinity;
      let filtered = logs.filter(l => (now - l.timestamp) < periodMs);
      
      // Then apply event and user filters
      if (eventFilter) {
        filtered = filtered.filter(l => l.event === eventFilter);
      }
      if (userFilter) {
        filtered = filtered.filter(l => (l.user || l.target || l.by || '').toUpperCase().includes(userFilter));
      }
      
      // Summary stats based on time-filtered logs (before event/user filters)
      const logsInPeriod = logs.filter(l => (now - l.timestamp) < periodMs);
      const summary = {
        totalInPeriod: logsInPeriod.length,
        failedLogins: logsInPeriod.filter(l => l.event === 'login_failed' || l.event === 'admin_login_failed').length,
        registrations: logsInPeriod.filter(l => l.event === 'user_registered').length,
        userLogins: logsInPeriod.filter(l => l.event === 'user_login').length,
        adminActions: logsInPeriod.filter(l => ['admin_created', 'admin_updated', 'admin_deleted', 'user_deleted', 'submission_reset', 'password_changed'].includes(l.event)).length,
        uniqueIPs: [...new Set(logsInPeriod.map(l => l.ip))].length
      };
      
      sendJSON(res, 200, { logs: filtered.slice(0, limit), summary }, req);
      
    } catch (err) {
      console.error('Get security logs error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Delete security log entry or clear all (master or security permission)
  if (pathname === '/api/admin/security-logs' && req.method === 'DELETE') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      if (!admin.isMaster && !admin.permissions?.security) {
        return sendJSON(res, 403, { error: 'Security access required' }, req);
      }
      
      const { id } = await parseBody(req);
      const logs = loadSecurityLog();
      
      if (id) {
        const idx = logs.findIndex(l => l.id === id);
        if (idx === -1) return sendJSON(res, 404, { error: 'Log entry not found' }, req);
        logs.splice(idx, 1);
        saveSecurityLog(logs);
      } else {
        saveSecurityLog([]);
        logSecurity('logs_cleared', { by: admin.armourNumber }, req);
      }
      
      sendJSON(res, 200, { success: true }, req);
      
    } catch (err) {
      console.error('Delete security log error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Get questions (admin)
  if (pathname === '/api/admin/questions' && req.method === 'GET') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      
      const questions = loadQuestions();
      sendJSON(res, 200, { questions }, req);
      
    } catch (err) {
      console.error('Get questions error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Update questions (master only)
  if (pathname === '/api/admin/questions' && req.method === 'PUT') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin || !admin.isMaster) {
        return sendJSON(res, 403, { error: 'Master admin access required' }, req);
      }
      
      const { questions } = await parseBody(req);
      
      saveQuestions(questions);
      sendJSON(res, 200, { success: true }, req);
      
    } catch (err) {
      console.error('Update questions error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // === PUSH NOTIFICATIONS API ===
  
  // Get VAPID public key (for client subscription)
  if (pathname === '/api/vapid-public-key' && req.method === 'GET') {
    sendJSON(res, 200, { publicKey: VAPID_PUBLIC_KEY }, req);
    return;
  }
  
  // Save push subscription for a user
  if (pathname === '/api/push-subscribe' && req.method === 'POST') {
    try {
      const { armourNumber, subscription } = await parseBody(req);
      if (!armourNumber || !subscription) {
        return sendJSON(res, 400, { error: 'armourNumber and subscription required' }, req);
      }
      const subs = loadSubscriptions();
      if (!subs[armourNumber.toUpperCase()]) {
        subs[armourNumber.toUpperCase()] = [];
      }
      // Avoid duplicates by endpoint
      const exists = subs[armourNumber.toUpperCase()].some(s => s.endpoint === subscription.endpoint);
      if (!exists) {
        subs[armourNumber.toUpperCase()].push(subscription);
      }
      saveSubscriptions(subs);
      sendJSON(res, 200, { success: true }, req);
    } catch (err) {
      console.error('Push subscribe error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Admin: Send notification
  if (pathname === '/api/admin/notifications' && req.method === 'POST') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      
      const { title, message, recipients } = await parseBody(req);
      
      if (!title || !message) {
        return sendJSON(res, 400, { error: 'Title and message are required' }, req);
      }
      
      // recipients: 'all' or array of armour numbers
      const users = loadUsers();
      let targetUsers;
      if (recipients === 'all') {
        targetUsers = Object.keys(users);
      } else if (Array.isArray(recipients) && recipients.length > 0) {
        targetUsers = recipients.map(r => r.toUpperCase());
      } else {
        return sendJSON(res, 400, { error: 'Recipients required (\"all\" or array of armour numbers)' }, req);
      }
      
      // Save notification record
      const notifications = loadNotifications();
      const notification = {
        id: crypto.randomUUID(),
        title,
        message,
        recipients: recipients === 'all' ? 'all' : targetUsers,
        sentBy: admin.armourNumber,
        sentAt: Date.now(),
        delivered: 0,
        failed: 0
      };
      
      // Send push notifications
      const subs = loadSubscriptions();
      const payload = JSON.stringify({ title, body: message, icon: '/logo.png' });
      let delivered = 0;
      let failed = 0;
      
      for (const armour of targetUsers) {
        const userSubs = subs[armour];
        if (!userSubs || userSubs.length === 0) continue;
        
        for (const sub of userSubs) {
          try {
            await webpush.sendNotification(sub, payload);
            delivered++;
          } catch (err) {
            failed++;
            // Remove expired/invalid subscriptions
            if (err.statusCode === 410 || err.statusCode === 404) {
              subs[armour] = subs[armour].filter(s => s.endpoint !== sub.endpoint);
            }
          }
        }
      }
      
      saveSubscriptions(subs);
      notification.delivered = delivered;
      notification.failed = failed;
      notifications.unshift(notification);
      saveNotifications(notifications);
      
      sendJSON(res, 200, { success: true, notification }, req);
      
    } catch (err) {
      console.error('Send notification error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Admin: Get notification history
  if (pathname === '/api/admin/notifications' && req.method === 'GET') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      const notifications = loadNotifications();
      const subs = loadSubscriptions();
      const subscribedCount = Object.values(subs).filter(s => s.length > 0).length;
      sendJSON(res, 200, { notifications, subscribedCount }, req);
    } catch (err) {
      console.error('Get notifications error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Admin: Delete notification
  if (pathname === '/api/admin/notifications' && req.method === 'DELETE') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      const { notificationId } = await parseBody(req);
      let notifications = loadNotifications();
      notifications = notifications.filter(n => n.id !== notificationId);
      saveNotifications(notifications);
      sendJSON(res, 200, { success: true }, req);
    } catch (err) {
      console.error('Delete notification error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Admin: Get auto-notification config
  if (pathname === '/api/admin/auto-notif-config' && req.method === 'GET') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      const config = loadAutoNotifConfig();
      const { lastRun, ...safeConfig } = config;
      sendJSON(res, 200, { config: safeConfig }, req);
    } catch (err) {
      console.error('Get auto-notif config error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Admin: Update auto-notification config
  if (pathname === '/api/admin/auto-notif-config' && req.method === 'POST') {
    try {
      const admin = getAdminFromToken(req);
      if (!admin) {
        return sendJSON(res, 403, { error: 'Admin access required' }, req);
      }
      
      const { config: newConfig } = await parseBody(req);
      
      const existing = loadAutoNotifConfig();
      const updated = {
        enabled: newConfig.enabled ?? existing.enabled,
        surveyAvailable: { ...existing.surveyAvailable, ...newConfig.surveyAvailable },
        reminder: { ...existing.reminder, ...newConfig.reminder },
        lastRun: existing.lastRun || {}
      };
      saveAutoNotifConfig(updated);
      
      const { lastRun, ...safeConfig } = updated;
      sendJSON(res, 200, { success: true, config: safeConfig }, req);
    } catch (err) {
      console.error('Update auto-notif config error:', err);
      sendJSON(res, 500, { error: 'Server error' }, req);
    }
    return;
  }
  
  // Serve static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  serveStatic(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  // Get local IP
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let localIP = 'localhost';
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }
  
  console.log('');
  console.log('ArmourCare Server running at:');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIP}:${PORT}`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('');
});
