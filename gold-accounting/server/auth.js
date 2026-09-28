'use strict';
const crypto = require('crypto');
const { getSettings, setSettings } = require('./db');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const COOKIE = 'gold_session';

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const hash = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}

function secret(db) {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const s = getSettings(db);
  if (s.session_secret) return s.session_secret;
  const gen = crypto.randomBytes(32).toString('hex');
  setSettings(db, { session_secret: gen });
  return gen;
}

function sign(db, payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret(db)).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(db, token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', secret(db)).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function issueCookie(db, res, user, secure) {
  const token = sign(db, { uid: user.id, exp: Date.now() + TOKEN_TTL_MS });
  const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${TOKEN_TTL_MS / 1000}`];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

function middleware(db) {
  return (req, res, next) => {
    const payload = verify(db, parseCookies(req.headers.cookie)[COOKIE]);
    if (payload) {
      const user = db.prepare('SELECT id, username, name, role, active FROM users WHERE id = ?').get(payload.uid);
      if (user && user.active) req.user = user;
    }
    next();
  };
}

const PERMS = {
  admin: ['*'],
  accountant: ['sales', 'purchases', 'returns', 'expenses', 'journal', 'reports', 'parties', 'inventory', 'zatca'],
  cashier: ['sales', 'returns', 'parties', 'inventory'],
};

function can(user, perm) {
  if (!user) return false;
  const p = PERMS[user.role] || [];
  return p.includes('*') || p.includes(perm);
}

function requireAuth(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    if (perm && !can(req.user, perm)) return res.status(403).json({ error: 'ليس لديك صلاحية لهذه العملية' });
    next();
  };
}

module.exports = { hashPassword, verifyPassword, issueCookie, clearCookie, middleware, requireAuth, can, PERMS };
