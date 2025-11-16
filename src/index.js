import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL?.toLowerCase() === 'require' ? { rejectUnauthorized: false } : undefined,
});

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change';
const ACCESS_TTL_MIN = parseInt(process.env.JWT_ACCESS_TTL_MIN || '15', 10);
const REFRESH_TTL_DAYS = parseInt(process.env.JWT_REFRESH_TTL_DAYS || '7', 10);

// Init DB
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL
    );
  `);
}

function signAccess(sub) {
  return jwt.sign({ sub }, JWT_SECRET, { algorithm: 'HS256', expiresIn: `${ACCESS_TTL_MIN}m` });
}
function signRefresh(sub) {
  return jwt.sign({ sub, typ: 'refresh' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: `${REFRESH_TTL_DAYS}d` });
}

// Health
app.get('/actuator/health', (_req, res) => res.json({ status: 'UP' }));

// Auth
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password || password.length < 6) return res.status(400).json({ error: 'invalid input' });
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users(email, password_hash) VALUES($1, $2)', [email.trim().toLowerCase(), hash]);
    return res.json({ accessToken: signAccess(email), refreshToken: signRefresh(email) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'email already registered' });
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'invalid input' });
    const r = await pool.query('SELECT id, password_hash FROM users WHERE email=$1', [email.trim().toLowerCase()]);
    if (!r.rows.length) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, r.rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    return res.json({ accessToken: signAccess(email), refreshToken: signRefresh(email) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
});

app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: 'missing token' });
    const payload = jwt.verify(refreshToken, JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.typ !== 'refresh') return res.status(401).json({ error: 'invalid token' });
    const email = payload.sub;
    return res.json({ accessToken: signAccess(email) });
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
});

// Auth middleware example (for future protected routes)
function authMiddleware(req, res, next) {
  const h = req.header('Authorization') || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  const token = h.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { email: payload.sub };
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

app.get('/me', authMiddleware, async (req, res) => {
  res.json({ email: req.user.email });
});

ensureSchema().then(() => {
  app.listen(PORT, () => console.log(`API listening on :${PORT}`));
});
