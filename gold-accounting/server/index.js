'use strict';
const path = require('path');
const express = require('express');
const QRCode = require('qrcode');
const { openDb, getSettings, setSettings } = require('./db');
const auth = require('./auth');
const acc = require('./accounting');
const reports = require('./reports');
const zatca = require('./zatca');

const SECRET_SETTINGS = ['zatca_secret', 'zatca_private_key', 'session_secret'];
const EDITABLE_SETTINGS = [
  'company_name', 'company_name_en', 'vat_number', 'cr_number', 'address_street', 'address_building', 'address_district',
  'address_city', 'address_postal', 'phone', 'vat_rate', 'gold_price_24', 'default_making_per_gram',
  'invoice_prefix_sale', 'invoice_prefix_purchase', 'invoice_prefix_sale_return', 'invoice_prefix_purchase_return',
  'zatca_env', 'zatca_csid', 'zatca_secret', 'zatca_private_key',
];

function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  app.use(auth.middleware(db));

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const range = (q) => {
    const today = new Date().toISOString().slice(0, 10);
    return { from: q.from || `${today.slice(0, 7)}-01`, to: q.to || today };
  };
  const secure = (req) => req.secure || process.env.COOKIE_SECURE === '1';

  // ---------------- المصادقة ----------------
  const attempts = new Map();
  app.get('/api/auth/status', (req, res) => {
    const hasUsers = db.prepare('SELECT COUNT(*) n FROM users').get().n > 0;
    res.json({ setupRequired: !hasUsers, user: req.user || null, perms: req.user ? auth.PERMS[req.user.role] : [] });
  });

  app.post('/api/auth/setup', (req, res) => {
    if (db.prepare('SELECT COUNT(*) n FROM users').get().n > 0) return res.status(400).json({ error: 'تم الإعداد مسبقاً' });
    const { username, name, password, company_name } = req.body || {};
    if (!username || !password || String(password).length < 8) return res.status(400).json({ error: 'اسم المستخدم مطلوب وكلمة المرور 8 أحرف على الأقل' });
    const info = db.prepare("INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, 'admin')")
      .run(String(username).trim(), name || username, auth.hashPassword(password));
    if (company_name) setSettings(db, { company_name });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    auth.issueCookie(db, res, user, secure(req));
    res.json({ ok: true });
  });

  app.post('/api/auth/login', (req, res) => {
    const key = req.ip;
    const a = attempts.get(key) || { n: 0, until: 0 };
    if (a.until > Date.now()) return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد دقائق' });
    const { username, password } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(String(username || '').trim());
    if (!user || !auth.verifyPassword(password || '', user.password_hash)) {
      a.n += 1;
      if (a.n >= 5) { a.until = Date.now() + 5 * 60 * 1000; a.n = 0; }
      attempts.set(key, a);
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    attempts.delete(key);
    auth.issueCookie(db, res, user, secure(req));
    db.prepare('INSERT INTO audit_log (user_id, action) VALUES (?, ?)').run(user.id, 'login');
    res.json({ ok: true });
  });

  app.post('/api/auth/logout', (req, res) => { auth.clearCookie(res); res.json({ ok: true }); });

  app.post('/api/auth/password', auth.requireAuth(), (req, res) => {
    const { current, next: nextPw } = req.body || {};
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!auth.verifyPassword(current || '', u.password_hash)) return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    if (!nextPw || String(nextPw).length < 8) return res.status(400).json({ error: 'كلمة المرور الجديدة 8 أحرف على الأقل' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(auth.hashPassword(nextPw), u.id);
    res.json({ ok: true });
  });

  // ---------------- المستخدمون ----------------
  app.get('/api/users', auth.requireAuth('users'), (req, res) => {
    res.json(db.prepare('SELECT id, username, name, role, active, created_at FROM users ORDER BY id').all());
  });
  app.post('/api/users', auth.requireAuth('users'), (req, res) => {
    const { username, name, password, role } = req.body || {};
    if (!username || !password || String(password).length < 8) return res.status(400).json({ error: 'اسم المستخدم مطلوب وكلمة المرور 8 أحرف على الأقل' });
    if (!auth.PERMS[role]) return res.status(400).json({ error: 'الصلاحية غير صحيحة' });
    try {
      db.prepare('INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)').run(String(username).trim(), name || username, auth.hashPassword(password), role);
    } catch (e) {
      return res.status(400).json({ error: 'اسم المستخدم مستخدم مسبقاً' });
    }
    res.json({ ok: true });
  });
  app.patch('/api/users/:id', auth.requireAuth('users'), (req, res) => {
    const id = Number(req.params.id);
    const { active, role, password } = req.body || {};
    if (id === req.user.id && (active === false || (role && role !== 'admin'))) return res.status(400).json({ error: 'لا يمكنك تعطيل حسابك أو تغيير صلاحيتك' });
    if (role && !auth.PERMS[role]) return res.status(400).json({ error: 'الصلاحية غير صحيحة' });
    if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    if (active != null) db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
    if (password) {
      if (String(password).length < 8) return res.status(400).json({ error: 'كلمة المرور 8 أحرف على الأقل' });
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(auth.hashPassword(password), id);
    }
    res.json({ ok: true });
  });

  // ---------------- الإعدادات ----------------
  app.get('/api/settings', auth.requireAuth(), (req, res) => {
    const s = getSettings(db);
    for (const k of SECRET_SETTINGS) {
      if (k === 'session_secret') delete s[k];
      else s[k] = s[k] ? '••••••••' : '';
    }
    if (!auth.can(req.user, 'settings')) {
      delete s.zatca_csid;
      delete s.zatca_secret;
      delete s.zatca_private_key;
    }
    res.json(s);
  });
  app.put('/api/settings', auth.requireAuth('settings'), (req, res) => {
    const body = req.body || {};
    const upd = {};
    for (const k of EDITABLE_SETTINGS) {
      if (!(k in body)) continue;
      if (SECRET_SETTINGS.includes(k) && body[k] === '••••••••') continue;
      upd[k] = body[k];
    }
    if (upd.vat_number && !zatca.isValidVatNumber(upd.vat_number)) return res.status(400).json({ error: 'الرقم الضريبي يجب أن يكون 15 رقماً يبدأ وينتهي بالرقم 3' });
    if (upd.gold_price_24 != null && !(Number(upd.gold_price_24) >= 0)) return res.status(400).json({ error: 'سعر الذهب غير صحيح' });
    setSettings(db, upd);
    db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)').run(req.user.id, 'settings.update', Object.keys(upd).join(','));
    res.json({ ok: true });
  });
  // تحديث سعر الذهب متاح للكاشير أيضاً (يومي)
  app.put('/api/gold-price', auth.requireAuth('sales'), (req, res) => {
    const p = Number((req.body || {}).gold_price_24);
    if (!(p > 0)) return res.status(400).json({ error: 'سعر الذهب غير صحيح' });
    setSettings(db, { gold_price_24: p });
    res.json({ ok: true, prices: Object.fromEntries(acc.KARATS.map((k) => [k, acc.karatPrice(p, k)])) });
  });

  // ---------------- دليل الحسابات ----------------
  app.get('/api/accounts', auth.requireAuth(), (req, res) => {
    res.json(reports.accountBalances(db, {}));
  });
  app.post('/api/accounts', auth.requireAuth('journal'), (req, res) => {
    const { code, name, type, current } = req.body || {};
    if (!/^\d{3,6}$/.test(String(code || ''))) return res.status(400).json({ error: 'رمز الحساب يجب أن يكون أرقاماً (3-6)' });
    if (!name || !reports.TYPE_LABELS[type]) return res.status(400).json({ error: 'بيانات الحساب غير مكتملة' });
    try {
      db.prepare('INSERT INTO accounts (code, name, type, current) VALUES (?, ?, ?, ?)').run(String(code), name, type, current ? 1 : 0);
    } catch {
      return res.status(400).json({ error: 'رمز الحساب موجود مسبقاً' });
    }
    res.json({ ok: true });
  });

  // ---------------- العملاء والموردون ----------------
  app.get('/api/parties', auth.requireAuth(), (req, res) => {
    const { kind, q } = req.query;
    const rows = db.prepare(`SELECT p.*,
        (SELECT COALESCE(SUM(CASE WHEN type IN ('sale','purchase') THEN total ELSE -total END),0) FROM invoices WHERE party_id = p.id AND payment_method='credit') AS credit_balance,
        (SELECT COUNT(*) FROM invoices WHERE party_id = p.id) AS invoices_count
      FROM parties p WHERE (? IS NULL OR kind = ?) AND (? IS NULL OR name LIKE ? OR phone LIKE ? OR vat_number LIKE ?) ORDER BY p.name`)
      .all(kind || null, kind || null, q || null, `%${q}%`, `%${q}%`, `%${q}%`);
    res.json(rows);
  });
  app.post('/api/parties', auth.requireAuth('parties'), (req, res) => {
    const b = req.body || {};
    if (!['customer', 'supplier'].includes(b.kind) || !b.name) return res.status(400).json({ error: 'النوع والاسم مطلوبان' });
    if (b.vat_number && !zatca.isValidVatNumber(b.vat_number)) return res.status(400).json({ error: 'الرقم الضريبي غير صحيح' });
    const info = db.prepare('INSERT INTO parties (kind, name, vat_number, cr_number, phone, id_number, address, city) VALUES (?,?,?,?,?,?,?,?)')
      .run(b.kind, b.name, b.vat_number || null, b.cr_number || null, b.phone || null, b.id_number || null, b.address || null, b.city || null);
    res.json(db.prepare('SELECT * FROM parties WHERE id = ?').get(info.lastInsertRowid));
  });
  app.put('/api/parties/:id', auth.requireAuth('parties'), (req, res) => {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'الاسم مطلوب' });
    if (b.vat_number && !zatca.isValidVatNumber(b.vat_number)) return res.status(400).json({ error: 'الرقم الضريبي غير صحيح' });
    db.prepare('UPDATE parties SET name=?, vat_number=?, cr_number=?, phone=?, id_number=?, address=?, city=? WHERE id=?')
      .run(b.name, b.vat_number || null, b.cr_number || null, b.phone || null, b.id_number || null, b.address || null, b.city || null, Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------------- الفواتير ----------------
  const invoicePerm = (type) => (type === 'sale' ? 'sales' : type === 'purchase' ? 'purchases' : 'returns');

  app.post('/api/invoices/preview', auth.requireAuth(), (req, res) => {
    const b = req.body || {};
    const calc = acc.computeInvoice({ type: b.type, lines: b.lines, discount: b.discount, purchaseSource: b.purchase_source, settings: getSettings(db) });
    res.json(calc);
  });

  app.post('/api/invoices', auth.requireAuth(), (req, res) => {
    const b = req.body || {};
    if (!auth.can(req.user, invoicePerm(b.type))) return res.status(403).json({ error: 'ليس لديك صلاحية لهذه العملية' });
    if (b.type === 'purchase_return' && !auth.can(req.user, 'purchases')) return res.status(403).json({ error: 'ليس لديك صلاحية لهذه العملية' });
    const inv = acc.createInvoice(db, b, req.user.id);
    res.json(inv);
  });

  app.get('/api/invoices', auth.requireAuth(), (req, res) => {
    const { type, q } = req.query;
    const { from, to } = range(req.query);
    const types = auth.can(req.user, 'purchases') ? null : ['sale', 'sale_return'];
    const rows = db.prepare(`SELECT id, number, type, subtype, date, party_name, payment_method, taxable_amount, vat_amount, total, zatca_status
      FROM invoices WHERE date BETWEEN ? AND ? AND (? IS NULL OR type = ?) AND (? IS NULL OR number LIKE ? OR party_name LIKE ?)
      ORDER BY date DESC, id DESC LIMIT 1000`).all(from, to, type || null, type || null, q || null, `%${q}%`, `%${q}%`);
    res.json(types ? rows.filter((r) => types.includes(r.type)) : rows);
  });

  app.get('/api/invoices/:id', auth.requireAuth(), wrap(async (req, res) => {
    const inv = acc.getInvoice(db, Number(req.params.id));
    if (!inv) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
    if (!auth.can(req.user, 'purchases') && inv.type.startsWith('purchase')) return res.status(403).json({ error: 'ليس لديك صلاحية' });
    if (inv.qr_tlv) inv.qr_image = await QRCode.toDataURL(inv.qr_tlv, { errorCorrectionLevel: 'M', margin: 1, width: 220 });
    const s = getSettings(db);
    inv.seller = {
      name: s.company_name, name_en: s.company_name_en, vat_number: s.vat_number, cr_number: s.cr_number, phone: s.phone,
      address: [s.address_street, s.address_building, s.address_district, s.address_city, s.address_postal].filter(Boolean).join('، '),
    };
    res.json(inv);
  }));

  app.get('/api/invoices/:id/xml', auth.requireAuth('zatca'), (req, res) => {
    const xml = acc.invoiceXml(db, Number(req.params.id));
    if (!xml) return res.status(404).json({ error: 'لا يوجد ملف XML لهذه الفاتورة' });
    const inv = db.prepare('SELECT number FROM invoices WHERE id = ?').get(Number(req.params.id));
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${inv.number}.xml"`);
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`);
  });

  app.post('/api/invoices/:id/submit', auth.requireAuth('zatca'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const inv = acc.getInvoice(db, id);
    if (!inv || !inv.icv) return res.status(400).json({ error: 'هذه الفاتورة لا تُرسل للهيئة' });
    const result = await zatca.submitInvoice({ settings: getSettings(db), invoice: inv, xml: acc.invoiceXml(db, id) });
    if (result.status !== 'not_configured') {
      db.prepare('UPDATE invoices SET zatca_status = ?, zatca_response = ? WHERE id = ?').run(result.status, JSON.stringify(result), id);
    }
    res.status(result.ok ? 200 : 400).json(result);
  }));

  // ---------------- المخزون ----------------
  app.get('/api/inventory', auth.requireAuth('inventory'), (req, res) => res.json(reports.inventory(db)));
  app.get('/api/inventory/moves', auth.requireAuth('inventory'), (req, res) => {
    res.json(reports.stockMovements(db, { karat: req.query.karat ? Number(req.query.karat) : null, ...range(req.query) }));
  });
  app.post('/api/inventory/opening', auth.requireAuth('journal'), (req, res) => {
    const b = req.body || {};
    const jid = acc.openingStock(db, { date: b.date || new Date().toISOString().slice(0, 10), karat: b.karat, weight: b.weight, costPerGram: b.cost_per_gram, userId: req.user.id });
    res.json({ ok: true, journal_id: jid });
  });

  // ---------------- المصروفات ----------------
  app.get('/api/expenses', auth.requireAuth('expenses'), (req, res) => {
    const { from, to } = range(req.query);
    res.json(db.prepare(`SELECT e.*, a.name account_name FROM expenses e JOIN accounts a ON a.code = e.account_code
      WHERE e.date BETWEEN ? AND ? ORDER BY e.date DESC, e.id DESC`).all(from, to));
  });
  app.post('/api/expenses', auth.requireAuth('expenses'), (req, res) => res.json(acc.createExpense(db, req.body || {}, req.user.id)));
  app.delete('/api/expenses/:id', auth.requireAuth('users'), (req, res) => { acc.deleteExpense(db, Number(req.params.id)); res.json({ ok: true }); });

  // ---------------- القيود اليومية ----------------
  app.get('/api/journal', auth.requireAuth('journal'), (req, res) => {
    const { from, to } = range(req.query);
    const entries = db.prepare('SELECT * FROM journal_entries WHERE date BETWEEN ? AND ? ORDER BY date DESC, id DESC LIMIT 500').all(from, to);
    const lines = db.prepare('SELECT jl.*, a.name account_name FROM journal_lines jl JOIN accounts a ON a.code = jl.account_code WHERE entry_id = ? ORDER BY jl.id');
    res.json(entries.map((e) => ({ ...e, lines: lines.all(e.id) })));
  });
  app.post('/api/journal', auth.requireAuth('journal'), (req, res) => {
    const b = req.body || {};
    if (!b.description) return res.status(400).json({ error: 'البيان مطلوب' });
    const lines = b.lines || [];
    if (lines.some((l) => l.account_code === '1301')) return res.status(400).json({ error: 'حركة مخزون الذهب تتم عبر الفواتير أو الرصيد الافتتاحي فقط' });
    const id = acc.postJournal(db, { date: b.date || new Date().toISOString().slice(0, 10), description: b.description, lines, userId: req.user.id });
    res.json({ ok: true, id });
  });
  app.delete('/api/journal/:id', auth.requireAuth('users'), (req, res) => {
    const e = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(Number(req.params.id));
    if (!e) return res.status(404).json({ error: 'القيد غير موجود' });
    if (e.ref_type !== 'manual') return res.status(400).json({ error: 'لا يمكن حذف القيود الآلية. استخدم المرتجعات للتصحيح' });
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(e.id);
    db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)').run(req.user.id, 'journal.delete', String(e.id));
    res.json({ ok: true });
  });

  // ---------------- التقارير ----------------
  app.get('/api/dashboard', auth.requireAuth(), (req, res) => {
    const d = reports.dashboard(db);
    if (!auth.can(req.user, 'reports')) {
      delete d.month.grossProfit; delete d.month.netProfit; delete d.bank; delete d.payables; delete d.vatPayable; delete d.receivables;
    }
    res.json(d);
  });
  app.get('/api/reports/monthly', auth.requireAuth('reports'), (req, res) => {
    const now = new Date();
    res.json(reports.monthlyReport(db, { year: req.query.year || now.getUTCFullYear(), month: req.query.month || now.getUTCMonth() + 1 }));
  });
  app.get('/api/reports/trial-balance', auth.requireAuth('reports'), (req, res) => res.json(reports.trialBalance(db, range(req.query))));
  app.get('/api/reports/income-statement', auth.requireAuth('reports'), (req, res) => res.json(reports.incomeStatement(db, range(req.query))));
  app.get('/api/reports/balance-sheet', auth.requireAuth('reports'), (req, res) => res.json(reports.balanceSheet(db, { asOf: req.query.asOf || new Date().toISOString().slice(0, 10) })));
  app.get('/api/reports/cash-flow', auth.requireAuth('reports'), (req, res) => res.json(reports.cashFlow(db, range(req.query))));
  app.get('/api/reports/ledger', auth.requireAuth('reports'), (req, res) => {
    const r = reports.ledger(db, { code: req.query.code, ...range(req.query) });
    if (!r) return res.status(404).json({ error: 'الحساب غير موجود' });
    res.json(r);
  });
  app.get('/api/reports/vat-return', auth.requireAuth('reports'), (req, res) => res.json(reports.vatReturn(db, range(req.query))));
  app.get('/api/reports/zakat', auth.requireAuth('reports'), (req, res) => {
    res.json(reports.zakatEstimate(db, { asOf: req.query.asOf || new Date().toISOString().slice(0, 10), calendar: req.query.calendar }));
  });

  // نسخة احتياطية كاملة
  app.get('/api/backup', auth.requireAuth('users'), wrap(async (req, res) => {
    const file = path.join(require('os').tmpdir(), `gold-backup-${Date.now()}.db`);
    await db.backup(file);
    res.download(file, `gold-backup-${new Date().toISOString().slice(0, 10)}.db`, () => require('fs').unlink(file, () => {}));
  }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html', maxAge: '1h' }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'غير موجود' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.status === 400 || err instanceof acc.ValidationError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ غير متوقع' });
  });
  return app;
}

if (require.main === module) {
  const db = openDb();
  const port = Number(process.env.PORT || 3000);
  createApp(db).listen(port, () => console.log(`نظام محاسبة الذهب يعمل على http://localhost:${port}`));
}

module.exports = { createApp };
